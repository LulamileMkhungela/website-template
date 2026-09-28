import {
  ChatMessage, ChatThread, Comment, FeedFilter, FollowEdge, Notification, Post, Spotlight, Story, Tip,
  UserProfile, defaultPrivacy
} from '../models/types';
import { seedComments, seedPosts, seedSpotlights, seedStories, seedTips, seedUsers } from './seed';

/**
 * Durable key/value store used by the mock data layer.
 * Tries localStorage first, falls back to memory (Safari private mode / SSR).
 */
export class KvStore {
  private memory = new Map<string, string>();
  /** false in Node / unit tests - everything then lives in memory for the session. */
  private readonly hasLs: boolean;

  constructor(private prefix: string) {
    this.hasLs = typeof localStorage !== 'undefined';
  }

  private k(key: string): string {
    return `${this.prefix}.${key}`;
  }

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.hasLs ? localStorage.getItem(this.k(key)) : (this.memory.get(this.k(key)) ?? null);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return this.memory.has(this.k(key)) ? (JSON.parse(this.memory.get(this.k(key))!) as T) : fallback;
    }
  }

  set(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    this.memory.set(this.k(key), raw);
    if (!this.hasLs) return;
    try {
      localStorage.setItem(this.k(key), raw);
    } catch {
      /* storage full or blocked - memory copy still works for this session */
    }
  }

  remove(key: string): void {
    this.memory.delete(this.k(key));
    if (!this.hasLs) return;
    try {
      localStorage.removeItem(this.k(key));
    } catch {
      /* ignore */
    }
  }

  clearAll(): void {
    this.memory.clear();
    if (!this.hasLs) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(this.prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    this.memory.clear();
  }
}

/**
 * Deep copy for anything that gets stored in a signal or handed to a component.
 * Signals compare by reference and callers mutate what they are given, so a
 * shallow copy is not enough for objects that hold arrays (memberIds, media,
 * voterIds...). A shared nested array is exactly how a UI ends up showing
 * stale or corrupted data.
 */
const clone = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);

export interface DbSnapshot {
  users: UserProfile[];
  posts: Post[];
  comments: Comment[];
  spotlights: Spotlight[];
  stories: Story[];
  threads: ChatThread[];
  messages: ChatMessage[];
  follows: FollowEdge[];
  notifications: Notification[];
  tips: Tip[];
}

const VERSION_KEY = 'seedVersion';
const SEED_VERSION = 8;
/** Live phones never load the old demo snapshot. Version 9 is an empty store. */
const LIVE_VERSION = 9;

export const emptyDb = (): DbSnapshot => ({
  users: [],
  posts: [],
  comments: [],
  spotlights: [],
  stories: [],
  threads: [],
  messages: [],
  follows: [],
  notifications: [],
  tips: []
});

/**
 * In-memory database with localStorage persistence.
 * Every mutating method returns a fresh array reference so signal-based
 * components re-render without change-detection gymnastics.
 */
export class LocalDb {
  private store = new KvStore('lulafind.db');
  private db: DbSnapshot;
  private rev = 0;
  private listeners = new Set<() => void>();
  /**
   * Tests pass true and still receive the fixture cases.
   * The running app passes false and starts empty. Fake people are not data.
   */
  private readonly seedDemo: boolean;

  constructor(reset = false) {
    this.seedDemo = reset;
    if (reset) this.store.clearAll();
    if (this.seedDemo) {
      const stored = this.store.get<DbSnapshot | null>('snapshot', null);
      const storedVersion = this.store.get<number>(VERSION_KEY, 0);
      if (stored && stored.users?.length && storedVersion === SEED_VERSION) {
        this.db = stored;
        this.migrate();
      } else {
        this.db = this.seed();
        this.store.set(VERSION_KEY, SEED_VERSION);
        this.persist();
      }
      return;
    }
    const stored = this.store.get<DbSnapshot | null>('snapshot', null);
    const storedVersion = this.store.get<number>(VERSION_KEY, 0);
    if (stored && storedVersion === LIVE_VERSION && !this.looksLikeDemo(stored)) {
      this.db = stored;
      this.migrate();
    } else {
      this.db = this.emptyLive();
      this.store.set(VERSION_KEY, LIVE_VERSION);
      this.persist();
    }
  }

  /** A leftover preview snapshot full of invented people must not come back. */
  private looksLikeDemo(stored: DbSnapshot): boolean {
    return (
      stored.users?.some((u) => u.id === 'u_demo') === true ||
      stored.posts?.some((p) => p.id === 'p_thato' || p.id === 'p_johan') === true
    );
  }

