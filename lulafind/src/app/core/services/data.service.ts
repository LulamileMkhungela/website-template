import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { LULA_API, LulaApi } from '../data/api';
import {
  Audience, Comment, DangerAlert, FeedFilter, FollowEdge, Notification, Post, PostType, Spotlight, Story, StoryReply, StoryView, Tip, UserProfile,
  VoteValue, VehicleDetails, dangerLabel, emptyFilter, provinceName
} from '../models/types';
import { avatar, cover, hueOf, scene } from '../data/seed';
import { HOUR, DAY, compact, uid } from '../utils/format';
import { AuthService } from './auth.service';
import { SUPPORT_EMAIL } from '../config';

/** The subset of a post its author (or an admin) may change after publishing. */
export interface UpdatePostInput {
  title?: string;
  body?: string;
  media?: Post['media'];
  province?: Post['province'];
  town?: string;
  lastSeenAt?: number | null;
  lastSeenWhere?: string;
  geo?: Post['geo'];
  contactLabel?: string;
  contactValue?: string;
  contactVisibleTo?: Post['contactVisibleTo'];
  caseNumber?: string | null;
  reward?: string | null;
  subject?: Post['subject'];
  vehicleDetails?: VehicleDetails | null;
  audience?: Post['audience'];
  spotlightId?: string | null;
  chatEnabled?: boolean;
  allowComments?: boolean;
  anonymous?: boolean;
  askWanted?: boolean;
  khumbu?: Post['khumbu'];
  danger?: Post['danger'];
}

export interface CreatePostInput {
  type: PostType;
  title: string;
  body: string;
  media: Post['media'];
  province: Post['province'];
  town: string;
  lastSeenAt: number | null;
  lastSeenWhere: string;
  geo: Post['geo'];
  contactLabel: string;
  contactValue: string;
  contactVisibleTo: Post['contactVisibleTo'];
  caseNumber: string | null;
  reward: string | null;
  subject: Post['subject'];
  vehicleDetails?: VehicleDetails | null;
  audience: Post['audience'];
  spotlightId: string | null;
  chatEnabled: boolean;
  allowComments: boolean;
  anonymous: boolean;
  askWanted: boolean;
  khumbu: Post['khumbu'];
  danger?: DangerAlert | null;
}

