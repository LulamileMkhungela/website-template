import { Component, EventEmitter, Input, OnChanges, OnInit, Output, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Post, POST_TYPE_META, UserProfile, provinceName } from '../../core/models/types';
import { compact, timeAgo, urgency } from '../../core/utils/format';
import { AvatarComponent } from './avatar.component';
import { IconComponent } from './icon.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { CHECK_IN_COPY } from '../../core/services/safety.service';
import { SearchFocus, searchFocus } from '../../core/utils/search-focus';

export type ChatState = 'off' | 'locked-vote' | 'locked-follow' | 'open';

/**
 * Facebook-style feed card:
 * Author row with Facebook Follow link, post text, media,
 * Facebook engagement stats bar (Likes/Comments/Shares),
 * and Facebook action bar (Like / Comment / Share).
 */
@Component({
  selector: 'lf-post-card',
  standalone: true,
  imports: [RouterLink, IconComponent, AvatarComponent],
  template: `
    <article class="fb-card lf-fade-in"
             [class.fb-card--critical]="isCritical()"
             [class.fb-card--found]="post.status === 'found'">
      @if (post.status === 'found') {
        <span class="home-stamp" aria-hidden="true">HOME</span>
      }

      <header class="fb-card-header" [routerLink]="authorRoute()">
        <lf-avatar [src]="authorAvatar()" [name]="authorName()" [size]="40"
                   [status]="authorStatus()" />
        <div class="fb-author-meta">
          <div class="fb-author-row">
            <span class="fb-author-name">{{ authorName() }}</span>
            @if (showFollow()) {
              <span class="fb-dot">·</span>
              <button class="fb-follow-link" [class.on]="followingAuthor()" [class.requested]="followRequested()"
                      [attr.aria-pressed]="followingAuthor() || followRequested()" (click)="onFollow($event)">
                {{ followingAuthor() ? 'Following' : followRequested() ? 'Requested' : 'Follow' }}
              </button>
            }
          </div>
          <div class="fb-sub-meta">
            <span>{{ timeAgo(post.updatedAt) }}</span>
            <span class="fb-dot">·</span>
            <span>{{ provinceName(post.province) }}</span>
            <span class="fb-dot">·</span>
            <lf-icon name="users" [size]="12" />
          </div>
        </div>
        <button class="fb-more-btn" (click)="onMore($event)" aria-label="More options">
          <lf-icon name="more" [size]="18" />
        </button>
      </header>

      <div class="fb-chips">
        <span class="fb-chip" [class.fb-chip--danger]="post.type === 'missing' || post.type === 'danger'"
              [class.fb-chip--success]="post.status === 'found'">
          <lf-icon [name]="meta().icon" [size]="12" /> {{ statusLabel() }}
        </span>
        @if (post.reward) { <span class="fb-chip fb-chip--beacon">Reward offered</span> }
        @if (post.escalation.consentGranted) {
          <span class="fb-chip fb-chip--success">Family notified</span>
        }
      </div>

      <div class="fb-card-body" [routerLink]="'/post/' + post.id">
        <h3 class="fb-post-title">{{ post.title }}</h3>
        @if (post.type === 'vehicle') {
          <div class="fb-fact-row">
            <span>🚗 <strong>Stolen Vehicle:</strong> {{ post.subject?.vehicle || post.title }}</span>
          </div>
        } @else if (post.type === 'pet') {
          <div class="fb-fact-row">
            <span>🐾 <strong>Lost Pet:</strong> {{ post.subject?.name || 'Pet' }}</span>
          </div>
        } @else if (post.subject?.name && post.type !== 'story' && post.type !== 'danger') {
          <div class="fb-fact-row">
            <lf-icon name="user" [size]="14" />
            <strong>{{ post.subject.name }}</strong>
            @if (post.subject && post.subject.age !== null) {
              <span class="fb-muted">· {{ post.subject.age }} {{ ageWord() }}</span>
            }
          </div>
        }
        @if (post.lastSeenWhere) {
          <div class="fb-fact-row">
            <lf-icon name="pin" [size]="14" />
            <span>Last seen: {{ post.lastSeenWhere }}</span>
          </div>
        }
        <p class="fb-post-text" [class.lf-clamp-4]="!expanded()">{{ post.body }}</p>
        @if (longBody()) {
          <button class="fb-readmore" (click)="toggleExpand($event)">
            {{ expanded() ? 'Show less' : 'Read more' }}
          </button>
        }
      </div>

      @if (post.media.length) {
        <div class="fb-media" [routerLink]="'/post/' + post.id">
          @if (post.media.length === 1) {
            <img class="fb-media-img" [src]="post.media[0].src" [alt]="post.title" loading="lazy" />
          } @else {
            <div class="lf-grid-2">
              @for (m of visibleMedia(); track m.id; let i = $index) {
                <img class="fb-media-img" [src]="m.src" [alt]="m.caption ?? ''" loading="lazy" />
              }
            </div>
          }
        </div>
      }

      <!-- Facebook Reaction Summary Bar -->
      <div class="fb-stats-bar" [routerLink]="'/post/' + post.id">
        <div class="fb-stats-likes">
          <span class="fb-like-icon">👍</span>
          <span>{{ compact(post.upvotes || 1) }}</span>
        </div>
        <div class="fb-stats-right">
          @if (post.commentCount > 0) { <span>{{ compact(post.commentCount) }} comments</span> }
          @if (post.shares > 0) { <span class="fb-dot">·</span> <span>{{ compact(post.shares) }} shares</span> }
        </div>
      </div>

      <!-- Facebook Action Buttons Row -->
      <div class="fb-actions-row">
        <button class="fb-action-btn" [class.active]="myVote() === 'up'" (click)="onVote('up')">
          <lf-icon name="bulb" [size]="18" />
          <span>Idea</span>
        </button>

        <button class="fb-action-btn" (click)="comment.emit()">
          <lf-icon name="comment" [size]="18" />
          <span>Comment</span>
        </button>

        <button class="fb-action-btn" (click)="share.emit()">
          <lf-icon name="share" [size]="18" />
          <span>Share</span>
        </button>
      </div>

      @if (post.chatEnabled && !isMine()) {
        <button class="fb-chat-cta" (click)="chat.emit()">
          <lf-icon [name]="chatState === 'open' ? 'unlock' : 'lock'" [size]="15" />
          {{ chatLabel() }}
        </button>
      }
    </article>
  `,
  styles: [`
    .fb-card {
      background: #ffffff;
      border: 1px solid #ced0d4;
      border-radius: 8px;
      margin: 10px 0;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .fb-card--critical { border-left: 4px solid #e41e3f; }
    .fb-card--found { border-left: 4px solid #34c759; }

    .fb-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px 4px;
    }
    .fb-author-meta { flex: 1; min-width: 0; }
    .fb-author-row { display: flex; align-items: center; gap: 6px; }
    .fb-author-name { font-weight: 700; font-size: 15px; color: #050505; }
    .fb-dot { color: #65676b; font-size: 12px; }
    .fb-follow-link {
      background: none;
      border: 0;
      color: #1877f2;
      font-weight: 700;
      font-size: 13.5px;
      cursor: pointer;
      padding: 0;
    }
    .fb-follow-link.on { color: #65676b; }
    .fb-follow-link.requested { color: #65676b; }
    .fb-sub-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #65676b;
      margin-top: 2px;
    }
    .fb-more-btn {
      background: none;
      border: 0;
      color: #65676b;
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
    }

    .fb-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 14px 6px; }
    .fb-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 700;
      background: #e4e6eb; color: #050505;
    }
    .fb-chip--danger { background: #ffebe9; color: #e41e3f; }
    .fb-chip--success { background: #e6f4ea; color: #137333; }
    .fb-chip--beacon { background: #e7f3ff; color: #1877f2; }

    .fb-card-body { padding: 4px 14px 10px; }
    .fb-post-title { font-size: 16px; font-weight: 700; color: #050505; margin: 0 0 4px; line-height: 1.3; }
    .fb-fact-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #65676b; margin-bottom: 4px; }
    .fb-post-text { font-size: 14.5px; color: #050505; line-height: 1.45; margin: 4px 0 0; }
    .fb-readmore { background: none; border: 0; color: #1877f2; font-weight: 700; font-size: 13.5px; cursor: pointer; padding: 0; margin-top: 4px; }

    .fb-media { width: 100%; max-height: 440px; overflow: hidden; background: #000; }
    .fb-media-img { width: 100%; object-fit: cover; max-height: 440px; display: block; }

    .fb-stats-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      font-size: 13px;
      color: #65676b;
    }
    .fb-stats-likes { display: flex; align-items: center; gap: 6px; }
    .fb-like-icon {
      width: 18px; height: 18px; border-radius: 50%; background: #1877f2; color: #fff;
      display: inline-flex; align-items: center; justify-content: center; font-size: 10px;
    }
    .fb-stats-right { display: flex; align-items: center; gap: 6px; }

    .fb-actions-row {
      display: flex;
      align-items: center;
      border-top: 1px solid #ced0d4;
      padding: 2px 6px;
    }
    .fb-action-btn {
      flex: 1;
      height: 40px;
      border: 0;
      background: transparent;
      color: #65676b;
      font-size: 13.5px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      border-radius: 4px;
    }
    .fb-action-btn:active { background: #e4e6eb; }
    .fb-action-btn.active { color: #1877f2; }

    .fb-chat-cta {
      display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
      height: 40px; border: 0; border-top: 1px solid #ced0d4; background: #f0f2f5;
      color: #1877f2; font-weight: 700; font-size: 13px; cursor: pointer;
    }

    .home-stamp {
      position: absolute; top: 12px; right: 14px; z-index: 2;
      border: 2px solid #34c759; color: #34c759; font-size: 11px; font-weight: 900;
      padding: 2px 6px; border-radius: 4px; background: #ffffff;
    }
  `]
})
export class PostCardComponent implements OnInit, OnChanges {
  private router = inject(Router);
  private lookOn = signal<boolean | null>(null);
  @Input({ required: true }) post!: Post;
  @Input() author: UserProfile | null = null;
  @Input() chatState: ChatState = 'off';

