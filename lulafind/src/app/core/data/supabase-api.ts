import { Observable, Subject } from 'rxjs';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { LulaApi } from './api';
import { SUPABASE_URL, SUPABASE_KEY, supabaseNotice } from './supabase-client';
import { LocalDb } from './local-db';
import {
  ChatMessage, ChatThread, Comment, FeedFilter, FollowEdge, MediaItem,
  Notification, Post, Spotlight, Story, StoryReply, StoryView, Tip, UserProfile
} from '../models/types';

/**
 * SupabaseApi — production LulaApi implementation with automatic local storage fallback.
 *
 * All domain objects are stored as rows in a single flat `records` table.
 * If Supabase table or columns are missing or misconfigured, the API gracefully
 * falls back to local storage so users are never stuck during sign-up or sign-in.
 */
export class SupabaseApi implements LulaApi {
  readonly client: SupabaseClient;
  private localDb = new LocalDb();
  private readonly rx = new Subject<number>();
  private channel: RealtimeChannel | null = null;
  private tick = 0;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  async init(): Promise<void> {
    try {
      this.channel = this.client
        .channel('records-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'records' },
          () => { this.rx.next(++this.tick); }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            supabaseNotice.set('Live updates unavailable. Pull to refresh manually.');
          } else {
            supabaseNotice.set('');
          }
        });
    } catch (e: any) {
      console.warn('Supabase realtime init error:', e?.message);
    }
  }

  async reset(): Promise<void> {
    this.localDb.reset();
  }

  changes(): Observable<number> {
    return this.rx.asObservable();
  }

  // ─── private helpers with local fallback ───────────────────────────────

  private storagePath(src: string | undefined): string | null {
    if (!src) return null;
    const marker = 'storage://photos/';
    if (src.startsWith(marker)) return src.slice(marker.length);
    try {
      const url = new URL(src);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/photos\/(.+)$/);
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  private async signedStorageUrl(path: string): Promise<string | null> {
    const { data, error } = await this.client.storage.from('photos').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      console.warn('Could not sign a private photo URL:', error?.message ?? 'no signed URL returned');
      return null;
    }
    return data.signedUrl;
  }

  private async signRecordMedia<T>(collection: string, record: T): Promise<T> {
    if (collection !== 'posts' && collection !== 'stories') return record;
    const value = record as T & { media?: MediaItem[] };
    if (!Array.isArray(value.media) || !value.media.length) return record;
    const media = await Promise.all(value.media.map(async (item) => {
      const path = this.storagePath(item.src);
      if (!path) return item;
      const src = await this.signedStorageUrl(path);
      return { ...item, src: src ?? '' };
    }));
    return { ...value, media };
  }

  private persistRecordMedia<T>(collection: string, record: T): T {
    if (collection !== 'posts' && collection !== 'stories') return record;
    const value = record as T & { media?: MediaItem[] };
    if (!Array.isArray(value.media)) return record;
    const media = value.media.map((item) => {
      const path = this.storagePath(item.src);
      return path ? { ...item, src: `storage://photos/${path}` } : item;
    });
    return { ...value, media };
  }

  private async getAll<T>(collection: string): Promise<T[]> {
    try {
      const { data, error } = collection === 'users'
        ? await this.client.from('lula_user_profiles_public').select('payload').order('updated_at', { ascending: false })
        : await this.client.from('records').select('payload').eq('collection', collection).order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return await Promise.all((data ?? []).map((r) => this.signRecordMedia(collection, r.payload as T)));
    } catch (e: any) {
      console.warn(`Supabase getAll(${collection}) fallback:`, e?.message);
      return this.localDb.getAll<T>(collection);
    }
  }

  private async getOne<T>(collection: string, id: string): Promise<T | undefined> {
    try {
      const { data, error } = await this.client
        .from('records')
        .select('payload')
        .eq('collection', collection)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? await this.signRecordMedia(collection, data.payload as T) : undefined;
    } catch (e: any) {
      console.warn(`Supabase getOne(${collection}, ${id}) fallback:`, e?.message);
      return this.localDb.getOne<T>(collection, id);
    }
  }

  private async upsert<T extends { id: string }>(
    collection: string,
    item: T,
    ownerId?: string
  ): Promise<void> {
    try {
      const { error } = await this.client
        .from('records')
        .upsert({
          id: item.id,
          collection,
          owner_id: ownerId ?? null,
          payload: this.persistRecordMedia(collection, item),
          updated_at: Date.now()
        });
      if (error) throw new Error(error.message);
      this.rx.next(++this.tick);
    } catch (e: any) {
      console.warn(`Supabase upsert(${collection}) failed:`, e?.message);
      throw new Error(`Could not save ${collection}: ${e?.message ?? 'check your connection and try again'}`);
    }
  }

  private async remove(collection: string, id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('records')
        .delete()
        .eq('collection', collection)
        .eq('id', id);
      if (error) throw new Error(error.message);
      this.rx.next(++this.tick);
    } catch (e: any) {
      console.warn(`Supabase remove(${collection}, ${id}) failed:`, e?.message);
      throw new Error(`Could not delete ${collection}: ${e?.message ?? 'check your connection and try again'}`);
    }
  }

  private async getAllWhere<T>(
    collection: string,
    field: string,
    value: string
  ): Promise<T[]> {
    try {
      const { data, error } = await this.client
        .from('records')
        .select('payload')
        .eq('collection', collection)
        .filter(`payload->>${field}`, 'eq', value)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.payload as T);
    } catch (e: any) {
      console.warn(`Supabase getAllWhere(${collection}) fallback:`, e?.message);
      const all = this.localDb.getAll<any>(collection);
      return all.filter((x) => x && x[field] === value) as T[];
    }
  }

  // ─── users ───────────────────────────────────────────────────────────────

  async user(id: string): Promise<UserProfile | undefined> {
    try {
      const { data: sessionData } = await this.client.auth.getUser();
      if (sessionData.user?.id === id) return this.getOne<UserProfile>('users', id);
      const { data, error } = await this.client
        .from('lula_user_profiles_public')
        .select('payload')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? (data.payload as UserProfile) : undefined;
    } catch (e: any) {
      console.warn(`Supabase user(${id}) fallback:`, e?.message);
      return this.localDb.user(id);
    }
  }

  async users(): Promise<UserProfile[]> {
    return this.getAll<UserProfile>('users');
  }

  async saveUser(u: UserProfile): Promise<void> {
    await this.upsert('users', u, u.id);
  }

  async deleteUser(id: string): Promise<void> {
    await this.remove('users', id);
  }

  // ─── posts ───────────────────────────────────────────────────────────────

  async post(id: string): Promise<Post | undefined> {
    return this.getOne<Post>('posts', id);
  }

  async posts(): Promise<Post[]> {
    return this.getAll<Post>('posts');
  }

  async queryFeed(f: FeedFilter, viewerId: string | null): Promise<Post[]> {
    try {
      // RLS is the source of truth for private audiences. Fetch the visible
      // records first, then apply the same sort/status/query rules as LocalDb.
      const { data, error } = await this.client
        .from('records')
        .select('payload')
        .eq('collection', 'posts')
        .order('updated_at', { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      let posts = await Promise.all((data ?? []).map((row) => this.signRecordMedia('posts', row.payload as Post)));
      const [viewer, spots, people] = await Promise.all([
        viewerId ? this.user(viewerId) : Promise.resolve(undefined),
        f.spotlightId || posts.some((p) => p.audience === 'surname') ? this.spotlights() : Promise.resolve([]),
        f.query.trim() ? this.users() : Promise.resolve([])
      ]);
      const following = new Set<string>();
      if (viewerId) {
        await Promise.all(posts.filter((p) => p.authorId !== viewerId && p.audience === 'followers')
          .map(async (p) => { if (await this.isFollowing(viewerId, p.authorId)) following.add(p.authorId); }));
      }
      posts = posts.filter((p) => {
        if (p.status === 'under_review' && p.authorId !== viewerId) return false;
        if (p.audience === 'followers' && p.authorId !== viewerId && !following.has(p.authorId)) return false;
        if (p.audience === 'surname' && p.authorId !== viewerId) {
          const spot = spots.find((s) => s.id === p.spotlightId);
          if (!viewerId || !spot || !spot.memberIds.includes(viewerId)) return false;
        }
        if (f.type !== 'all' && p.type !== f.type) return false;
        if (f.province !== 'all' && p.province !== f.province) return false;
        if (f.spotlightId && p.spotlightId !== f.spotlightId) return false;
        if (f.status === 'active' && p.status !== 'active' && p.status !== 'under_review') return false;
        if (f.status === 'found' && p.status !== 'found') return false;
        if (f.query.trim()) {
          const q = f.query.trim().toLowerCase();
          const author = people.find((u) => u.id === p.authorId);
          const haystack = [p.title, p.body, p.town, p.caseNumber ?? '', p.subject?.name ?? '',
            p.subject?.surname ?? '', p.vehicleDetails?.makeModel ?? '', author?.displayName ?? ''].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
      switch (f.sort) {
        case 'hot':
          posts.sort((a, b) => this.score(b) - this.score(a));
          break;
        case 'oldest':
          posts.sort((a, b) => a.createdAt - b.createdAt);
          break;
        case 'nearby':
          posts.sort((a, b) => Number(b.province === viewer?.province) - Number(a.province === viewer?.province));
          break;
        default:
          posts.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return posts;
    } catch (e: any) {
      console.warn('Supabase queryFeed fallback:', e?.message);
      let posts = this.localDb.getAll<Post>('posts');
      if (f.type !== 'all') posts = posts.filter((p) => p.type === f.type);
      if (f.province !== 'all') posts = posts.filter((p) => p.province === f.province);
      if (f.status === 'active') posts = posts.filter((p) => p.status === 'active' || p.status === 'under_review');
      if (f.status === 'found') posts = posts.filter((p) => p.status === 'found');
      if (f.spotlightId) posts = posts.filter((p) => p.spotlightId === f.spotlightId);
      return posts;
    }
  }

  private score(post: Post): number {
    const ageHours = Math.max(1, (Date.now() - post.createdAt) / 3_600_000);
    return (post.upvotes * 3 + post.commentCount * 5 + post.shares * 2) / Math.pow(ageHours, 0.55);
  }

  async savePost(p: Post): Promise<void> {
    await this.upsert('posts', p, p.authorId);
  }

  async deletePost(id: string): Promise<void> {
    await this.remove('posts', id);
  }

  // ─── comments ────────────────────────────────────────────────────────────

  async commentsFor(postId: string): Promise<Comment[]> {
    return this.getAllWhere<Comment>('comments', 'postId', postId);
  }

  async saveComment(c: Comment): Promise<void> {
    await this.upsert('comments', c, c.authorId);
  }

  async deleteComment(id: string, _postId?: string): Promise<void> {
    await this.remove('comments', id);
  }

  // ─── spotlights ──────────────────────────────────────────────────────────

  async spotlights(): Promise<Spotlight[]> {
    return this.getAll<Spotlight>('spotlights');
  }

  async spotlight(id: string): Promise<Spotlight | undefined> {
    return this.getOne<Spotlight>('spotlights', id);
  }

  async saveSpotlight(s: Spotlight): Promise<void> {
    await this.upsert('spotlights', s, s.ownerId);
  }

  async setSpotlightMembership(id: string, memberId: string, joining: boolean): Promise<Spotlight | undefined> {
    const { data: authData, error: authError } = await this.client.auth.getUser();
    if (authError) throw new Error(`Could not verify your account: ${authError.message}`);
    if (!authData.user || authData.user.id !== memberId) throw new Error('Sign in to change your Spotlight membership');
    const { data, error } = await this.client.rpc('lula_set_spotlight_membership', {
      spotlight_id: id,
      joining
    });
    if (error) throw new Error(`Could not update Spotlight membership: ${error.message}`);
    this.rx.next(++this.tick);
    return data as Spotlight | undefined;
  }

  async deleteSpotlight(id: string): Promise<void> {
    await this.remove('spotlights', id);
  }

  // ─── media ────────────────────────────────────────────────────────────────

  async uploadMedia(ownerId: string, item: MediaItem): Promise<MediaItem> {
    let path = this.storagePath(item.src);
    if (item.src.startsWith('data:')) {
      if (!ownerId) throw new Error('Sign in before uploading media');
      const blob = await fetch(item.src).then((response) => response.blob());
      if (blob.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB');
      const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || (item.kind === 'video' ? 'mp4' : 'jpg');
      path = `${ownerId}/${item.id}.${extension}`;
      const { error } = await this.client.storage.from('photos').upload(path, blob, {
        cacheControl: '3600', upsert: true, contentType: blob.type || (item.kind === 'video' ? 'video/mp4' : 'image/jpeg')
      });
      if (error) throw new Error(`Could not upload media: ${error.message}`);
    }
    if (!path) return item;
    const src = await this.signedStorageUrl(path);
    if (!src) throw new Error('Could not create a private photo link. Check the photo bucket policies.');
    return { ...item, src };
  }

  // ─── stories ─────────────────────────────────────────────────────────────

  async stories(): Promise<Story[]> {
    const all = await this.getAll<Story>('stories');
    return all.filter((s) => s.expiresAt > Date.now());
  }

  async saveStory(s: Story): Promise<void> {
    await this.upsert('stories', s, s.authorId);
  }

  async storyRepliesFor(storyId: string): Promise<StoryReply[]> {
    // Legacy embedded replies are migrated to story_replies by story-privacy.sql.
    // Never merge the local demo seed into a live user's story insights.
    const stored = await this.getAllWhere<StoryReply>('story_replies', 'storyId', storyId);
    return stored.sort((a, b) => a.at - b.at);
  }

  async saveStoryReply(reply: StoryReply): Promise<void> {
    await this.upsert('story_replies', reply, reply.authorId);
  }

  async storyViewsFor(storyId: string): Promise<StoryView[]> {
    // Legacy embedded view ids are migrated by story-privacy.sql; do not expose
    // bundled demo viewers as live insights.
    const stored = await this.getAllWhere<StoryView>('story_views', 'storyId', storyId);
    return stored.sort((a, b) => a.at - b.at);
  }

  async saveStoryView(view: StoryView): Promise<void> {
    await this.upsert('story_views', view, view.viewerId);
  }

  // ─── chat ─────────────────────────────────────────────────────────────────

  async threadsFor(userId: string): Promise<ChatThread[]> {
    const all = await this.getAll<ChatThread>('threads');
    return all.filter((t) => t.participantIds.includes(userId));
  }

  async thread(id: string): Promise<ChatThread | undefined> {
    return this.getOne<ChatThread>('threads', id);
  }

  async saveThread(t: ChatThread): Promise<void> {
    await this.upsert('threads', t, t.participantIds[0] ?? undefined);
  }

  async messages(threadId: string): Promise<ChatMessage[]> {
    const all = await this.getAllWhere<ChatMessage>('messages', 'threadId', threadId);
    return all.sort((a, b) => a.at - b.at);
  }

  async saveMessage(m: ChatMessage): Promise<void> {
    // System bubbles are still written by a signed-in participant. The sender
    // label is deliberately `system` in the payload, but `owner_id` is a UUID.
    const ownerId = m.fromUserId === 'system'
      ? (await this.client.auth.getUser()).data.user?.id
      : m.fromUserId;
    await this.upsert('messages', m, ownerId ?? undefined);
  }

  async markThreadRead(threadId: string, userId: string): Promise<void> {
    const t = await this.thread(threadId);
    if (!t) return;
    const unread = { ...t.unread, [userId]: 0 };
    await this.saveThread({ ...t, unread });
  }

  // ─── follows ─────────────────────────────────────────────────────────────

  async isFollowing(a: string, b: string): Promise<boolean> {
    return (await this.followStatus(a, b)) === 'accepted';
  }

  async followStatus(a: string, b: string): Promise<FollowEdge['status'] | null> {
    try {
      return (await this.getOne<FollowEdge>('follows', `f_${a}_${b}`))?.status ?? null;
    } catch {
      return this.localDb.followStatus(a, b);
    }
  }

  async followsFor(userId: string, direction: 'followers' | 'following'): Promise<FollowEdge[]> {
    const field = direction === 'followers' ? 'followingId' : 'followerId';
    const all = await this.getAllWhere<FollowEdge>('follows', field, userId);
    return all.filter((edge) => edge.status === 'accepted');
  }

  async follow(a: string, b: string): Promise<'accepted' | 'pending'> {
    const target = await this.user(b);
    const needsApproval = target?.privacy?.requireFollowApproval === true;
    const status: FollowEdge['status'] = needsApproval ? 'pending' : 'accepted';
    const edge: FollowEdge = {
      id: `f_${a}_${b}`,
      followerId: a,
      followingId: b,
      at: Date.now(),
      status
    };
    await this.upsert('follows', edge, a);
    return status;
  }

  async unfollow(a: string, b: string): Promise<void> {
    await this.remove('follows', `f_${a}_${b}`);
  }

  async followRequests(userId: string): Promise<FollowEdge[]> {
    const all = await this.getAllWhere<FollowEdge>('follows', 'followingId', userId);
    return all.filter((e) => e.status === 'pending');
  }

  async respondFollowRequest(followerId: string, userId: string, accept: boolean): Promise<void> {
    const id = `f_${followerId}_${userId}`;
    if (accept) {
      const edge = await this.getOne<FollowEdge>('follows', id);
      if (edge) await this.upsert('follows', { ...edge, status: 'accepted' }, followerId);
    } else {
      await this.remove('follows', id);
    }
  }

  async followerCount(userId: string): Promise<number> {
    const all = await this.getAllWhere<FollowEdge>('follows', 'followingId', userId);
    return all.filter((e) => e.status === 'accepted').length;
  }

  async followingCount(userId: string): Promise<number> {
    const all = await this.getAllWhere<FollowEdge>('follows', 'followerId', userId);
    return all.filter((e) => e.status === 'accepted').length;
  }

  // ─── notifications ───────────────────────────────────────────────────────

  async notifications(userId: string): Promise<Notification[]> {
    return this.getAllWhere<Notification>('notifications', 'userId', userId);
  }

  async pushNotification(n: Notification): Promise<void> {
    const { data } = await this.client.auth.getUser();
    await this.upsert('notifications', n, data.user?.id ?? n.userId);
  }

  async markNotificationsRead(userId: string): Promise<void> {
    const notes = await this.notifications(userId);
    await Promise.all(
      notes
        .filter((n) => !n.read)
        .map((n) => this.upsert('notifications', { ...n, read: true }, n.userId))
    );
  }

  // ─── tips ────────────────────────────────────────────────────────────────

  async tips(): Promise<Tip[]> {
    try {
      const tips = await this.getAll<Tip>('tips');
      return tips.length ? tips : [];
    } catch {
      return [];
    }
  }
}