  /** Instructions stay. Invented cases, chats and accounts do not. */
  private emptyLive(): DbSnapshot {
    const db = emptyDb();
    db.tips = seedTips() as unknown as Tip[];
    return db;
  }

  /** Fill in fields added after a snapshot was first written. */
  private migrate(): void {
    let touched = false;
    for (const u of this.db.users) {
      if (!u.privacy) { u.privacy = defaultPrivacy(); touched = true; }
      if (u.isAdmin === undefined) { u.isAdmin = u.id === 'u_demo'; touched = true; }
      if (u.suspended === undefined) { u.suspended = false; touched = true; }
      if (u.checkIn === undefined) { u.checkIn = null; touched = true; }
      if (u.privacy && u.privacy.requireFollowApproval === undefined) {
        u.privacy.requireFollowApproval = false; touched = true;
      }
    }
    for (const e of this.db.follows) {
      if (!e.status) { e.status = 'accepted'; touched = true; }
    }
    for (const st of this.db.stories) {
      if (!st.audience) { st.audience = 'public'; st.spotlightId = null; touched = true; }
    }
    if (touched) this.persist();
  }

  private seed(): DbSnapshot {
    const db = emptyDb();
    db.users = seedUsers();
    db.posts = seedPosts();
    db.comments = seedComments();
    db.spotlights = seedSpotlights();
    db.stories = seedStories();
    db.tips = seedTips() as unknown as Tip[];

    // wire spotlights <-> posts
    for (const p of db.posts) {
      if (p.spotlightId) db.spotlights.find((s) => s.id === p.spotlightId)?.postIds.push(p.id);
      p.commentCount = db.comments.filter((c) => c.postId === p.id).length;
    }
    // demo demo user already votes on a couple of things so the UI shows states
    const demo = db.posts.find((p) => p.id === 'p_johan');
    if (demo) demo.voterIds['u_demo'] = 'up';
    // some follows so the demo user has a network
    const edges: [string, string][] = [
      ['u_demo', 'u_lerato'], ['u_demo', 'u_kabelo'], ['u_demo', 'u_sipho'], ['u_demo', 'u_ayanda'],
      ['u_lerato', 'u_demo'], ['u_kabelo', 'u_demo'], ['u_sipho', 'u_demo'], ['u_ayanda', 'u_demo'],
      ['u_naledi', 'u_demo'], ['u_pieter', 'u_demo']
    ];
    db.follows = edges.map(([a, b], i) => ({ id: `f${i}`, followerId: a, followingId: b, at: Date.now() - i * 86400000, status: 'accepted' as const }));

    // one existing thread with the demo user so chat isn't empty
    const t: ChatThread = {
      id: 'th_demo_c2',
      participantIds: ['u_demo', 'u_kabelo'],
      postId: 'p_thato',
      createdAt: Date.now() - 3600_000 * 5,
      lastMessageAt: Date.now() - 3600_000,
      unread: { u_demo: 1, u_kabelo: 0 },
      unlockedVia: 'vote'
    };
    db.threads = [t];
    db.messages = [
      { id: 'm_1', threadId: t.id, fromUserId: 'u_demo', body: 'Kabelo, thank you for the Quantum lead. Can you introduce me to the spaza owner?', at: Date.now() - 3600_000 * 5, read: true, kind: 'text', postId: 'p_thato' },
      { id: 'm_2', threadId: t.id, fromUserId: 'u_kabelo', body: 'Of course. She is wary of police so I will bring you. I am at the rank from 07:00 tomorrow.', at: Date.now() - 3600_000 * 4, read: true, kind: 'text' },
      { id: 'm_3', threadId: t.id, fromUserId: 'u_demo', body: 'I will be there. Should I bring the printed poster?', at: Date.now() - 3600_000 * 3, read: true, kind: 'text' },
      { id: 'm_4', threadId: t.id, fromUserId: 'u_kabelo', body: 'Yes - and the school photo, not the taxi rank one. She remembers faces, not places.', at: Date.now() - 3600_000, read: false, kind: 'text' }
    ];

    db.notifications = [
      {
        id: 'n1', userId: 'u_demo', kind: 'vote', title: 'Your case is trending in Gauteng',
        body: 'Help find Thato Mokoena has 412 upvotes and 187 shares.', at: Date.now() - 3600_000 * 2,
        read: false, route: '/post/p_thato', postId: 'p_thato'
      },
      {
        id: 'n2', userId: 'u_demo', kind: 'escalation', title: 'Station case number saved',
        body: 'ORL/441/09/2026. LulaFind did not send this case.', at: Date.now() - 3600_000 * 9,
        read: false, route: '/post/p_thato', postId: 'p_thato'
      },
      {
        id: 'n3', userId: 'u_demo', kind: 'comment', title: 'Kabelo Nkosi added a lead',
        body: 'White Quantum heading towards Roodepoort around 10:00 on Tuesday.', at: Date.now() - 3600_000 * 20,
        read: true, route: '/post/p_thato', postId: 'p_thato'
      },
      {
        id: 'n4', userId: 'u_demo', kind: 'follow', title: 'Naledi Dlamini started following you',
        body: 'Nurse. Missing-persons volunteer since 2019.', at: Date.now() - 3600_000 * 30,
        read: true, route: '/user/u_naledi', postId: null
      },
      {
        id: 'n5', userId: 'u_demo', kind: 'outcome', title: 'Did you get help?',
        body: 'Hendrik Botha has 189 upvotes. Let us know if he is home so we can stop the search.',
        at: Date.now() - 3600_000 * 1, read: false, route: '/post/p_johan', postId: 'p_johan'
      },
      {
        id: 'n6', userId: 'u_demo', kind: 'danger', title: 'Violence nearby',
        body: 'Bree taxi rank, north entrance, Johannesburg CBD. Stay away and do not approach.',
        at: Date.now() - 12 * 60_000, read: false, route: '/post/p_danger_bree', postId: 'p_danger_bree'
      }
    ];
    return db;
  }