  @Output() vote = new EventEmitter<'up' | 'down'>();
  @Output() comment = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() chat = new EventEmitter<void>();
  @Output() more = new EventEmitter<Post>();
  @Output() savedChange = new EventEmitter<void>();
  @Output() follow = new EventEmitter<Post>();

  private data = inject(DataService);
  private auth = inject(AuthService);

  saved = signal(false);
  followingAuthor = signal(false);
  followRequested = signal(false);
  expanded = signal(false);

  protected readonly compact = compact;
  protected readonly timeAgo = timeAgo;
  protected readonly provinceName = provinceName;

  readonly meta = computed(() => POST_TYPE_META[this.post?.type ?? 'story']);
  readonly isCritical = computed(() => urgency(this.post) === 'critical');
  readonly isMine = computed(() => this.post?.authorId === this.auth.viewerId);
  readonly myVote = computed(() => (this.post ? this.data.myVote(this.post) : null));
  readonly authorName = computed(() =>
    this.post?.anonymous && !this.isMine() ? 'Anonymous' : this.author?.displayName ?? 'LulaFind member'
  );
  readonly authorAvatar = computed(() => this.data.avatarFor(this.post?.anonymous && !this.isMine() ? null : this.author));
  readonly authorStatus = computed(() =>
    this.post?.anonymous && !this.isMine() ? null : this.data.statusOf(this.author));
  readonly statusWord = computed(() => {
    const s = this.authorStatus();
    return s ? CHECK_IN_COPY[s].short : '';
  });
  readonly authorRoute = computed(() =>
    this.post?.anonymous && !this.isMine() ? ['/post/' + this.post.id] : ['/user/' + (this.author?.id ?? '')]
  );
  readonly longBody = computed(() => (this.post?.body?.trim().length ?? 0) > 190);