/**
 * The heart of the app. Everything the feed, post detail, spotlight, stories,
 * follows, voting and consent flows need goes through here so that swapping
 * mock -> Firestore never touches a component.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private api = inject(LULA_API);
  private auth = inject(AuthService);

  /* --------------------------- state --------------------------- */
  readonly filter = signal<FeedFilter>(emptyFilter());
  readonly feed = signal<Post[]>([]);
  /** Found cases matching the current type and province. Shown on the newsfeed, not only behind the Found filter. */
  readonly broughtHome = signal<Post[]>([]);
  readonly loading = signal(false);
  readonly spotlights = signal<Spotlight[]>([]);
  readonly stories = signal<Story[]>([]);
  readonly tips = signal<Tip[]>([]);
  readonly notifications = signal<Notification[]>([]);
  readonly savedIds = signal<string[]>([]);
  /** Posts the user tapped "Don't want to see this" on. Per device, per account. */
  readonly hiddenIds = signal<string[]>([]);
  readonly followingIds = signal<string[]>([]);
  /** people who follow the signed-in account */
  readonly followerIds = signal<string[]>([]);

  readonly unreadNotifications = computed(() => this.notifications().filter((n) => !n.read).length);
  readonly myPosts = computed(() => this.feed().filter((p) => p.authorId === this.auth.viewerId));
  readonly activeMissingCount = computed(
    () => this.feed().filter((p) => p.type === 'missing' && p.status === 'active').length
  );

  /** Post cache keyed by id so detail pages and cards stay consistent. */
  readonly cache = signal<Record<string, Post>>({});

  /** User cache so cards can render author names/avatars without N queries. */
  readonly authors = signal<Record<string, UserProfile>>({});

  readonly authorOf = (id: string): UserProfile | undefined => this.authors()[id];

  /** Push a freshly saved profile into the author cache so cards update at once. */
  touchAuthor(u: UserProfile): void {
    this.authors.set({ ...this.authors(), [u.id]: u });
  }

  /** True when the signed-in person may edit or remove this post. */
  canEdit(p: Post | null | undefined): boolean {
    if (!p) return false;
    const me = this.auth.user();
    if (!me) return false;
    return p.authorId === me.id || me.isAdmin === true;
  }

  private changeSub: Subscription | null = null;

  constructor() {
    this.auth.attachApi(this.api);
    // Any write anywhere in the data layer re-queries the feed and refreshes the
    // cache, so cards, detail pages and counters can never disagree.
    this.changeSub = this.api.changes().subscribe(() => {
      void this.loadFeed();
      if (this.auth.viewerId) void this.loadUserScoped();
      void this.loadStatic();
    });
    effect(() => {
      // reload whenever the viewer or any filter value changes
      const f = this.filter();
      const uid_ = this.auth.user()?.id ?? null;
      void this.loadFeed(f, uid_);
    });
    effect(() => {
      // a different account has its own hidden-post list
      this.loadViewerPrefs();
      if (this.auth.user()?.id) void this.loadUserScoped();
      void this.loadFeed();
    });
  }

  changes() {
    return toObservable(this.feed);
  }

  /* ------------------------- auto-sync ------------------------- */
  private poll: ReturnType<typeof setInterval> | null = null;

  /**
   * Pull the latest posts on a timer so a phone left open on the feed keeps
   * showing new cases. In Firebase mode this is where the onSnapshot listener
   * goes; the rest of the app does not change.
   */
  startAutoSync(everyMs = 45_000): void {
    if (this.poll) return;
    this.poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void this.loadFeed();
      void this.loadStatic();
    }, everyMs);
  }

  stopAutoSync(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  /** Stop reacting to data-layer changes (used when tearing the app down). */
  dispose(): void {
    this.changeSub?.unsubscribe();
    this.changeSub = null;
    this.stopAutoSync();
  }

  /* --------------------------- feed ---------------------------- */
  async loadFeed(f: FeedFilter = this.filter(), viewerId: string | null = this.auth.viewerId): Promise<Post[]> {
    this.loading.set(true);
    try {
      const list = await this.api.queryFeed(f, viewerId);
      const hidden = this.hiddenIds();
      const visible = hidden.length ? list.filter((p) => !hidden.includes(p.id)) : list;
      this.feed.set(visible);
      this.mergeCache(list);
      if (f.status === 'found') {
        this.broughtHome.set(visible);
      } else {
        const found = await this.api.queryFeed({ ...f, status: 'found' }, viewerId);
        const shown = (hidden.length ? found.filter((p) => !hidden.includes(p.id)) : found)
          .sort((a, b) => (b.outcome?.foundAt ?? b.updatedAt) - (a.outcome?.foundAt ?? a.updatedAt));
        this.broughtHome.set(shown);
        this.mergeCache(found);
      }
      return visible;
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(patch: Partial<FeedFilter>): void {
    this.filter.set({ ...this.filter(), ...patch });
  }

  resetFilter(): void {
    this.filter.set(emptyFilter());
  }

  /**
   * Put a freshly saved post straight into the cache. Every service that writes
   * a post must call this, otherwise the feed and the detail page can disagree
   * until the next re-query lands.
   */
  touch(post: Post): void {
    this.cache.set({ ...this.cache(), [post.id]: post });
  }

  private mergeCache(posts: Post[]): void {
    const next = { ...this.cache() };
    for (const p of posts) next[p.id] = p;
    this.cache.set(next);
    void this.cacheAuthors(posts.map((p) => p.authorId));
  }

  private async cacheAuthors(ids: string[]): Promise<void> {
    const missing = [...new Set(ids.filter(Boolean))].filter((id) => !this.authors()[id]);
    if (!missing.length) return;
    const found: Record<string, UserProfile> = {};
    for (const id of missing) {
      const u = await this.api.user(id);
      if (u) found[id] = u;
    }
    this.authors.set({ ...this.authors(), ...found });
  }

  post(id: string): Post | undefined {
    return this.cache()[id] ?? this.feed().find((p) => p.id === id);
  }

  async loadPost(id: string): Promise<Post | undefined> {
    const p = await this.api.post(id);
    if (p) {
      p.commentCount = (await this.api.commentsFor(id)).length;
      this.mergeCache([p]);
    }
    return p;
  }

  async refresh(): Promise<void> {
    await Promise.all([this.loadFeed(), this.loadUserScoped(), this.loadStatic()]);
  }

  async loadStatic(): Promise<void> {
    const [spots, rawStories, tips] = await Promise.all([this.api.spotlights(), this.api.stories(), this.api.tips()]);
    this.spotlights.set(spots);
    const me = this.auth.viewerId;
    const stories = await Promise.all(rawStories.map(async (story) => {
      const [views, replies] = await Promise.all([
        this.api.storyViewsFor(story.id),
        story.authorId === me ? this.api.storyRepliesFor(story.id) : Promise.resolve([] as StoryReply[])
      ]);
      const isOwner = story.authorId === me;
      // Older rows may have embedded projections; current Supabase records keep
      // replies/views in private collections, so these fields can be absent.
      const legacyViewers = story.viewers ?? [];
      const legacyReplies = story.replies ?? [];
      const viewerIds = isOwner
        ? [...new Set([...legacyViewers, ...views.map((view) => view.viewerId)])]
        : me && views.some((view) => view.viewerId === me) ? [me] : [];
      const replyMap = new Map([...legacyReplies, ...replies].map((reply) => [reply.id, reply]));
      return {
        ...story,
        viewers: viewerIds,
        replies: isOwner ? [...replyMap.values()].sort((a, b) => a.at - b.at) : []
      };
    }));
    this.stories.set(stories);
    this.tips.set(tips);
    void this.cacheAuthors(stories.flatMap((story) => [
      ...(story.replies ?? []).map((reply) => reply.authorId), ...(story.viewers ?? [])
    ]));
  }

  async loadUserScoped(): Promise<void> {
    const id = this.auth.viewerId;
    if (!id) {
      this.notifications.set([]);
      this.followingIds.set([]);
      this.followerIds.set([]);
      this.followRequests.set([]);
      return;
    }
    const [notes, following, followers, requests] = await Promise.all([
      this.api.notifications(id),
      this.api.followsFor(id, 'following'),
      this.api.followsFor(id, 'followers'),
      this.api.followRequests(id)
    ]);
    this.notifications.set(notes);
    this.followingIds.set(following.map((edge) => edge.followingId));
    this.followerIds.set(followers.map((edge) => edge.followerId));
    this.followRequests.set(requests);
    void this.loadStatic();
  }

  /* ------------------------- voting ---------------------------- */
  async vote(postId: string, value: Exclude<VoteValue, null>): Promise<Post | undefined> {
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in to vote');
    if (this.auth.user()?.suspended) throw new Error('Your account is suspended');
    const p = await this.loadPost(postId);
    if (!p) return undefined;
    const current = p.voterIds[me] ?? null;
    const next = current === value ? null : value;

    const nextPost: Post = {
      ...p,
      voterIds: { ...p.voterIds, [me]: next },
      upvotes: p.upvotes + (next === 'up' ? 1 : 0) - (current === 'up' ? 1 : 0),
      downvotes: p.downvotes + (next === 'down' ? 1 : 0) - (current === 'down' ? 1 : 0)
    };
    await this.api.savePost(nextPost);
    this.mergeCache([nextPost]);
    await this.loadFeed();
    return nextPost;
  }

  myVote(p: Post): VoteValue {
    const me = this.auth.viewerId;
    return (me ? p.voterIds[me] : null) ?? null;
  }

  /* ------------------------ comments --------------------------- */
  async comments(postId: string): Promise<Comment[]> {
    return this.api.commentsFor(postId);
  }

  async addComment(input: {
    postId: string;
    body: string;
    parentId?: string | null;
    isLead?: boolean;
    sighting?: Comment['sighting'];
    markGuess?: string;
  }): Promise<Comment> {
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in to comment');
    if (this.auth.user()?.suspended) throw new Error('Your account is suspended');
    const c: Comment = {
      id: uid('c'),
      postId: input.postId,
      parentId: input.parentId ?? null,
      authorId: me,
      body: input.body.trim(),
      createdAt: Date.now(),
      upvotes: 0,
      isLead: input.isLead ?? false,
      sighting: input.sighting,
      markGuess: input.markGuess || undefined
    };
    await this.api.saveComment(c);
    const p = await this.loadPost(input.postId);
    if (p) {
      const next = { ...p, commentCount: (await this.api.commentsFor(p.id)).length, updatedAt: Date.now() };
      await this.api.savePost(next);
      this.mergeCache([next]);
    }
    if (p && p.authorId !== me) {
      await this.api.pushNotification({
        id: uid('n'),
        userId: p.authorId,
        kind: input.isLead ? 'vote' : 'comment',
        title: `${input.isLead ? 'New lead on' : 'Comment on'} your post`,
        body: c.body.slice(0, 110),
        at: Date.now(),
        read: false,
        route: `/post/${p.id}`,
        postId: p.id
      });
    }
    await this.loadFeed();
    return c;
  }

  /**
   * Family-only check: confirm or reject a mark (physical description detail)
   * that a commenter named on a lead. The result becomes public so searchers
   * know whether this lead matched; the actual words stay private.
   */
  async checkLeadMark(c: Comment, result: 'match' | 'no'): Promise<void> {
    const p = this.cache()[c.postId] ?? (await this.api.post(c.postId));
    if (!p) throw new Error('That post is not here any more');
    if (!this.canEdit(p)) throw new Error('Only the poster can check a mark');
    await this.api.saveComment({ ...c, markCheck: result });
  }

  /** Quora-style comment upvote - toggles so a second tap removes it. */
  async voteComment(c: Comment): Promise<Comment> {
    const next: Comment = { ...c, upvotes: c.upvotes + 1 };
    await this.api.saveComment(next);
    return next;
  }

  async deleteComment(c: Comment): Promise<void> {
    await this.api.deleteComment(c.id, c.postId);
    const p = await this.loadPost(c.postId);
    if (p) {
      const next = { ...p, commentCount: Math.max(0, p.commentCount - 1) };
      await this.api.savePost(next);
      this.mergeCache([next]);
    }
  }

  /* ------------------------- posting --------------------------- */
  async createPost(input: CreatePostInput): Promise<Post> {
    const me = this.auth.user();
    if (!me) throw new Error('Sign in to post');
    if (me.suspended) throw new Error(`Your account is suspended. Contact ${SUPPORT_EMAIL} if you think this is a mistake.`);
    if (input.title.trim().length < 8) throw new Error('Give your post a clear title (at least 8 characters)');
    if (input.body.trim().length < 30) throw new Error('Describe what happened in detail - at least 30 characters. Details save lives.');
    if (!input.province) throw new Error('Choose the province where this happened');
    if (input.type !== 'story' && !input.town.trim()) throw new Error('Choose the town or suburb where this happened');
    if (input.type === 'danger' && !input.lastSeenWhere.trim()) throw new Error('Say the place where you saw this');
    if (input.type === 'danger' && !input.danger?.kind) throw new Error('Choose what kind of danger you saw');
    if (input.type === 'khumbulekhaya' && !input.khumbu) throw new Error('Add the basic details about when they left home');
    if (input.audience === 'surname' && !input.spotlightId) throw new Error('Choose which Spotlight community should see this');
    if (input.media.length > 1 && input.media.some((m) => m.kind === 'video')) {
      throw new Error('Choose photos or one video - not both');
    }

    const media = await Promise.all(input.media.map((item) => this.api.uploadMedia(me.id, item)));
    const now = Date.now();
    const post: Post = {
      id: uid('p'),
      type: input.type,
      status: input.type === 'missing' && (input.subject?.age ?? 99) < 18 ? 'under_review' : 'active',
      authorId: me.id,
      anonymous: input.anonymous,
      askWanted: input.askWanted,
      title: input.title.trim(),
      body: input.body.trim(),
      media,
      province: input.province,
      town: input.town.trim(),
      lastSeenAt: input.lastSeenAt,
      lastSeenWhere: input.lastSeenWhere.trim(),
      geo: input.geo,
      contactLabel: input.contactLabel,
      contactValue: input.contactValue.trim(),
      contactVisibleTo: input.contactVisibleTo,
      caseNumber: input.caseNumber?.trim() || null,
      reward: input.reward?.trim() || null,
      createdAt: now,
      updatedAt: now,
      subject: input.type === 'vehicle' ? null : input.subject,
      vehicleDetails: input.type === 'vehicle' ? input.vehicleDetails ?? null : null,
      audience: input.audience,
      spotlightId: input.spotlightId,
      chatEnabled: input.chatEnabled,
      allowComments: input.allowComments,
      allowShare: true,
      upvotes: 0,
      downvotes: 0,
      commentCount: 0,
      shares: 0,
      views: 0,
      savedBy: 0,
      voterIds: {},
      escalation: { requested: false, consentGranted: false, consentAt: null, partners: [] },
      consent: [],
      sightingVerified: null,
      searchParty: null,
      locationCheck: {
        subjectRegisteredInApp: false,
        requestedBy: null,
        requestedAt: null,
        consentFromSubject: 'none',
        consentAt: null,
        points: [],
        deviceReachable: false,
        lastKnownAt: null,
        note: ''
      },
      khumbu: input.khumbu,
      danger: input.type === 'danger'
        ? { kind: input.danger!.kind, stillIds: [], clearIds: [], clearedAt: null }
        : null,
      outcome: { found: false, foundAt: null, whereaboutsFound: '', closedBy: null, note: '' },
      events: [{ at: now, kind: 'claimed', byUserId: me.id, note: input.type === 'danger' ? 'Danger alert posted' : input.anonymous ? 'Anonymous post - identity verified privately' : 'Posted by family/close contact' }],
      flags: [],
      outcomeNudgeAt: null
    };
    await this.api.savePost(post);
    if (post.type === 'danger') await this.alertProvince(post);
    if (post.spotlightId) {
      const sp = await this.api.spotlight(post.spotlightId);
      if (sp) await this.api.saveSpotlight({ ...sp, postIds: [...new Set([post.id, ...sp.postIds])] });
    }
    this.mergeCache([post]);
    await this.loadFeed();
    return post;
  }

  /**
   * Edit a published post. Only the author or an admin may call this - votes,
   * escalation, consent and outcome are deliberately not editable.
   */
  async updatePost(id: string, patch: UpdatePostInput): Promise<Post | undefined> {
    const me = this.auth.user();
    const p = await this.loadPost(id);
    if (!me || !p) throw new Error('That post is not here any more');
    if (p.authorId !== me.id && me.isAdmin !== true) throw new Error('Only the person who posted this can edit it');

    if (patch.title !== undefined && patch.title.trim().length < 8) {
      throw new Error('The title must be at least 8 characters');
    }
    if (patch.body !== undefined && patch.body.trim().length < 30) {
      throw new Error('The description must be at least 30 characters');
    }
    if (patch.province !== undefined && !patch.province) throw new Error('Choose a province');
    const media = patch.media
      ? await Promise.all(patch.media.map((item) => this.api.uploadMedia(me.id, item)))
      : p.media;

    const next: Post = {
      ...p,
      title: patch.title !== undefined ? patch.title.trim() : p.title,
      body: patch.body !== undefined ? patch.body.trim() : p.body,
      media,
      province: patch.province ?? p.province,
      town: patch.town !== undefined ? patch.town.trim() : p.town,
      lastSeenAt: patch.lastSeenAt !== undefined ? patch.lastSeenAt : p.lastSeenAt,
      lastSeenWhere: patch.lastSeenWhere !== undefined ? patch.lastSeenWhere.trim() : p.lastSeenWhere,
      geo: patch.geo !== undefined ? patch.geo : p.geo,
      contactLabel: patch.contactLabel ?? p.contactLabel,
      contactValue: patch.contactValue !== undefined ? patch.contactValue.trim() : p.contactValue,
      contactVisibleTo: patch.contactVisibleTo ?? p.contactVisibleTo,
      caseNumber: patch.caseNumber !== undefined ? patch.caseNumber?.trim() || null : p.caseNumber,
      reward: patch.reward !== undefined ? patch.reward?.trim() || null : p.reward,
      subject: patch.subject !== undefined ? patch.subject : p.subject,
      vehicleDetails: patch.vehicleDetails !== undefined ? patch.vehicleDetails : p.vehicleDetails ?? null,
      audience: patch.audience ?? p.audience,
      spotlightId: patch.spotlightId !== undefined ? patch.spotlightId : p.spotlightId,
      chatEnabled: patch.chatEnabled ?? p.chatEnabled,
      allowComments: patch.allowComments ?? p.allowComments,
      anonymous: patch.anonymous ?? p.anonymous,
      askWanted: patch.askWanted ?? p.askWanted,
      khumbu: patch.khumbu !== undefined ? patch.khumbu : p.khumbu,
      danger: patch.danger !== undefined ? patch.danger : p.danger,
      updatedAt: Date.now()
    };

    await this.api.savePost(next);

    // keep the community's post list in step when the spotlight changed
    const before = p.spotlightId;
    const after = next.spotlightId;
    if (before && before !== after) {
      const sp = await this.api.spotlight(before);
      if (sp) await this.api.saveSpotlight({ ...sp, postIds: sp.postIds.filter((x) => x !== next.id) });
    }
    if (after) {
      const sp = await this.api.spotlight(after);
      if (sp) await this.api.saveSpotlight({ ...sp, postIds: [...new Set([next.id, ...sp.postIds])] });
    }

    this.mergeCache([next]);
    await this.loadStatic();
    await this.loadFeed();
    return next;
  }

  async deletePost(id: string): Promise<void> {
    await this.api.deletePost(id);
    await this.loadFeed();
  }

  async registerView(postId: string): Promise<void> {
    const p = await this.loadPost(postId);
    if (!p) return;
    const next = { ...p, views: p.views + 1 };
    await this.api.savePost(next);
    this.mergeCache([next]);
  }

  async recordShare(postId: string): Promise<void> {
    const p = await this.loadPost(postId);
    if (!p) return;
    const next = { ...p, shares: p.shares + 1 };
    await this.api.savePost(next);
    this.mergeCache([next]);
    await this.loadFeed();
  }

  /* ------------------------- saved ----------------------------- */
  async toggleSaved(postId: string): Promise<boolean> {
    const has = this.savedIds().includes(postId);
    this.savedIds.set(has ? this.savedIds().filter((x) => x !== postId) : [...this.savedIds(), postId]);
    return !has;
  }

  /** localStorage key for "don't want to see this", scoped per account. */
  private get hiddenKey(): string {
    return `lulafind.hidden.${this.auth.viewerId ?? 'anon'}`;
  }

  private persistViewerPrefs(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.hiddenKey, JSON.stringify(this.hiddenIds()));
    } catch { /* private mode / full quota - the choice lasts for this session only */ }
  }

  /** Restore this account's hidden posts. Called when the viewer changes. */
  private loadViewerPrefs(): void {
    try {
      if (typeof localStorage === 'undefined') { this.hiddenIds.set([]); return; }
      const raw = localStorage.getItem(this.hiddenKey);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      this.hiddenIds.set(Array.isArray(list) ? list : []);
    } catch {
      this.hiddenIds.set([]);
    }
  }

  /**
   * "Don't want to see this." The post is dropped from this device's feed.
   * Nothing is reported and the poster is not told - this is a personal filter,
   * not moderation. Undo is offered by the caller.
   */
  async hidePost(postId: string): Promise<void> {
    if (this.hiddenIds().includes(postId)) return;
    this.hiddenIds.set([...this.hiddenIds(), postId]);
    this.feed.set(this.feed().filter((p) => p.id !== postId));
    this.persistViewerPrefs();
  }

  async unhidePost(postId: string): Promise<void> {
    if (!this.hiddenIds().includes(postId)) return;
    this.hiddenIds.set(this.hiddenIds().filter((x) => x !== postId));
    this.persistViewerPrefs();
    await this.loadFeed();
  }

  /* ------------------------ following -------------------------- */
  async followStatus(targetId: string): Promise<'accepted' | 'pending' | null> {
    const me = this.auth.viewerId;
    if (!me || me === targetId) return null;
    return this.api.followStatus(me, targetId);
  }

  async isFollowing(targetId: string): Promise<boolean> {
    const me = this.auth.viewerId;
    if (!me || me === targetId) return false;
    return this.api.isFollowing(me, targetId);
  }

  async toggleFollow(targetId: string): Promise<boolean> {
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in to follow');
    if (me === targetId) throw new Error('You cannot follow yourself');
    if (this.auth.user()?.suspended) throw new Error('Your account is suspended');
    const existing = await this.api.followStatus(me, targetId);
    if (existing === 'accepted') {
      await this.api.unfollow(me, targetId);
      this.followingIds.set(this.followingIds().filter((x) => x !== targetId));
      return false;
    }
    if (existing === 'pending') {
      await this.api.unfollow(me, targetId);
      return false;
    }
    const outcome = await this.api.follow(me, targetId);
    if (outcome === 'pending') {
      // They approve requests first. Nothing counts until they say yes.
      await this.api.pushNotification({
        id: uid('n'), userId: targetId, kind: 'follow',
        title: 'New follow request',
        body: `${this.auth.user()?.displayName ?? 'Someone'} asked to follow you.`,
        at: Date.now(), read: false, route: '/me', postId: null
      });
      return false;
    }
    this.followingIds.set([...new Set([...this.followingIds(), targetId])]);
    await this.api.pushNotification({
      id: uid('n'),
      userId: targetId,
      kind: 'follow',
      title: `${this.auth.user()?.displayName ?? 'Someone'} started following you`,
      body: 'Tap to view their profile.',
      at: Date.now(),
      read: false,
      route: `/user/${me}`,
      postId: null
    });
    return true;
  }

  async mutualFollow(otherId: string): Promise<boolean> {
    const me = this.auth.viewerId;
    if (!me) return false;
    return (await this.api.isFollowing(me, otherId)) && (await this.api.isFollowing(otherId, me));
  }

  /* ------------------------ spotlights ------------------------- */
  async createSpotlight(input: { surname: string; tagline: string; about: string; province: Spotlight['province'] }): Promise<Spotlight> {
    const me = this.auth.user();
    if (!me) throw new Error('Sign in to create a spotlight');
    const surname = input.surname.trim().replace(/\s+/g, ' ');
    if (surname.length < 2) throw new Error('Enter a surname (at least 2 letters)');
    if (!/^[a-zA-Z'\-\s]+$/.test(surname)) throw new Error('A surname can only contain letters');
    if (!input.province) throw new Error('Choose the province this community belongs to');
    const all = await this.api.spotlights();
    const sameName = all.filter((s) => s.surname.toLowerCase() === surname.toLowerCase());
    if (sameName.some((s) => s.province === input.province)) {
      throw new Error(
        `A "${surname}" spotlight already exists in ${provinceName(input.province)}. ` +
        `Join that one instead of creating a second.`
      );
    }
    const sp: Spotlight = {
      id: uid('sp'),
      surname,
      tagline: input.tagline.trim() || `The ${surname} community on LulaFind`,
      coverHue: hueOf(surname),
      ownerId: me.id,
      adminIds: [me.id],
      memberIds: [me.id],
      postIds: [],
      followers: 1,
      province: input.province ?? me.province,
      verified: false,
      createdAt: Date.now(),
      about: input.about.trim()
    };
    await this.api.saveSpotlight(sp);
    await this.loadStatic();
    await this.loadFeed();
    return sp;
  }

  /**
   * Joining is instant - no admin approval. Anyone may join any community and
   * post to it straight away. Returns false if they were already a member.
   */
  async joinSpotlight(id: string): Promise<boolean> {
    const me = this.auth.user();
    const sp = await this.api.spotlight(id);
    if (!me || !sp) throw new Error('That community is not here any more');
    if (me.suspended) throw new Error('Your account is suspended, so you cannot join communities');
    if (sp.memberIds.includes(me.id)) return false;
    const joined = await this.api.setSpotlightMembership(id, me.id, true);
    if (!joined) throw new Error('That community is not here any more');
    await this.loadStatic();
    return true;
  }

  async leaveSpotlight(id: string): Promise<void> {
    const me = this.auth.viewerId;
    const sp = await this.api.spotlight(id);
    if (!me || !sp || !sp.memberIds.includes(me)) return;
    if (sp.ownerId === me) throw new Error('You created this community. Delete it instead of leaving.');
    const left = await this.api.setSpotlightMembership(id, me, false);
    if (!left) return;
    await this.loadStatic();
  }

  /**
   * Edit a spotlight's mutable fields (tagline and about text).
   * Only the owner or an admin may call this.
   */
  async updateSpotlight(id: string, patch: { tagline: string; about: string }): Promise<Spotlight> {
    const me = this.auth.user();
    const sp = await this.api.spotlight(id);
    if (!me || !sp) throw new Error('That community is not here any more');
    if (sp.ownerId !== me.id && !sp.adminIds.includes(me.id)) {
      throw new Error('Only the community owner can edit this');
    }
    const updated: Spotlight = {
      ...sp,
      tagline: patch.tagline.trim() || sp.tagline,
      about: patch.about.trim()
    };
    await this.api.saveSpotlight(updated);
    await this.loadStatic();
    return updated;
  }

  /**
   * Permanently delete a spotlight. Only the owner may do this.
   * Posts that referenced the spotlight remain on the feed.
   */
  async deleteSpotlight(id: string): Promise<void> {
    const me = this.auth.user();
    const sp = await this.api.spotlight(id);
    if (!me || !sp) return;
    if (sp.ownerId !== me.id && !me.isAdmin) {
      throw new Error('Only the community owner can delete this');
    }
    await this.api.deleteSpotlight(id);
    await this.loadStatic();
  }

  /** Find a community by surname (and optionally province). */
  spotlightForSurname(surname: string, province?: string | null): Spotlight | undefined {
    const needle = surname.trim().toLowerCase();
    if (!needle) return undefined;
    const all = this.spotlights();
    return (
      all.find((s) => s.province === province && s.surname.toLowerCase() === needle) ??
      all.find((s) => s.surname.toLowerCase() === needle)
    );
  }

  /** Communities the signed-in person has joined or created - used by the composer. */
  readonly mySpotlights = computed(() => {
    const me = this.auth.viewerId;
    return me ? this.spotlights().filter((s) => s.memberIds.includes(me)) : [];
  });

  isMember(spotlightId: string | null): boolean {
    const me = this.auth.viewerId;
    if (!me || !spotlightId) return false;
    return !!this.spotlights().find((s) => s.id === spotlightId && s.memberIds.includes(me));
  }

  spotlightPosts(id: string): Post[] {
    return this.feed().filter((p) => p.spotlightId === id);
  }

  spotlightCover(s: Spotlight): string {
    return cover(`${s.surname} family`, s.coverHue || undefined);
  }

  /* -------------------------- stories -------------------------- */
  async createStory(input: {
    text: string;
    media: Story['media'];
    bgHue: number;
    audience?: Audience;
    spotlightId?: string | null;
  }): Promise<Story> {
    const me = this.auth.user();
    if (!me) throw new Error('Sign in to post a story');
    if (me.suspended) throw new Error('Your account is suspended');
    if (!input.text.trim() && !input.media.length) throw new Error('Add a photo or some words');
    const audience = input.audience ?? 'public';
    if (audience === 'surname' && (!input.spotlightId || !this.isMember(input.spotlightId))) {
      throw new Error('Choose a Spotlight community you have joined.');
    }
    if (input.media.length > 3 || input.media.some((item) => item.kind !== 'image')) {
      throw new Error('A story can contain up to three photos. Video stories are not available yet.');
    }
    const media = await Promise.all(input.media.map((item) => this.api.uploadMedia(me.id, item)));
    const now = Date.now();
    const s: Story = {
      id: uid('s'),
      authorId: me.id,
      createdAt: now,
      expiresAt: now + 24 * HOUR,
      media,
      text: input.text.trim(),
      bgHue: input.bgHue,
      viewers: [],
      replies: [],
      audience,
      spotlightId: audience === 'surname' ? input.spotlightId ?? null : null
    };
    await this.api.saveStory(s);
    await this.loadStatic();
    return s;
  }

  /** Stories the signed-in person is allowed to see, newest first. */
  readonly visibleStories = computed(() => {
    const me = this.auth.viewerId;
    const all = this.stories();
    return all.filter((s) => {
      if (s.authorId === me) return true;
      if (s.audience === 'public') return true;
      if (!me) return false;
      if (s.audience === 'followers') return this.followingIds().includes(s.authorId);
      if (s.audience === 'surname') {
        if (!s.spotlightId) return false;
        const sp = this.spotlights().find((x) => x.id === s.spotlightId);
        return !!sp && sp.memberIds.includes(me);
      }
      return true;
    });
  });

  async markStorySeen(storyId: string): Promise<void> {
    const me = this.auth.viewerId;
    const s = this.visibleStories().find((x) => x.id === storyId);
    if (!s || !me || s.authorId === me || s.viewers.includes(me)) return;
    const views = await this.api.storyViewsFor(storyId);
    if (views.some((view) => view.viewerId === me)) return;
    const view: StoryView = { id: `sv_${storyId}_${me}`, storyId, viewerId: me, at: Date.now() };
    await this.api.saveStoryView(view);
    await this.loadStatic();
  }

  async replyToStory(storyId: string, body: string): Promise<void> {
    const me = this.auth.viewerId;
    const text = body.trim();
    const s = this.visibleStories().find((x) => x.id === storyId);
    if (!me) throw new Error('Sign in to reply to a story');
    if (!s) throw new Error('This story is no longer available to you');
    if (!text) throw new Error('Write a reply first');
    const reply: StoryReply = { id: uid('r'), storyId, authorId: me, body: text, at: Date.now() };
    await this.api.saveStoryReply(reply);
    if (s.authorId !== me) {
      await this.notify({
        userId: s.authorId,
        kind: 'story_reply',
        title: 'A reply to your story',
        body: `${this.auth.user()?.displayName ?? 'Someone'}: ${text.slice(0, 100)}`,
        route: `/story/${s.id}`,
        postId: null
      });
    }
    await this.loadStatic();
  }

  async deleteStory(storyId: string): Promise<void> {
    const s = this.stories().find((x) => x.id === storyId);
    if (!s) return;
    if (s.authorId !== this.auth.viewerId) throw new Error('Only the person who shared this story can remove it');
    await this.api.saveStory({ ...s, expiresAt: 0 });
    await this.loadStatic();
  }

  /* --------------------- outcome / found ----------------------- */
  /**
   * Closes a case as found. Called either by the poster confirming, or after the
   * "did you get help?" nudge is answered yes.
   */
  async markFound(postId: string, opts: { whereabouts: string; note?: string; asWhereaboutsOnly?: boolean; finderUserId?: string | null }): Promise<Post | undefined> {
    const me = this.auth.viewerId;
    const p = await this.loadPost(postId);
    if (!p) return undefined;

    // Credit the member they selected. A case credits one person, once.
    let finderUserId = p.outcome?.finderUserId ?? null;
    let finderName = p.outcome?.finderName ?? '';
    const want = opts.finderUserId ?? null;
    if (want && !finderUserId) {
      const finder = await this.api.user(want);
      if (finder && finder.suspended !== true) {
        const credits = (finder.contributorCredits ?? 0) + 1;
        const updated = { ...finder, contributorCredits: credits };
        await this.api.saveUser(updated);
        this.touchAuthor(updated);
        this.auth.syncUser(updated);
        finderUserId = finder.id;
        finderName = finder.displayName;
        const subject = p.subject?.name?.trim() || 'someone';
        await this.notify({
          userId: finder.id,
          kind: 'outcome',
          title: 'You earned a contributor badge',
          body: `You were named as the person who found ${subject}. Your badge is now x${credits}.`,
          route: `/user/${finder.id}`,
          postId: p.id
        });
      }
    }

    const next: Post = {
      ...p,
      status: 'found',
      updatedAt: Date.now(),
      outcome: {
        found: true,
        foundAt: Date.now(),
        whereaboutsFound: opts.whereabouts.trim(),
        closedBy: me,
        note: opts.note?.trim() || (opts.asWhereaboutsOnly ? 'Whereabouts confirmed - case closed.' : 'Found safe.'),
        finderUserId,
        finderName
      },
      events: [
        ...p.events,
        {
          at: Date.now(),
          kind: opts.asWhereaboutsOnly ? 'whereabouts_found' : 'found',
          byUserId: me,
          note: finderName ? `${opts.whereabouts} · found by ${finderName}` : opts.whereabouts
        }
      ]
    };
    await this.api.savePost(next);
    this.mergeCache([next]);
    await this.loadFeed();
    return next;
  }

  async setOutcomeNudged(postId: string): Promise<void> {
    const p = await this.loadPost(postId);
    if (!p) return;
    const next = { ...p, outcomeNudgeAt: Date.now() };
    await this.api.savePost(next);
    this.mergeCache([next]);
  }

  /** Poster says "no, still looking" - resets the nudge timer. */
  async dismissOutcomeNudge(postId: string): Promise<void> {
    const p = await this.loadPost(postId);
    if (!p) return;
    await this.api.savePost({ ...p, outcomeNudgeAt: Date.now(), updatedAt: Date.now() });
    await this.loadFeed();
  }

  /* --------------------- KhumbulEkhaya flow -------------------- */
  /** The subject claims the post: "this is me". */
  async claimKhumbuPost(postId: string): Promise<Post | undefined> {
    const me = this.auth.viewerId;
    const p = await this.loadPost(postId);
    if (!me || !p) return undefined;
    if ((p.subject?.age ?? 99) < 18) {
      throw new Error('You cannot claim a case involving a child under 18 online');
    }
    const khumbu = p.khumbu ?? {
      daysOut: null,
      leftHomeAt: null,
      reasonGuess: '',
      claimedByUserId: null,
      claimedAt: null,
      subjectResponse: 'none' as const,
      subjectNote: '',
      wantedAnswers: { yes: 0, no: 0, myVote: null }
    };
    const next: Post = {
      ...p,
      khumbu: { ...khumbu, claimedByUserId: me, claimedAt: Date.now() },
      events: [...p.events, { at: Date.now(), kind: 'claimed', byUserId: me, note: 'Person in the post says: this is me' }]
    };
    await this.api.savePost(next);
    this.mergeCache([next]);
    await this.loadFeed();
    return next;
  }

  /** The subject answers: coming home, or safe but not coming home. */
  async subjectRespond(postId: string, response: NonNullable<Post['khumbu']>['subjectResponse'], note: string): Promise<Post | undefined> {
    const me = this.auth.viewerId;
    const p = await this.loadPost(postId);
    if (!me || !p || !p.khumbu) return undefined;
    const next: Post = {
      ...p,
      status: response === 'not_going_home' ? 'not_going_home' : p.status,
      khumbu: { ...p.khumbu, subjectResponse: response, subjectNote: note.trim() },
      events: [
        ...p.events,
        { at: Date.now(), kind: response === 'not_going_home' ? 'not_going_home' : 'going_home', byUserId: me, note }
      ]
    };
    await this.api.savePost(next);
    this.mergeCache([next]);
    if (p.authorId !== me) {
      await this.api.pushNotification({
        id: uid('n'),
        userId: p.authorId,
        kind: 'claim',
        title: response === 'not_going_home' ? 'They are safe but not coming home' : 'They answered your KhumbulEkhaya',
        body: note.trim() || (response === 'not_going_home' ? 'They asked that you respect this.' : 'They are coming home.'),
        at: Date.now(),
        read: false,
        route: `/post/${p.id}`,
        postId: p.id
      });
    }
    await this.loadFeed();
    return next;
  }

  /** Community answers the "Are they being wanted?" question. */
  async answerWanted(postId: string, answer: boolean): Promise<Post | undefined> {
    const me = this.auth.viewerId;
    const p = await this.loadPost(postId);
    if (!me || !p || !p.khumbu) return undefined;
    const w = p.khumbu.wantedAnswers;
    const changed = w.myVote === answer ? null : w.myVote;
    const next: Post = {
      ...p,
      khumbu: {
        ...p.khumbu,
        wantedAnswers: {
          yes: Math.max(0, w.yes + (answer ? 1 : 0) - (changed === true ? 1 : 0)),
          no: Math.max(0, w.no + (answer ? 0 : 1) - (changed === false ? 1 : 0)),
          myVote: answer
        }
      }
    };
    await this.api.savePost(next);
    this.mergeCache([next]);
    return next;
  }

  /* ------------------------- reporting ------------------------- */
  async flag(postId: string, reason: string): Promise<void> {
    const me = this.auth.viewerId;
    const p = await this.loadPost(postId);
    if (!p || !me) return;
    await this.api.savePost({
      ...p,
      flags: [...p.flags, { reason, byUserId: me, at: Date.now(), resolved: false }]
    });
  }

  /**
   * Tell other people in the same province. The poster already knows.
   * The alert stays on the feed for everyone; the notice is for people nearby.
   */
  private async alertProvince(post: Post): Promise<void> {
    const users = await this.api.users();
    const kind = dangerLabel(post.danger?.kind);
    const place = [post.lastSeenWhere, post.town].filter(Boolean).join(', ');
    for (const u of users) {
      if (u.id === post.authorId || u.suspended) continue;
      if (u.province !== post.province) continue;
      await this.api.pushNotification({
        id: uid('n'),
        userId: u.id,
        kind: 'danger',
        title: `${kind} nearby`,
        body: `${place}. Stay away and do not approach.`,
        at: Date.now(),
        read: false,
        route: `/post/${post.id}`,
        postId: post.id
      });
    }
    if (this.auth.viewerId) await this.loadUserScoped();
  }

  /**
   * A viewer says the danger is still happening, or that it has cleared.
   * The person who posted can clear it at once. Three other people saying
   * it is clear also clears it, so one tap cannot hide a real alert.
   */
  async respondDanger(postId: string, still: boolean): Promise<Post | undefined> {
    const me = this.auth.user();
    if (!me) throw new Error('Sign in to respond');
    const p = await this.loadPost(postId);
    if (!p || p.type !== 'danger' || !p.danger) throw new Error('That alert is not here');
    const stillIds = p.danger.stillIds.filter((id) => id !== me.id);
    const clearIds = p.danger.clearIds.filter((id) => id !== me.id);
    if (still) stillIds.push(me.id);
    else clearIds.push(me.id);
    const authorClears = !still && me.id === p.authorId;
    const communityClears = clearIds.length >= 3;
    const clearedAt = still
      ? null
      : (authorClears || communityClears ? (p.danger.clearedAt ?? Date.now()) : p.danger.clearedAt);
    const next: Post = {
      ...p,
      danger: { ...p.danger, stillIds, clearIds, clearedAt },
      updatedAt: Date.now()
    };
    await this.api.savePost(next);
    this.touch(next);
    if (me.id !== p.authorId) {
      await this.notify({
        userId: p.authorId,
        kind: 'danger',
        title: still ? 'Someone says it is still happening' : 'Someone says it has cleared',
        body: p.lastSeenWhere || p.town,
        route: `/post/${p.id}`,
        postId: p.id
      });
    }
    await this.loadFeed();
    return next;
  }

  /* ---------------------- notifications ------------------------ */
  async markNotificationsRead(): Promise<void> {
    const me = this.auth.viewerId;
    if (!me) return;
    await this.api.markNotificationsRead(me);
    await this.loadUserScoped();
  }

  async notify(n: Omit<Notification, 'id' | 'at' | 'read'>): Promise<void> {
    await this.api.pushNotification({ ...n, id: uid('n'), at: Date.now(), read: false });
    await this.loadUserScoped();
  }

  /* --------------------------- users --------------------------- */
  async profile(id: string): Promise<UserProfile | undefined> {
    return this.api.user(id);
  }

  /**
   * Load multiple user profiles by id in one call.
   * Used by the followers / following sheet in the Me tab.
   */
  async people(ids: string[]): Promise<UserProfile[]> {
    if (!ids.length) return [];
    const results = await Promise.all(ids.map((id) => this.api.user(id)));
    return results.filter((u): u is UserProfile => u !== undefined);
  }

  async searchUsers(q: string): Promise<UserProfile[]> {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const all = await this.api.users();
    return all.filter(
      (u) =>
        u.displayName.toLowerCase().includes(needle) ||
        u.handle.toLowerCase().includes(needle) ||
        u.surname.toLowerCase().includes(needle)
    );
  }

  /**
   * Every member who has the name that was typed, so the poster can pick the
   * right person. "John" returns every John. "John Doe" returns people who
   * have both words. Exact full-name matches come first.
   */
  async usersWithName(q: string): Promise<UserProfile[]> {
    const needle = q.trim().toLowerCase().replace(/\s+/g, ' ');
    const words = needle.split(' ').filter((w) => w.length >= 2);
    if (needle.length < 2 || !words.length) return [];
    const all = await this.api.users();
    const hits = all.filter((u) => {
      if (u.suspended) return false;
      const hay = `${u.displayName} ${u.surname}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    hits.sort((a, b) => {
      const ae = a.displayName.toLowerCase() === needle ? 0 : 1;
      const be = b.displayName.toLowerCase() === needle ? 0 : 1;
      if (ae !== be) return ae - be;
      return a.displayName.localeCompare(b.displayName);
    });
    return hits;
  }

  /** Highest contributor count. A person at this number is the most named. */
  async topContributorCount(): Promise<number> {
    const all = await this.api.users();
    return all.reduce((m, u) => Math.max(m, u.contributorCredits ?? 0), 0);
  }

  /** Every username in use - lets a form check availability before saving. */
  async allHandles(): Promise<string[]> {
    try {
      return (await this.api.users()).map((u) => u.handle);
    } catch {
      return [];
    }
  }

  /**
   * The check-in status a viewer is allowed to see on an avatar ring.
   * The person always sees their own; everyone else only when the person has
   * not hidden their location. Returns null when there is nothing to show.
   */
  statusOf(u?: UserProfile | null, viewerId: string | null = this.auth.viewerId): UserProfile['checkIn'] extends null ? never : (import('../models/types').CheckInStatus | null) {
    const c = u?.checkIn;
    if (!u || !c) return null;
    if (u.id === viewerId) return c.status;
    if (!u.privacy?.showLocation && c.location) return null;
    if (c.liveShareOn && c.liveUntil && c.liveUntil <= Date.now()) return c.status;
    return c.status;
  }

  /* ---------------------- follow requests ---------------------- */

  /** Requests waiting on the signed-in person's decision. */
  readonly followRequests = signal<FollowEdge[]>([]);

  async loadFollowRequests(): Promise<void> {
    const me = this.auth.viewerId;
    if (!me) { this.followRequests.set([]); return; }
    this.followRequests.set(await this.api.followRequests(me));
  }

  /** Accept or decline one request. */
  async respondToFollowRequest(followerId: string, accept: boolean): Promise<void> {
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in to manage follow requests');
    await this.api.respondFollowRequest(followerId, me, accept);
    await this.api.pushNotification({
      id: uid('n'), userId: followerId,
      kind: accept ? 'follow' : 'system',
      title: accept ? 'Follow request accepted' : 'Follow request declined',
      body: accept
        ? `${this.auth.user()?.displayName ?? 'They'} accepted your request. You can follow each other now.`
        : `${this.auth.user()?.displayName ?? 'They'} declined your request.`,
      at: Date.now(), read: false,
      route: accept ? `/user/${me}` : null, postId: null
    });
    await this.loadFollowRequests();
    await this.loadUserScoped();
  }

  /* ------------------------- search party ------------------------- */

  /**
   * Open a ground search on a case. The poster (or an admin) names a meeting
   * point and the areas to cover; volunteers claim an area so nobody searches
   * the same street twice while another is untouched.
   */
  async openSearchParty(postId: string, meetAt: string, meetWhen: number | null, zones: string[]): Promise<void> {
    const p = this.cache()[postId] ?? (await this.api.post(postId));
    if (!p) throw new Error('That post does not exist');
    if (!this.canEdit(p)) throw new Error('Only the poster can open a search party');
    const list = zones.map((name) => ({
      id: uid('z'), name: name.trim(), priority: 'medium' as const, takenBy: null, done: false, note: ''
    })).filter((z) => z.name);
    await this.api.savePost({ ...p, searchParty: { open: true, meetAt: meetAt.trim(), meetWhen, zones: list } });
    await this.loadFeed();
  }

  /** A volunteer claims an area of the search. */
  async claimSearchZone(postId: string, zoneId: string): Promise<void> {
    const p = this.cache()[postId] ?? (await this.api.post(postId));
    if (!p?.searchParty) throw new Error('That case has no open search party');
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in to join a search party');
    const zones = p.searchParty.zones.map((z) =>
      z.id === zoneId ? { ...z, takenBy: z.takenBy === me ? null : me } : z
    );
    await this.api.savePost({ ...p, searchParty: { ...p.searchParty, zones } });
    await this.loadFeed();
  }

  /**
   * One tap: I am looking near the last-seen place.
   * Tells the poster only. A second tap takes it back.
   * Returns whether you are looking now.
   */
  async markLooking(postId: string): Promise<boolean> {
    const me = this.auth.user();
    if (!me) throw new Error('Sign in to say you are looking');
    const p = this.cache()[postId] ?? (await this.api.post(postId));
    if (!p) throw new Error('That post does not exist');
    if (p.status !== 'active') throw new Error('This search is closed');
    if (p.authorId === me.id) throw new Error('The family already knows you are on this');
    const ids = new Set(p.lookingIds ?? []);
    const on = !ids.has(me.id);
    if (on) ids.add(me.id);
    else ids.delete(me.id);
    const next = { ...p, lookingIds: [...ids], updatedAt: Date.now() };
    await this.api.savePost(next);
    this.touch(next);
    if (on) {
      const place = p.lastSeenWhere?.trim() || p.town || 'the last-seen place';
      await this.api.pushNotification({
        id: uid('n'),
        userId: p.authorId,
        kind: 'system',
        title: `${me.displayName.split(' ')[0]} is looking`,
        body: `Near ${place}.`,
        at: Date.now(),
        read: false,
        route: `/post/${p.id}`,
        postId: p.id
      });
    }
    await this.loadFeed();
    return on;
  }

  /** Mark an area searched. */
  async completeSearchZone(postId: string, zoneId: string, note = ''): Promise<void> {
    const p = this.cache()[postId] ?? (await this.api.post(postId));
    if (!p?.searchParty) throw new Error('That case has no open search party');
    const zones = p.searchParty.zones.map((z) =>
      z.id === zoneId ? { ...z, done: !z.done, note: note.trim().slice(0, 200) || z.note } : z
    );
    await this.api.savePost({ ...p, searchParty: { ...p.searchParty, zones } });
    await this.loadFeed();
  }

  /* --------------------------- misc ---------------------------- */
  avatarFor(u?: UserProfile | null): string {
    return avatar(u?.displayName ?? 'Anonymous', u?.avatarHue);
  }

  sceneFor(title: string, tone: 'street' | 'home' | 'map' | 'night' = 'street'): string {
    return scene(title, title, tone);
  }

  displayName(p: Post, u?: UserProfile | null): string {
    if (p.anonymous && this.auth.viewerId !== p.authorId) return 'Anonymous';
    return u?.displayName ?? 'LulaFind member';
  }

  provinceLabel(code: string): string {
    return provinceName(code);
  }

  compact(n: number): string {
    return compact(n);
  }

  get demoMode(): boolean {
    return true;
  }

  async resetDemoData(): Promise<void> {
    await this.api.reset();
    await this.loadStatic();
    await this.loadFeed();
  }

  /** How stale is the newest post - used for the "live" pill in the header. */
  get newestAt(): number {
    return this.feed().reduce((max, p) => Math.max(max, p.updatedAt), 0) || Date.now() - DAY;
  }
}
