import { Observable, Subject } from 'rxjs';
import {
  ChatMessage, ChatThread, Comment, FeedFilter, FollowEdge, MediaItem, Notification, Post, Spotlight, Story, StoryReply, StoryView, Tip, UserProfile
} from '../models/types';
import { LulaApi } from './api';

/*
 * Cloud Firestore + Firebase Auth implementation.
 *
 * The firebase SDK is imported lazily (dynamic import) so the JS bundle stays
 * small and the app keeps working with zero config in mock mode.
 *
 * Activate by setting environment.dataMode = 'firebase' and filling in the
 * firebase config in src/environments/environment*.ts.
 *
 * Suggested Firestore layout
 *   users/{uid}                         UserProfile
 *   posts/{postId}                      Post
 *   posts/{postId}/comments/{commentId} Comment
 *   spotlights/{spotlightId}            Spotlight
 *   stories/{storyId}                   Story
 *   threads/{threadId}                  ChatThread
 *   threads/{threadId}/messages/{msgId} ChatMessage
 *   follows/{followerId__followingId}   FollowEdge
 *   notifications/{userId}/items/{id}   Notification
 *   tips/{tipId}                        Tip (read-only, managed in the console)
 *
 * Suggested security rules: see docs/FIRESTORE_RULES.md
 */
export class FirebaseApi implements LulaApi {
  private app: any;
  private fs: any;
  private q: any;
  private rx = new Subject<number>();
  private rev = 0;

  constructor(private config: Record<string, string>) { }

  private tick(): void {
    this.rev++;
    this.rx.next(this.rev);
  }