  readonly visibleMedia = computed(() => this.post?.media.slice(0, 4) ?? []);

  readonly showFollow = computed(() => {
    if (this.isMine()) return false;
    if (this.post?.anonymous) return false;
    return !!this.author?.id;
  });

  async ngOnInit(): Promise<void> {
    this.syncFollow();
    this.saved.set(this.data.savedIds().includes(this.post?.id ?? ''));
  }

  ngOnChanges(): void {
    this.syncFollow();
  }

  private syncFollow(): void {
    const id = this.post?.authorId;
    if (!id) return;
    void this.data.followStatus(id).then((status) => {
      this.followingAuthor.set(status === 'accepted');
      this.followRequested.set(status === 'pending');
    });
  }

  async onFollow(e: Event): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    if (!this.post) return;
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/auth'], { queryParams: { mode: 'signin', next: this.router.url } });
      return;
    }
    try {
      await this.data.toggleFollow(this.post.authorId);
      const status = await this.data.followStatus(this.post.authorId);
      this.followingAuthor.set(status === 'accepted');
      this.followRequested.set(status === 'pending');
      this.follow.emit(this.post);
    } catch { /* the profile has a full follow control with feedback */ }
  }

  statusLabel(): string {
    if (!this.post) return '';
    if (this.post.status === 'found') return 'FOUND';
    return POST_TYPE_META[this.post.type].label;
  }

  ageWord(): string {
    const age = this.post.subject?.age ?? 0;
    return age === 1 ? 'year old' : 'years old';
  }

  chatLabel(): string {
    switch (this.chatState) {
      case 'open': return 'Private chat is open';
      case 'locked-follow': return 'Follow each other to chat';
      case 'locked-vote': return 'Upvote to unlock chat';
      default: return 'Chat with poster';
    }
  }

  toggleExpand(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.expanded.update((v) => !v);
  }

  onVote(v: 'up' | 'down'): void {
    this.vote.emit(v);
  }

  onSave(): void {
    this.saved.update((s) => !s);
    this.savedChange.emit();
  }

  onMore(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.more.emit(this.post);
  }
}