  private persist(): void {
    this.rev++;
    this.store.set('snapshot', this.db);
    this.listeners.forEach((fn) => fn());
  }

  /** Subscribe to any data change. Returns an unsubscribe fn. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): DbSnapshot {
    return this.db;
  }

  revision(): number {
    return this.rev;
  }

  /* ------------------------- generic storage helpers ------------------------- */
  getAll<T>(collection: string): T[] {
    const dbAny = this.db as any;
    if (Array.isArray(dbAny[collection])) {
      return dbAny[collection].map((x: any) => clone(x));
    }
    return [];
  }

  getOne<T>(collection: string, id: string): T | undefined {
    const items = this.getAll<any>(collection);
    const item = items.find((x: any) => x && x.id === id);
    return item ? clone(item) : undefined;
  }

  saveOne<T extends { id: string }>(collection: string, item: T): void {
    const dbAny = this.db as any;
    if (!Array.isArray(dbAny[collection])) {
      dbAny[collection] = [];
    }
    const idx = dbAny[collection].findIndex((x: any) => x && x.id === item.id);
    if (idx !== -1) dbAny[collection][idx] = clone(item);
    else dbAny[collection].unshift(clone(item));
    this.persist();
  }

  deleteOne(collection: string, id: string): void {
    const dbAny = this.db as any;
    if (Array.isArray(dbAny[collection])) {
      dbAny[collection] = dbAny[collection].filter((x: any) => x && x.id !== id);
      this.persist();
    }
  }

  /* ------------------------- users ------------------------- */
  users(): UserProfile[] { return this.db.users.map((u) => clone(u)); }
  user(id: string): UserProfile | undefined {
    const u = this.db.users.find((x) => x.id === id);
    return u ? clone(u) : undefined;
  }
  userByHandle(handle: string): UserProfile | undefined {
    const h = handle.replace(/^@/, '').toLowerCase();
    return this.db.users.find((u) => u.handle.toLowerCase() === h);
  }
  upsertUser(u: UserProfile): void {
    const i = this.db.users.findIndex((x) => x.id === u.id);
    if (i >= 0) this.db.users[i] = u; else this.db.users.push(u);
    this.persist();
  }
  removeUser(id: string): void {
    this.db.users = this.db.users.filter((u) => u.id !== id);
    this.db.posts = this.db.posts.filter((p) => p.authorId !== id);
    this.persist();
  }

  /* ------------------------- posts ------------------------- */
  posts(): Post[] { return this.db.posts.map((p) => clone(p)); }
  post(id: string): Post | undefined {
    const p = this.db.posts.find((x) => x.id === id);
    return p ? clone(p) : undefined;
  }

