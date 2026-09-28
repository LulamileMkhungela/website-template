import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Story } from '../../core/models/types';
import { countdown, timeAgo } from '../../core/utils/format';
import { storyBg } from '../../core/data/seed';

@Component({
  selector: 'lf-story-viewer',
  standalone: true,
  imports: [IconComponent, AvatarComponent],
  template: `
    <div class="viewer" [style.background]="bg()">
      <div class="bars" role="progressbar" [attr.aria-label]="'Photo ' + (mediaIndex() + 1) + ' of ' + segmentCount()">
        @for (segment of segments(); track $index; let i = $index) {
          <div class="bar" [class.active]="i === mediaIndex()" [class.done]="i < mediaIndex()">
            <span [style.width.%]="segmentProgress(i)"></span>
          </div>
        }
      </div>

      <header>
        <lf-avatar [src]="avatar()" [name]="authorName()" [size]="36" />
        <div class="author-meta">
          <strong>{{ authorName() }}</strong>
          <span class="story-time">{{ timeAgo(story()?.createdAt) }} · {{ countdown(remaining()) }}</span>
        </div>
        @if (isOwner()) {
          <button class="top-action" type="button" (click)="toggleInsights()" aria-label="View story viewers and replies">
            <lf-icon name="eye" [size]="19" /><span>{{ story()?.viewers?.length ?? 0 }}</span>
          </button>
          <button class="top-action delete" type="button" (click)="del()" aria-label="Delete story"><lf-icon name="trash" [size]="18" /></button>
        }
        <button class="top-action" type="button" (click)="close()" aria-label="Close story"><lf-icon name="x" [size]="22" /></button>
      </header>

      @if (!story()) {
        <div class="ended"><span class="ended-icon"><lf-icon name="clock" [size]="22" /></span><strong>This story is no longer available</strong><p>Stories disappear 24 hours after they are shared.</p><button type="button" (click)="close()">Back to LulaFind</button></div>
      } @else {
        <main class="story-canvas" (click)="advance()">
          @if (currentMedia()) { <img [src]="currentMedia()!.src" class="shot" alt="Story photo" /> }
          @if (story()!.text) { <div class="story-text" [class.over-photo]="!!currentMedia()">{{ story()!.text }}</div> }
          <button class="tap-zone tap-zone--left" type="button" aria-label="Previous photo" (click)="$event.stopPropagation(); previous()"></button>
          <button class="tap-zone tap-zone--right" type="button" aria-label="Next photo" (click)="$event.stopPropagation(); advance()"></button>
          @if (segmentCount() > 1) { <span class="image-count">{{ mediaIndex() + 1 }} / {{ segmentCount() }}</span> }
        </main>

        @if (isOwner()) {
          <section class="owner-insights" [class.open]="insightsOpen()">
            <button class="insights-toggle" type="button" (click)="toggleInsights()" [attr.aria-expanded]="insightsOpen()">
              <span class="insights-summary"><lf-icon name="eye" [size]="17" /><strong>{{ story()!.viewers.length }} viewed</strong><i></i><lf-icon name="comment" [size]="16" /><strong>{{ story()!.replies.length }} private {{ story()!.replies.length === 1 ? 'reply' : 'replies' }}</strong></span>
              <lf-icon [name]="insightsOpen() ? 'chevronDown' : 'chevronRight'" [size]="17" />
            </button>
            @if (insightsOpen()) {
              <div class="insight-scroll">
                @if (story()!.replies.length) {
                  <div class="insight-heading">Private replies</div>
                  @for (reply of story()!.replies; track reply.id) {
                    <article class="reply-card">
                      <lf-avatar [src]="data.avatarFor(data.authorOf(reply.authorId))" [name]="data.authorOf(reply.authorId)?.displayName ?? 'Member'" [size]="30" />
                      <div class="reply-copy"><div><strong>{{ data.authorOf(reply.authorId)?.displayName ?? 'Member' }}</strong><time>{{ timeAgo(reply.at) }}</time></div><p>{{ reply.body }}</p></div>
                    </article>
                  }
                } @else {
                  <p class="empty-insight">No replies yet. Replies to your story are private and only you can see them.</p>
                }
                @if (story()!.viewers.length) {
                  <div class="insight-heading viewer-heading">Viewers</div>
                  <div class="viewer-list">
                    @for (viewerId of story()!.viewers; track viewerId) {
                      <div class="viewer-person"><lf-avatar [src]="data.avatarFor(data.authorOf(viewerId))" [name]="data.authorOf(viewerId)?.displayName ?? 'Member'" [size]="28" /><span>{{ data.authorOf(viewerId)?.displayName ?? 'Member' }}</span></div>
                    }
                  </div>
                }
              </div>
            }
          </section>
          <div class="owner-note"><lf-icon name="lock" [size]="14" /> Only you can see replies and the viewer list.</div>
        } @else {
          <footer class="reply-footer">
            @if (me()) {
              <input #replyBox aria-label="Private story reply" placeholder="Reply privately…" [disabled]="sending()"
                     (keydown.enter)="sendReply(replyBox)" />
              <button class="send" type="button" (click)="sendReply(replyBox)" [disabled]="sending() || !replyBox.value.trim()" aria-label="Send private reply">
                <lf-icon [name]="sending() ? 'clock' : 'send'" [size]="18" />
              </button>
            } @else {
              <button class="sign-in-reply" type="button" (click)="signInToReply()">Sign in to send a private reply</button>
            }
            <span class="private-hint"><lf-icon name="lock" [size]="12" /> Only {{ authorName() }} can see your reply</span>
          </footer>
        }
        @if (errorMessage()) { <p class="inline-error" role="alert">{{ errorMessage() }}</p> }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .viewer { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; box-sizing: border-box; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); background-size: cover; background-position: center; color: #fff; overflow: hidden; }
    .viewer::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.42), transparent 23%, transparent 62%, rgba(0,0,0,.34)); }
    .bars { position: relative; z-index: 1; display: flex; gap: 4px; padding: 10px 10px 0; }
    .bar { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,.35); overflow: hidden; }
    .bar span { display: block; height: 100%; background: #fff; transition: width .08s linear; }
    header { position: relative; z-index: 1; display: flex; align-items: center; gap: 9px; padding: 9px 10px 12px; color: #fff; }
    .author-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .author-meta strong { font-size: 13px; }
    .story-time { color: rgba(255,255,255,.78); font-size: 10.5px; }
    .top-action { min-width: 34px; height: 34px; display: inline-flex; justify-content: center; align-items: center; gap: 4px; padding: 0 7px; border: 0; border-radius: 50%; background: rgba(0,0,0,.22); color: #fff; cursor: pointer; }
    .top-action span { font-size: 11px; font-weight: 700; }
    .top-action.delete { color: #ffe0dc; }
    .story-canvas { position: relative; z-index: 0; flex: 1; min-height: 120px; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
    .shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: rgba(0,0,0,.18); }
    .story-text { position: relative; z-index: 1; max-width: 650px; padding: 28px 24px; color: #fff; text-shadow: 0 2px 18px rgba(0,0,0,.46); text-align: center; white-space: pre-wrap; overflow-wrap: anywhere; font-size: clamp(20px, 5vw, 30px); line-height: 1.35; font-weight: 780; }
    .story-text.over-photo { align-self: flex-end; width: 100%; box-sizing: border-box; padding-bottom: 34px; background: linear-gradient(transparent, rgba(0,0,0,.30)); }
    .tap-zone { position: absolute; z-index: 2; top: 0; bottom: 0; width: 30%; border: 0; background: transparent; }
    .tap-zone--left { left: 0; }
    .tap-zone--right { right: 0; }
    .image-count { position: absolute; z-index: 3; top: 12px; right: 12px; padding: 4px 8px; border-radius: 999px; background: rgba(0,0,0,.42); font-size: 10px; }
    .owner-insights { position: relative; z-index: 3; flex: 0 0 auto; max-height: 42vh; display: flex; flex-direction: column; border-radius: 13px 13px 0 0; background: rgba(255,255,255,.97); color: #1c1e21; backdrop-filter: blur(16px); box-shadow: 0 -4px 18px rgba(0,0,0,.12); }
    .insights-toggle { display: flex; align-items: center; justify-content: space-between; min-height: 42px; padding: 0 14px; border: 0; border-bottom: 1px solid #e4e6eb; background: transparent; color: #1c1e21; }
    .insights-summary { display: flex; align-items: center; gap: 6px; color: #65676b; font-size: 10.5px; }
    .insights-summary strong { color: #1c1e21; font-size: 10.5px; }
    .insights-summary i { width: 3px; height: 3px; border-radius: 50%; background: #8a8d91; margin: 0 2px; }
    .insight-scroll { overflow-y: auto; padding: 8px 13px 10px; }
    .insight-heading { margin: 2px 0 7px; color: #65676b; font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .35px; }
    .reply-card { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; }
    .reply-copy { min-width: 0; flex: 1; }
    .reply-copy > div { display: flex; align-items: baseline; gap: 8px; }
    .reply-copy strong { color: #1c1e21; font-size: 11px; }
    .reply-copy time { color: #8a8d91; font-size: 9px; }
    .reply-copy p { margin: 2px 0 0; color: #3e4042; font-size: 12px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
    .empty-insight { margin: 3px 0 10px; color: #65676b; font-size: 11px; line-height: 1.4; }
    .viewer-heading { padding-top: 7px; border-top: 1px solid #e4e6eb; }
    .viewer-list { display: flex; flex-wrap: wrap; gap: 6px 11px; }
    .viewer-person { display: flex; align-items: center; gap: 5px; color: #3e4042; font-size: 10px; }
    .owner-note { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 8px max(8px, env(safe-area-inset-bottom)); background: rgba(255,255,255,.97); color: #65676b; font-size: 9px; }
    .reply-footer { position: relative; z-index: 2; display: grid; grid-template-columns: 1fr 38px; gap: 8px; align-items: center; padding: 8px 13px 4px; background: linear-gradient(transparent, rgba(0,0,0,.24)); }
    .reply-footer input { min-width: 0; height: 40px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.58); border-radius: 999px; outline: 0; background: rgba(0,0,0,.20); color: #fff; padding: 0 14px; font-size: 13px; }
    .reply-footer input::placeholder { color: rgba(255,255,255,.84); }
    .reply-footer input:focus { background: rgba(0,0,0,.38); }
    .send { width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 50%; background: #1877f2; color: #fff; }
    .send:disabled { opacity: .45; }
    .private-hint { grid-column: 1 / -1; justify-self: center; display: flex; align-items: center; gap: 4px; color: rgba(255,255,255,.82); font-size: 9.5px; padding: 0 0 4px; }
    .sign-in-reply { grid-column: 1 / -1; min-height: 38px; border: 1px solid rgba(255,255,255,.55); border-radius: 999px; background: rgba(0,0,0,.22); color: #fff; font-size: 12px; font-weight: 650; }
    .inline-error { position: relative; z-index: 3; margin: 0 12px 6px; padding: 8px 10px; border-radius: 7px; background: #ffebe9; color: #b42318; font-size: 11px; }
    .ended { position: relative; z-index: 1; margin: auto; padding: 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .ended-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.18); }
    .ended strong { font-size: 16px; }
    .ended p { margin: 0; color: rgba(255,255,255,.8); font-size: 12px; }
    .ended button { margin-top: 7px; padding: 9px 13px; border: 0; border-radius: 7px; background: #fff; color: #1c1e21; font-size: 12px; font-weight: 700; }
    @media (min-width: 680px) {
      .viewer { width: min(100%, 560px); left: 50%; right: auto; transform: translateX(-50%); box-shadow: 0 0 0 100vw rgba(0,0,0,.54); }
      .owner-insights { max-height: 38vh; }
    }
    @media (prefers-reduced-motion: reduce) { .bar span { transition: none; } }
  `]
})
export class StoryViewerComponent implements OnInit, OnDestroy {
  protected data = inject(DataService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly timeAgo = timeAgo;
  protected readonly countdown = countdown;

  id = signal('');
  pct = signal(0);
  mediaIndex = signal(0);
  sending = signal(false);
  errorMessage = signal('');
  insightsOpen = signal(true);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly me = computed(() => this.auth.viewerId);
  readonly rail = computed(() => this.data.visibleStories());
  readonly story = computed(() => this.rail().find((item) => item.id === this.id()) ?? null);
  readonly isOwner = computed(() => !!this.story() && this.story()!.authorId === this.me());
  readonly authorName = computed(() => this.data.authorOf(this.story()?.authorId ?? '')?.displayName ?? 'Member');
  readonly avatar = computed(() => this.data.avatarFor(this.data.authorOf(this.story()?.authorId ?? '')));
  readonly bg = computed(() => storyBg(this.story()?.bgHue ?? 220));
  readonly currentMedia = computed(() => this.story()?.media[this.mediaIndex()] ?? null);
  readonly segments = computed(() => Array.from({ length: Math.max(1, this.story()?.media.length ?? 0) }));

  async ngOnInit(): Promise<void> {
    this.id.set(this.route.snapshot.paramMap.get('id') ?? '');
    await this.data.loadUserScoped();
    await this.data.loadStatic();
    if (this.story()) await this.data.markStorySeen(this.id());
    this.start();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  segmentCount(): number { return Math.max(1, this.story()?.media.length ?? 0); }

  segmentProgress(index: number): number {
    if (index < this.mediaIndex()) return 100;
    return index === this.mediaIndex() ? this.pct() : 0;
  }

  private start(): void {
    if (this.timer) clearInterval(this.timer);
    this.pct.set(0);
    let elapsed = 0;
    this.timer = setInterval(() => {
      elapsed += 2;
      this.pct.set(Math.min(100, elapsed));
      if (elapsed >= 100) this.advance();
    }, 100);
  }

  currentIndex(): number { return this.rail().findIndex((item) => item.id === this.id()); }

  remaining(): number { return Math.max(0, (this.story()?.expiresAt ?? Date.now()) - Date.now()); }

  advance(): void {
    const story = this.story();
    if (!story) { this.close(); return; }
    if (this.mediaIndex() + 1 < story.media.length) {
      this.mediaIndex.set(this.mediaIndex() + 1);
      this.start();
      return;
    }
    const next = this.rail()[this.currentIndex() + 1];
    if (next) {
      this.id.set(next.id);
      this.mediaIndex.set(0);
      this.insightsOpen.set(next.authorId === this.me());
      void this.data.markStorySeen(next.id);
      this.start();
    } else {
      this.close();
    }
  }

  previous(): void {
    if (this.mediaIndex() > 0) {
      this.mediaIndex.set(this.mediaIndex() - 1);
      this.start();
      return;
    }
    const prev = this.rail()[this.currentIndex() - 1];
    if (prev) {
      this.id.set(prev.id);
      this.mediaIndex.set(Math.max(0, prev.media.length - 1));
      this.insightsOpen.set(prev.authorId === this.me());
      this.start();
    }
  }

  toggleInsights(): void { this.insightsOpen.set(!this.insightsOpen()); }

  async sendReply(input: HTMLInputElement): Promise<void> {
    const text = input.value.trim();
    if (!text || this.sending()) return;
    this.errorMessage.set('');
    this.sending.set(true);
    try {
      await this.data.replyToStory(this.id(), text);
      input.value = '';
    } catch (e: any) {
      this.errorMessage.set(e?.message ?? 'Could not send reply');
    } finally {
      this.sending.set(false);
    }
  }

  signInToReply(): void {
    void this.router.navigate(['/auth'], { queryParams: { mode: 'signin', next: `/story/${this.id()}` } });
  }

  async del(): Promise<void> {
    this.errorMessage.set('');
    try {
      await this.data.deleteStory(this.id());
      this.close();
    } catch (e: any) {
      this.errorMessage.set(e?.message ?? 'Could not remove the story');
    }
  }

  close(): void { void this.router.navigate(['/home']); }
}