  async init(): Promise<void> {
    const [{ initializeApp }, firestore] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore')
    ]);
    this.app = initializeApp(this.config as any);
    this.fs = firestore;
    this.q = firestore;
    this.listen();
  }

  /**
   * Other phones see a new case, comment, or message without a refresh.
   * A denied rule must not crash the app — the error callback is enough.
   */
  private listen(): void {
    const db = this.fs.getFirestore(this.app);
    const watch = (ref: any) => {
      try {
        this.q.onSnapshot(ref, () => this.tick(), () => undefined);
      } catch {
        /* rules or an index are not ready yet */
      }
    };
    watch(this.col('posts'));
    watch(this.col('users'));
    watch(this.col('stories'));
    watch(this.col('threads'));
    watch(this.col('follows'));
    watch(this.col('spotlights'));
    try {
      watch(this.q.collectionGroup(db, 'comments'));
      watch(this.q.collectionGroup(db, 'messages'));
    } catch {
      /* top-level listeners still run */
    }
  }

  private col(name: string): any {
    return this.q.collection(this.fs.getFirestore(this.app), name);
  }
  private doc(path: string): any {
    return this.q.doc(this.fs.getFirestore(this.app), path);
  }

  private async getOne<T>(path: string): Promise<T | undefined> {
    const snap = await this.q.getDoc(this.doc(path));
    return snap.exists() ? ({ ...(snap.data() as object), id: snap.id } as T) : undefined;
  }

  private async getList<T>(ref: any): Promise<T[]> {
    const snap = await this.q.getDocs(ref);
    return snap.docs.map((d: any) => ({ ...(d.data() as object), id: d.id }) as T);
  }

  private async set(path: string, data: Record<string, unknown>): Promise<void> {
    await this.q.setDoc(this.doc(path), data, { merge: true });
    this.tick();
  }

  private async remove(path: string): Promise<void> {
    await this.q.deleteDoc(this.doc(path));
    this.tick();
  }

  async reset(): Promise<void> {
    // Intentionally not implemented client-side. Use the Firestore console or an
    // Admin SDK script; a client must never be able to wipe production data.
    throw new Error('reset() is not permitted against Firestore.');
  }

  /* users */
  async user(id: string) { return this.getOne<UserProfile>(`users/${id}`); }
  async users() { return this.getList<UserProfile>(this.col('users')); }
  async saveUser(u: UserProfile) { await this.set(`users/${u.id}`, u as unknown as Record<string, unknown>); }
  async deleteUser(id: string) { await this.remove(`users/${id}`); }

  /* posts */
  async post(id: string) { return this.getOne<Post>(`posts/${id}`); }
  async posts() {
    return this.getList<Post>(this.q.query(this.col('posts'), this.q.orderBy('updatedAt', 'desc'), this.q.limit(200)));
  }
  async queryFeed(f: FeedFilter, _viewerId: string | null) {
    // Firestore cannot express every filter combination server-side, so we pull
    // the newest slice and refine in memory. Swap in composite indexes when the
    // dataset grows.
    let all = await this.posts();
    if (f.type !== 'all') all = all.filter((p) => p.type === f.type);
    if (f.province !== 'all') all = all.filter((p) => p.province === f.province);
    if (f.status === 'active') all = all.filter((p) => p.status === 'active' || p.status === 'under_review');
    if (f.status === 'found') all = all.filter((p) => p.status === 'found');
    if (f.query.trim()) {
      const needle = f.query.trim().toLowerCase();
      all = all.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          p.body.toLowerCase().includes(needle) ||
          (p.subject?.name.toLowerCase().includes(needle) ?? false)
      );
    }
    return all;
  }
  async savePost(p: Post) { await this.set(`posts/${p.id}`, p as unknown as Record<string, unknown>); }
  async deletePost(id: string) { await this.remove(`posts/${id}`); }

  /* comments */
  async commentsFor(postId: string) {
    const list = await this.getList<Comment>(this.q.query(this.col(`posts/${postId}/comments`), this.q.orderBy('createdAt', 'desc')));
    return list.sort((a, b) => b.upvotes - a.upvotes);
  }
  async saveComment(c: Comment) { await this.set(`posts/${c.postId}/comments/${c.id}`, c as unknown as Record<string, unknown>); }
  async deleteComment(id: string, postId?: string) {
    if (postId) {
      await this.remove(`posts/${postId}/comments/${id}`);
    } else {
      // Fallback: postId unknown — skip (avoids wrong-path deletion)
      console.warn('FirebaseApi.deleteComment called without postId; deletion skipped.');
    }
  }

  /* spotlights */
  async spotlights() { return this.getList<Spotlight>(this.col('spotlights')); }
  async spotlight(id: string) { return this.getOne<Spotlight>(`spotlights/${id}`); }
  async saveSpotlight(s: Spotlight) { await this.set(`spotlights/${s.id}`, s as unknown as Record<string, unknown>); }
  async setSpotlightMembership(id: string, memberId: string, joining: boolean) {
    const spotlight = await this.spotlight(id);
    if (!spotlight) return undefined;
    const memberIds = joining
      ? [...new Set([...spotlight.memberIds, memberId])]
      : spotlight.memberIds.filter((current) => current !== memberId);
    const next = { ...spotlight, memberIds, followers: memberIds.length };
    await this.saveSpotlight(next);
    return next;
  }
  async deleteSpotlight(id: string) { await this.remove(`spotlights/${id}`); }

  /* stories */
  async uploadMedia(_ownerId: string, item: MediaItem) { return item; }
  async stories() {
    const all = await this.getList<Story>(this.q.query(this.col('stories'), this.q.orderBy('createdAt', 'desc'), this.q.limit(100)));
    return all.filter((s) => s.expiresAt > Date.now());
  }
  async saveStory(s: Story) { await this.set(`stories/${s.id}`, s as unknown as Record<string, unknown>); }
  async storyRepliesFor(storyId: string) {
    return this.getList<StoryReply>(this.col(`stories/${storyId}/replies`));
  }
  async saveStoryReply(reply: StoryReply) {
    await this.set(`stories/${reply.storyId}/replies/${reply.id}`, reply as unknown as Record<string, unknown>);
  }
  async storyViewsFor(storyId: string) {
    return this.getList<StoryView>(this.col(`stories/${storyId}/views`));
  }
  async saveStoryView(view: StoryView) {
    await this.set(`stories/${view.storyId}/views/${view.id}`, view as unknown as Record<string, unknown>);
  }

  /* chat */
  async threadsFor(userId: string) {
    const all = await this.getList<ChatThread>(this.q.query(this.col('threads'), this.q.orderBy('lastMessageAt', 'desc'), this.q.limit(100)));
    return all.filter((t) => t.participantIds.includes(userId));
  }
  async thread(id: string) { return this.getOne<ChatThread>(`threads/${id}`); }
  async saveThread(t: ChatThread) { await this.set(`threads/${t.id}`, t as unknown as Record<string, unknown>); }
  async messages(threadId: string) {
    return this.getList<ChatMessage>(this.q.query(this.col(`threads/${threadId}/messages`), this.q.orderBy('at', 'asc')));
  }
  async saveMessage(m: ChatMessage) { await this.set(`threads/${m.threadId}/messages/${m.id}`, m as unknown as Record<string, unknown>); }
  async markThreadRead(threadId: string, userId: string) {
    await this.q.updateDoc(this.doc(`threads/${threadId}`), { [`unread.${userId}`]: 0 });
    this.tick();
  }

  /* follows */
  async isFollowing(a: string, b: string) {
    return (await this.followStatus(a, b)) === 'accepted';
  }
  async followStatus(a: string, b: string): Promise<FollowEdge['status'] | null> {
    const snap = await this.q.getDoc(this.doc(`follows/${a}__${b}`));
    return snap.exists() ? (snap.data() as FollowEdge | undefined)?.status ?? null : null;
  }
  async followsFor(userId: string, direction: 'followers' | 'following'): Promise<FollowEdge[]> {
    const all = await this.getList<FollowEdge>(this.col('follows'));
    return all.filter((edge) =>
      edge.status === 'accepted' && (direction === 'followers' ? edge.followingId === userId : edge.followerId === userId)
    );
  }
  /**
   * Follow someone. Returns 'pending' when they approve requests first.
   * Firestore rules must allow writing your own followerId only.
   */
  async follow(a: string, b: string): Promise<'accepted' | 'pending'> {
    const target = await this.user(b);
    const status: FollowEdge['status'] = target?.privacy?.requireFollowApproval ? 'pending' : 'accepted';
    const edge: FollowEdge = { id: `${a}__${b}`, followerId: a, followingId: b, at: Date.now(), status };
    await this.set(`follows/${edge.id}`, edge as unknown as Record<string, unknown>);
    return status;
  }
  async unfollow(a: string, b: string) { await this.remove(`follows/${a}__${b}`); }
  async followRequests(userId: string) {
    const all = await this.getList<FollowEdge>(this.col('follows'));
    return all
      .filter((e) => e.followingId === userId && e.status === 'pending')
      .sort((x, y) => y.at - x.at);
  }
  async respondFollowRequest(followerId: string, userId: string, accept: boolean) {
    const id = `${followerId}__${userId}`;
    if (!accept) { await this.remove(`follows/${id}`); return; }
    const snap = await this.q.getDoc(this.doc(`follows/${id}`));
    const edge = snap.data() as FollowEdge | undefined;
    if (!edge) return;
    await this.set(`follows/${id}`, { ...edge, status: 'accepted' } as unknown as Record<string, unknown>);
  }
  async followerCount(userId: string) {
    const all = await this.getList<FollowEdge>(this.col('follows'));
    return all.filter((e) => e.followingId === userId && e.status === 'accepted').length;
  }
  async followingCount(userId: string) {
    const all = await this.getList<FollowEdge>(this.col('follows'));
    return all.filter((e) => e.followerId === userId).length;
  }

  /* notifications */
  async notifications(userId: string) {
    return this.getList<Notification>(
      this.q.query(this.col(`notifications/${userId}/items`), this.q.orderBy('at', 'desc'), this.q.limit(100))
    );
  }
  async pushNotification(n: Notification) { await this.set(`notifications/${n.userId}/items/${n.id}`, n as unknown as Record<string, unknown>); }
  async markNotificationsRead(userId: string) {
    const items = await this.getList<Notification>(this.col(`notifications/${userId}/items`));
    for (const n of items) await this.set(`notifications/${userId}/items/${n.id}`, { ...n, read: true });
  }

  /* tips */
  async tips() { return this.getList<Tip>(this.col('tips')); }

  changes(): Observable<number> { return this.rx.asObservable(); }
}