  upsertPost(p: Post): void {
    const i = this.db.posts.findIndex((x) => x.id === p.id);
    if (i >= 0) this.db.posts[i] = p; else this.db.posts.unshift(p);
    this.persist();
  }
  deletePost(id: string): void {
    this.db.posts = this.db.posts.filter((p) => p.id !== id);
    this.db.comments = this.db.comments.filter((c) => c.postId !== id);
    for (const s of this.db.spotlights) s.postIds = s.postIds.filter((x) => x !== id);
    this.persist();
  }

  filtered(f: FeedFilter, viewerId: string | null, viewer: UserProfile | undefined): Post[] {
    const following = new Set(this.db.follows.filter((e) => e.followerId === viewerId && e.status === 'accepted').map((e) => e.followingId));
    let list = this.db.posts.slice();

    if (f.type !== 'all') list = list.filter((p) => p.type === f.type);
    if (f.province !== 'all') list = list.filter((p) => p.province === f.province);
    if (f.spotlightId) list = list.filter((p) => p.spotlightId === f.spotlightId);
    if (f.status === 'active') list = list.filter((p) => p.status === 'active' || p.status === 'under_review');
    if (f.status === 'found') list = list.filter((p) => p.status === 'found');

    if (f.query.trim()) {
      const q = f.query.trim().toLowerCase();
      list = list.filter((p) => {
        const author = this.user(p.authorId);
        return (
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.town.toLowerCase().includes(q) ||
          (p.subject?.name.toLowerCase().includes(q) ?? false) ||
          (p.subject?.surname.toLowerCase().includes(q) ?? false) ||
          (p.caseNumber?.toLowerCase().includes(q) ?? false) ||
          (author?.displayName.toLowerCase().includes(q) ?? false)
        );
      });
    }

    // audience enforcement
    list = list.filter((p) => {
      if (p.authorId === viewerId) return true;
      if (p.audience === 'public') return true;
      if (p.audience === 'followers') return following.has(p.authorId);
      if (p.audience === 'surname') {
        if (!p.spotlightId) return false;
        const sp = this.spotlight(p.spotlightId);
        return !!sp && (!viewer?.surname || sp.surname.toLowerCase() === viewer.surname.toLowerCase() || sp.memberIds.includes(viewerId ?? ''));
      }
      return true;
    });

    switch (f.sort) {
      case 'hot':
        list.sort((a, b) => this.score(b) - this.score(a));
        break;
      case 'oldest':
        list.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'nearby':
        list.sort((a, b) => (a.province === viewer?.province ? -1 : 0) - (b.province === viewer?.province ? -1 : 0));
        break;
      default:
        list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }

  private score(p: Post): number {
    const ageH = Math.max(1, (Date.now() - p.createdAt) / 3600_000);
    return (p.upvotes * 3 + p.commentCount * 5 + p.shares * 2) / Math.pow(ageH, 0.55);
  }

  /* ------------------------- comments ------------------------- */
  comments(): Comment[] { return this.db.comments.map((c) => clone(c)); }
  commentsFor(postId: string): Comment[] {
    return this.db.comments.filter((c) => c.postId === postId).sort((a, b) => b.upvotes - a.upvotes || a.createdAt - b.createdAt).map((c) => clone(c));
  }
  upsertComment(c: Comment): void {
    const i = this.db.comments.findIndex((x) => x.id === c.id);
    if (i >= 0) this.db.comments[i] = c; else this.db.comments.push(c);
    this.persist();
  }
  deleteComment(id: string): void {
    this.db.comments = this.db.comments.filter((c) => c.id !== id && c.parentId !== id);
    this.persist();
  }

  /* ------------------------- spotlights ------------------------- */
  spotlights(): Spotlight[] { return this.db.spotlights.map((s) => clone(s)); }
  spotlight(id: string): Spotlight | undefined {
    const sp = this.db.spotlights.find((x) => x.id === id);
    return sp ? clone(sp) : undefined;
  }
  upsertSpotlight(s: Spotlight): void {
    const i = this.db.spotlights.findIndex((x) => x.id === s.id);
    if (i >= 0) this.db.spotlights[i] = s; else this.db.spotlights.push(s);
    this.persist();
  }

  deleteSpotlight(id: string): void {
    this.db.spotlights = this.db.spotlights.filter((s) => s.id !== id);
    this.persist();
  }

  /* ------------------------- stories ------------------------- */
  stories(): Story[] {
    const now = Date.now();
    return this.db.stories.filter((s) => s.expiresAt > now).map((s) => clone(s));
  }
  story(id: string): Story | undefined {
    const st = this.db.stories.find((x) => x.id === id && x.expiresAt > Date.now());
    return st ? clone(st) : undefined;
  }
  upsertStory(s: Story): void {
    const i = this.db.stories.findIndex((x) => x.id === s.id);
    if (i >= 0) this.db.stories[i] = s; else this.db.stories.unshift(s);
    this.persist();
  }

  /* ------------------------- chat ------------------------- */
  threads(): ChatThread[] { return this.db.threads.map((t) => clone(t)); }
  thread(id: string): ChatThread | undefined {
    const t = this.db.threads.find((x) => x.id === id);
    return t ? clone(t) : undefined;
  }
  threadsFor(userId: string): ChatThread[] {
    return this.db.threads.filter((t) => t.participantIds.includes(userId)).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }
  upsertThread(t: ChatThread): void {
    const i = this.db.threads.findIndex((x) => x.id === t.id);
    if (i >= 0) this.db.threads[i] = t; else this.db.threads.push(t);
    this.persist();
  }
  messages(threadId: string): ChatMessage[] {
    return this.db.messages.filter((m) => m.threadId === threadId).sort((a, b) => a.at - b.at).map((m) => clone(m));
  }
  upsertMessage(m: ChatMessage): void {
    this.db.messages.push(m);
    const t = this.thread(m.threadId);
    if (t) {
      t.lastMessageAt = m.at;
      t.unread = { ...t.unread };
      for (const pid of t.participantIds) {
        if (pid !== m.fromUserId) t.unread[pid] = (t.unread[pid] ?? 0) + 1;
      }
    }
    this.persist();
  }
  markThreadRead(threadId: string, userId: string): void {
    const t = this.thread(threadId);
    if (!t) return;
    t.unread = { ...t.unread, [userId]: 0 };
    for (const m of this.db.messages) if (m.threadId === threadId && m.fromUserId !== userId) m.read = true;
    this.persist();
  }

  /* ------------------------- follows ------------------------- */
  follows(): FollowEdge[] { return this.db.follows.map((f) => clone(f)); }
  /** Only accepted edges count as followers / following. */
  followersOf(userId: string): FollowEdge[] {
    return this.db.follows.filter((e) => e.followingId === userId && e.status === 'accepted');
  }
  followingOf(userId: string): FollowEdge[] {
    return this.db.follows.filter((e) => e.followerId === userId && e.status === 'accepted');
  }
  /** Requests waiting on this person's decision, newest first. */
  followRequestsFor(userId: string): FollowEdge[] {
    return this.db.follows
      .filter((e) => e.followingId === userId && e.status === 'pending')
      .sort((a, b) => b.at - a.at)
      .map((e) => clone(e));
  }
  /** Is there any edge at all, pending or accepted? Stops duplicate requests. */
  hasFollowEdge(a: string, b: string): boolean {
    return this.db.follows.some((e) => e.followerId === a && e.followingId === b);
  }
  isFollowing(a: string, b: string): boolean {
    return this.db.follows.some((e) => e.followerId === a && e.followingId === b && e.status === 'accepted');
  }
  followStatus(a: string, b: string): FollowEdge['status'] | null {
    return this.db.follows.find((e) => e.followerId === a && e.followingId === b)?.status ?? null;
  }
  setFollowStatus(a: string, b: string, status: FollowEdge['status']): void {
    const e = this.db.follows.find((x) => x.followerId === a && x.followingId === b);
    if (e) { e.status = status; this.persist(); }
  }
  upsertFollow(edge: FollowEdge | null): void {
    if (!edge) return;
    if (!this.hasFollowEdge(edge.followerId, edge.followingId)) this.db.follows.push(edge);
    this.persist();
  }
  removeFollow(a: string, b: string): void {
    this.db.follows = this.db.follows.filter((e) => !(e.followerId === a && e.followingId === b));
    this.persist();
  }

  /* ------------------------- notifications ------------------------- */
  notifications(userId: string): Notification[] {
    return this.db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.at - a.at).map((n) => clone(n));
  }
  pushNotification(n: Notification): void {
    this.db.notifications.unshift(n);
    this.persist();
  }
  markNotificationsRead(userId: string): void {
    for (const n of this.db.notifications) if (n.userId === userId) n.read = true;
    this.persist();
  }

  /* ------------------------- tips ------------------------- */
  tips(): Tip[] { return this.db.tips.map((t) => clone(t)); }

  /* ------------------------- reset ------------------------- */
  reset(): void {
    this.db = this.seedDemo ? this.seed() : this.emptyLive();
    this.persist();
  }
}
