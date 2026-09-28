import { Injectable, computed, inject, signal } from '@angular/core';
import { LULA_API } from '../data/api';
import { ChatMessage, ChatThread, MediaItem, Post } from '../models/types';
import { uid } from '../utils/format';
import { AuthService } from './auth.service';

export type ChatGate =
  | { allowed: true; reason: 'open' }
  | { allowed: false; step: 'sign_in' }
  | { allowed: false; step: 'vote'; reason: string }
  | { allowed: false; step: 'follow'; reason: string; peerId: string }
  | { allowed: false; step: 'disabled'; reason: string };

/**
 * Private chat rules (product decision):
 *  1. The poster chose "chat enabled" when creating the post.
 *  2. You upvoted ("I have an idea") - so the chat is lead-driven.
 *  3. You follow each other - so private chat only opens between connections.
 *
 * Claiming a KhumbulEkhaya post ("this is me") bypasses rule 2, because the
 * whole point is to let the person get in touch without exposing them.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private api = inject(LULA_API);
  private auth = inject(AuthService);

  readonly threads = signal<ChatThread[]>([]);
  readonly openThreadId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);

  readonly unreadTotal = computed(() => {
    const me = this.auth.viewerId;
    if (!me) return 0;
    return this.threads().reduce((sum, t) => sum + (t.unread[me] ?? 0), 0);
  });

  async load(): Promise<void> {
    const me = this.auth.viewerId;
    if (!me) {
      this.threads.set([]);
      return;
    }
    this.threads.set(await this.api.threadsFor(me));
  }

  async openThread(threadId: string): Promise<void> {
    const me = this.auth.viewerId;
    this.openThreadId.set(threadId);
    this.messages.set(await this.api.messages(threadId));
    if (me) await this.api.markThreadRead(threadId, me);
    await this.load();
  }

  async close(): Promise<void> {
    this.openThreadId.set(null);
    this.messages.set([]);
  }

  /**
   * Evaluates the three rules and tells the UI exactly which step is blocking,
   * so the button can say "Upvote to unlock chat" or "Follow to unlock chat".
   */
  async gate(post: Post, claimedByViewer = false): Promise<ChatGate> {
    const me = this.auth.viewerId;
    if (!post.chatEnabled) {
      return { allowed: false, step: 'disabled', reason: 'The poster turned chat off for this post. Use the comments instead.' };
    }
    if (!me) return { allowed: false, step: 'sign_in' };
    if (me === post.authorId) return { allowed: true, reason: 'open' };
    if (claimedByViewer || post.khumbu?.claimedByUserId === me) return { allowed: true, reason: 'open' };

    const voted = (post.voterIds[me] ?? null) === 'up';
    if (!voted) {
      return { allowed: false, step: 'vote', reason: 'Upvote this post ("I have an idea") to unlock private chat with the poster.' };
    }
    const mutual =
      (await this.api.isFollowing(me, post.authorId)) && (await this.api.isFollowing(post.authorId, me));
    if (!mutual) {
      return {
        allowed: false,
        step: 'follow',
        reason: 'You both need to follow each other before private chat opens. Follow them, and they will see the request.',
        peerId: post.authorId
      };
    }
    return { allowed: true, reason: 'open' };
  }

  /** Find an existing thread with this person (optionally about this post) or create one. */
  async ensureThread(post: Post | null, peerId: string, unlockedVia: ChatThread['unlockedVia'] = 'vote'): Promise<ChatThread | null> {
    const me = this.auth.viewerId;
    if (!me || me === peerId) return null;
    const existing = (await this.api.threadsFor(me)).find(
      (t) => t.participantIds.includes(peerId) && (!post || t.postId === post.id)
    );
    if (existing) {
      await this.openThread(existing.id);
      return existing;
    }
    const now = Date.now();
    const thread: ChatThread = {
      id: uid('th'),
      participantIds: [me, peerId],
      postId: post?.id ?? null,
      createdAt: now,
      lastMessageAt: now,
      unread: { [me]: 0, [peerId]: 0 },
      unlockedVia
    };
    await this.api.saveThread(thread);
    await this.api.saveMessage({
      id: uid('m'),
      threadId: thread.id,
      fromUserId: 'system' as string,
      body: post
        ? `Private chat opened from "${post.title}". Everything said here is only visible to the two of you.`
        : 'Private chat opened. Be kind, be careful, and never send money to a stranger.',
      at: now,
      read: false,
      kind: 'system',
      postId: post?.id
    });
    await this.load();
    await this.openThread(thread.id);
    return thread;
  }

  /**
   * Send a message. Either the text or the attachment has to be there -
   * an empty bubble with nothing in it is never sent.
   */
  async send(body: string, media?: MediaItem | null): Promise<void> {
    const me = this.auth.viewerId;
    const threadId = this.openThreadId();
    const text = body.trim();
    if (!me || !threadId || (!text && !media)) return;
    this.sending.set(true);
    try {
      await this.api.saveMessage({
        id: uid('m'),
        threadId,
        fromUserId: me,
        body: text,
        at: Date.now(),
        read: false,
        kind: 'text',
        media: media ?? null
      });
      this.messages.set(await this.api.messages(threadId));
      await this.load();
    } finally {
      this.sending.set(false);
    }
  }

  /** System message used to record consent/escalation milestones inside the chat. */
  async systemNote(threadId: string, body: string, postId?: string): Promise<void> {
    const now = Date.now();
    await this.api.saveMessage({
      id: uid('m'),
      threadId,
      fromUserId: 'system',
      body,
      at: now,
      read: false,
      kind: 'system',
      postId
    });
    if (this.openThreadId() === threadId) this.messages.set(await this.api.messages(threadId));
    await this.load();
  }

  async markAllRead(): Promise<void> {
    const me = this.auth.viewerId;
    if (!me) return;
    for (const t of this.threads()) await this.api.markThreadRead(t.id, me);
    await this.load();
  }
}
