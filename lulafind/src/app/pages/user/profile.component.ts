import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { ToastController } from '@ionic/angular/toast-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { PostCardComponent } from '../../shared/components/post-card.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { PlatformService } from '../../core/services/platform.service';
import { ModerationService } from '../../core/services/moderation.service';
import { SafetyService, CHECK_IN_COPY } from '../../core/services/safety.service';
import { CheckIn, CheckInStatus, Post, UserProfile, provinceName } from '../../core/models/types';
import { compact, contributorLabel, dayMonth, timeAgo } from '../../core/utils/format';
import { cover } from '../../core/data/seed';

@Component({
  selector: 'lf-profile',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonSkeletonText,
    RouterLink, IconComponent, AvatarComponent, EmptyComponent, PostCardComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-buttons slot="end">
          <button class="lf-icon-btn" (click)="more()" aria-label="More"><lf-icon name="more" [size]="20" /></button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      @if (!u()) {
        <div class="lf-card"><ion-skeleton-text style="height:200px"></ion-skeleton-text></div>
      } @else {
        <div class="hero">
          <img class="banner" [src]="banner()" alt="" />
          <div class="ident">
            <lf-avatar [src]="avatar()" [name]="u()!.displayName" [size]="82" [ring]="true"
               [status]="checkIn()?.status ?? null" />
            <h1 class="lf-h2">
              {{ u()!.displayName }}
              @if (u()!.verified) { <lf-icon name="award" [size]="16" /> }
              @if (u()!.isAdmin) { <span class="lf-chip lf-chip--success lf-tiny">admin</span> }
              @if (u()!.suspended) { <span class="lf-chip lf-chip--danger lf-tiny">suspended</span> }
            </h1>
            <div class="lf-meta">&#64;{{ u()!.handle }}@if (showLocation()) { · {{ location() }} }</div>
            @if (contributorLabel(u()!.contributorCredits)) {
              <span class="lf-contrib" [class.top]="mostNamed()">{{ contributorLabel(u()!.contributorCredits) }}</span>
            }
            @if (u()!.bio) { <p class="bio">{{ u()!.bio }}</p> }

            @if (showStats()) {
              <div class="stats">
                <div><strong>{{ compact(u()!.followers) }}</strong><span>followers</span></div>
                <div><strong>{{ compact(u()!.following) }}</strong><span>following</span></div>
                <div><strong>{{ compact(u()!.karma) }}</strong><span>help points</span></div>
                <div><strong>{{ posts().length }}</strong><span>posts</span></div>
              </div>
            }

            <!-- safety status -->
            @if (checkIn()) {
              <div class="checkin" [class.safe]="checkIn()!.status === 'safe'"
                   [class.warn]="checkIn()!.status === 'unfamiliar'" [class.bad]="checkIn()!.status === 'need_help'">
                <lf-icon [name]="checkIn()!.status === 'safe' ? 'check' : checkIn()!.status === 'unfamiliar' ? 'map' : 'alert'" [size]="18" />
                <div class="lf-grow">
                  <strong>{{ checkInLabel() }}</strong>
                  <span class="lf-small">{{ timeAgo(checkIn()!.at) }}@if (checkIn()!.note) { · {{ checkIn()!.note }} }</span>
                  @if (checkIn()!.liveShareOn && checkIn()!.location) {
                    <span class="lf-small live">
                      <lf-icon name="target" [size]="12" /> sharing live location
                      @if (isMe()) { · {{ liveLeft() }} left }
                    </span>
                  }
                </div>
              </div>
            }

            <div class="acts">
              @if (!isMe()) {
                <button class="lf-btn lf-btn--sm" [class.lf-btn--ghost]="following() || followRequested()" (click)="toggleFollow()">
                  <lf-icon [name]="following() ? 'check' : followRequested() ? 'clock' : 'plus'" [size]="15" />
                  {{ following() ? 'Following' : followRequested() ? 'Requested' : 'Follow' }}
                </button>
                <button class="lf-btn lf-btn--sm" (click)="share()"><lf-icon name="share" [size]="15" /> Share</button>
                @if (canMessage()) {
                  <button class="lf-btn lf-btn--sm lf-btn--ghost" (click)="message()"><lf-icon name="chat" [size]="15" /> Message</button>
                }
              } @else {
                <button class="lf-btn lf-btn--sm lf-btn--ghost" routerLink="/me"><lf-icon name="edit" [size]="15" /> Edit profile</button>
                <button class="lf-btn lf-btn--sm lf-btn--ghost" (click)="checkInSheet()">
                  <lf-icon name="target" [size]="15" /> More options
                </button>
              }
            </div>
            @if (isMe()) {
              <div class="quick">
                <span class="quick-label">How are you right now?</span>
                <div class="quick-row">
                  <button class="quickbtn safe" [class.on]="checkIn()?.status === 'safe'"
                          [disabled]="saving()" (click)="quickCheckIn('safe')">
                    <lf-icon name="check" [size]="17" /> I am safe
                  </button>
                  <button class="quickbtn help" [class.on]="checkIn()?.status === 'need_help'"
                          [disabled]="saving()" (click)="quickCheckIn('need_help')">
                    <lf-icon name="alert" [size]="17" /> I need help
                  </button>
                </div>
                @if (saving()) { <p class="lf-small lf-muted" style="margin:2px 0 0">Saving…</p> }
                @if (checkInError() && !saving()) { <p class="err">{{ checkInError() }}</p> }
              </div>
            }

            <div class="lf-meta" style="margin-top:10px">Joined {{ dayMonth(u()!.createdAt) }}</div>
          </div>
        </div>

        @if (showSpotlights() && spotlights().length) {
          <h3 class="section">Spotlight communities</h3>
          <div class="lf-scroller">
            @for (s of spotlights(); track s.id) {
              <a class="sp" [routerLink]="'/spotlight/' + s.id">
                <strong>{{ s.surname }}</strong>
                <span>{{ s.postIds.length }} posts</span>
              </a>
            }
          </div>
        }

        <h3 class="section">Posts</h3>
        @if (!posts().length) {
          <lf-empty icon="book" title="No public posts yet" message="Posts set to followers-only or spotlight-only will not appear here." />
        }
        @for (p of posts(); track p.id) {
          <lf-post-card [post]="p" [author]="u()!" chatState="off"
                        (vote)="vote(p, $event)" (comment)="open(p)" (share)="sharePost(p)" (more)="open(p)" />
        }
      }
    </ion-content>

    @if (checking()) {
      <div class="sheetwrap" (click)="checking.set(false)">
        <div class="sheet" (click)="$event.stopPropagation()">
          <div class="lf-row-between">
            <h3 class="lf-h2">How are you?</h3>
            <button class="lf-icon-btn" (click)="checking.set(false)"><lf-icon name="x" [size]="20" /></button>
          </div>
          <p class="lf-small lf-muted">
            Your answer shows on your profile. You do not have to set one. Nothing is shared unless you choose to.
          </p>
          <div class="choices">
            @for (c of checkInOptions; track c.key) {
              <button class="choice" [class.on]="picked() === c.key" (click)="picked.set(c.key)">
                <lf-icon [name]="c.icon" [size]="20" />
                <span><strong>{{ c.label }}</strong><small>{{ c.detail }}</small></span>
              </button>
            }
          </div>
          <label class="row-check">
            <input type="checkbox" [checked]="shareLocation()" (change)="shareLocation.set($any($event.target).checked)" />
            <span>Attach where I am now</span>
          </label>
          <label class="row-check">
            <input type="checkbox" [checked]="live()" (change)="live.set($any($event.target).checked)" />
            <span>Share my live location for 1 hour (it stops by itself)</span>
          </label>
          @if (checkInError()) { <p class="err">{{ checkInError() }}</p> }
          <div class="row">
            <button class="lf-btn lf-btn--ghost" (click)="clearStatus()">Clear my status</button>
            <button class="lf-btn lf-btn--primary" [disabled]="!picked() || safetyBusy()" (click)="doCheckIn()">
              {{ safetyBusy() ? 'Saving…' : 'Check in' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .hero { position: relative; }
    .banner { width: 100%; height: 132px; object-fit: cover; display: block; }
    .ident { padding: 0 var(--lf-gap) 16px; margin-top: -42px; display: flex; flex-direction: column; gap: 8px; }
    .ident h1 { display: flex; align-items: center; gap: 6px; margin: 0; flex-wrap: wrap; }
    .ident h1 lf-icon { color: var(--lf-beacon); }
    .bio { margin: 0; font-size: 14px; line-height: 1.5; }
    .stats { display: flex; gap: 18px; }
    .stats div { display: flex; flex-direction: column; }
    .stats strong { font-size: 17px; }
    .stats span { font-size: 11.5px; color: var(--lf-muted); }
    .quick { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding: 12px 13px;
      border-radius: 14px; background: var(--lf-card); border: 1px solid var(--lf-line); }
    .quick-label { font-size: 12.5px; font-weight: 800; color: var(--lf-muted); }
    .quick-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .quickbtn { display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      min-height: 46px; border-radius: 12px; border: 1.5px solid var(--lf-line);
      background: transparent; color: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
    .quickbtn:active { transform: scale(.98); }
    .quickbtn.safe { border-color: var(--lf-ubuntu); color: var(--lf-ubuntu); }
    .quickbtn.safe.on { background: var(--lf-ubuntu); color: #04150c; border-color: var(--lf-ubuntu); }
    .quickbtn.help { border-color: var(--lf-signal); color: var(--lf-signal); }
    .quickbtn.help.on { background: var(--lf-signal); color: #1b0603; border-color: var(--lf-signal); }
    .quickbtn:disabled { opacity: .55; cursor: wait; }
    .checkin { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border-radius: 12px;
      background: color-mix(in srgb, var(--lf-ubuntu) 16%, transparent); }
    .checkin div { display: flex; flex-direction: column; gap: 1px; }
    .checkin.warn { background: color-mix(in srgb, var(--lf-marigold) 18%, transparent); }
    .checkin.bad { background: color-mix(in srgb, var(--lf-signal) 18%, transparent); }
    .checkin .live { display: inline-flex; align-items: center; gap: 5px; color: var(--lf-ubuntu); font-weight: 700; }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .section { padding: 16px var(--lf-gap) 6px; font-size: 15px; font-weight: 800; }
    .sp { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 12px;
      border: 1px solid var(--lf-line); background: var(--lf-card); color: inherit; text-decoration: none; min-width: 140px; }
    .sp span { font-size: 11.5px; color: var(--lf-muted); }
    .sheetwrap { position: fixed; inset: 0; z-index: 40; background: rgba(4, 8, 20, .72);
      display: flex; align-items: flex-end; justify-content: center; }
    .sheet { width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; background: var(--lf-card);
      border-radius: 18px 18px 0 0; padding: 18px 18px 30px; display: flex; flex-direction: column; gap: 10px; }
    .sheet p { margin: 0; line-height: 1.5; }
    .choices { display: flex; flex-direction: column; gap: 8px; }
    .choice { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px;
      border: 1px solid var(--lf-line); background: var(--lf-card-2); color: inherit; text-align: left; cursor: pointer; }
    .choice.on { border-color: var(--lf-beacon); background: color-mix(in srgb, var(--lf-beacon) 12%, transparent); }
    .choice span { display: flex; flex-direction: column; gap: 2px; }
    .choice small { color: var(--lf-muted); font-size: 12px; line-height: 1.35; }
    .row-check { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--lf-muted); }
    .row-check input { width: 19px; height: 19px; accent-color: var(--lf-beacon); }
    .row { display: flex; gap: 10px; margin-top: 6px; }
    .row .lf-btn { flex: 1; }
    .err { color: var(--lf-signal); font-size: 12.5px; }
  `]
})
export class ProfileComponent implements OnInit {
  protected data = inject(DataService);
  protected auth = inject(AuthService);
  private chat = inject(ChatService);
  private platform = inject(PlatformService);
  private mod = inject(ModerationService);
  private safety = inject(SafetyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);
  private alert = inject(AlertController);

  protected readonly compact = compact;
  protected readonly dayMonth = dayMonth;
  protected readonly timeAgo = timeAgo;
  protected readonly contributorLabel = contributorLabel;
  readonly mostNamed = signal(false);
  protected readonly provinceName = provinceName;

  readonly checkInOptions = [
    { key: 'safe' as CheckInStatus, icon: 'check', label: CHECK_IN_COPY.safe.label, detail: CHECK_IN_COPY.safe.detail },
    { key: 'unfamiliar' as CheckInStatus, icon: 'map', label: CHECK_IN_COPY.unfamiliar.label, detail: CHECK_IN_COPY.unfamiliar.detail },
    { key: 'need_help' as CheckInStatus, icon: 'alert', label: CHECK_IN_COPY.need_help.label, detail: CHECK_IN_COPY.need_help.detail }
  ];

  u = signal<UserProfile | null>(null);
  following = signal(false);
  followRequested = signal(false);
  checking = signal(false);
  picked = signal<CheckInStatus | null>(null);
  shareLocation = signal(false);
  live = signal(false);
  private tick = signal(0);

  readonly isMe = computed(() => this.u()?.id === this.auth.viewerId);
  readonly avatar = computed(() => this.data.avatarFor(this.u()));
  readonly banner = computed(() => cover(this.u()?.surname || this.u()?.displayName || 'LulaFind'));
  readonly location = computed(() => this.auth.locationLabel(this.u()));
  readonly posts = computed(() => {
    const id = this.u()?.id;
    return this.data.feed().filter((p) => p.authorId === id);
  });
  readonly spotlights = computed(() => {
    const id = this.u()?.id;
    return id ? this.data.spotlights().filter((s) => s.memberIds.includes(id)) : [];
  });

  /** Privacy: only show what this person allows. */
  readonly showLocation = computed(() => this.isMe() || this.u()?.privacy?.showLocation === true);
  readonly showStats = computed(() => this.isMe() || this.u()?.privacy?.showStats !== false);
  readonly showSpotlights = computed(() => this.isMe() || this.u()?.privacy?.showSpotlights !== false);
  readonly canMessage = computed(() => !this.u()?.suspended && this.u()?.privacy?.allowMessages !== false);

  readonly checkIn = computed(() => {
    void this.tick();
    return this.safety.visibleCheckIn(this.u(), this.auth.viewerId);
  });

  /** Local to the quick buttons so they react the instant you tap. */
  readonly saving = signal(false);

  readonly safetyBusy = computed(() => this.safety.busy());
  readonly checkInError = computed(() => this.safety.error());

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.u.set((await this.data.profile(id)) ?? null);
    const followState = await this.data.followStatus(id);
    this.following.set(followState === 'accepted');
    this.followRequested.set(followState === 'pending');
    await this.loadBadge();
  }

  private async loadBadge(): Promise<void> {
    const n = this.u()?.contributorCredits ?? 0;
    if (n <= 0) { this.mostNamed.set(false); return; }
    this.mostNamed.set(n >= await this.data.topContributorCount());
  }

  checkInLabel(): string {
    const s = this.checkIn()?.status;
    return s ? `${CHECK_IN_COPY[s].ring} · ${CHECK_IN_COPY[s].short}` : '';
  }

  liveLeft(): string {
    const until = this.checkIn()?.liveUntil;
    if (!until) return '';
    const secs = Math.max(0, Math.round((until - Date.now()) / 1000));
    const m = Math.floor(secs / 60);
    return `${m}:${String(secs % 60).padStart(2, '0')}`;
  }

  /**
   * One tap from the profile. No sheet, no extra steps, no location - the two
   * answers people actually need in a hurry. The full sheet stays available for
   * "unfamiliar place", attaching a location and the 1-hour live share.
   */
  async quickCheckIn(status: 'safe' | 'need_help'): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.safety.checkIn({ status });
      this.u.set((await this.data.profile(this.u()!.id)) ?? null);
      await this.say(status === 'safe' ? 'Marked safe. Your ring is green.' : 'Help requested. Your followers are being told.');
    } catch {
      /* the panel under the buttons shows why */
    } finally {
      this.saving.set(false);
    }
  }

  async checkInSheet(): Promise<void> {
    this.picked.set(this.safety.myCheckIn()?.status ?? null);
    this.shareLocation.set(false);
    this.live.set(!!this.safety.myCheckIn()?.liveShareOn);
    this.checking.set(true);
    if (this.live()) this.startTicking();
  }

  private tickTimer: ReturnType<typeof setInterval> | null = null;

  private startTicking(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick.update((n) => n + 1), 1000);
  }

  async doCheckIn(): Promise<void> {
    const status = this.picked();
    if (!status) return;
    try {
      await this.safety.checkIn({ status, shareLocation: this.shareLocation(), live: this.live() });
      this.u.set((await this.data.profile(this.u()!.id)) ?? null);
      this.checking.set(false);
      await this.say(this.live() ? 'Checked in. Your live location stops in 1 hour.' : 'Checked in.');
    } catch {
      /* the sheet shows the reason */
    }
  }

  async clearStatus(): Promise<void> {
    await this.safety.clearCheckIn();
    this.u.set((await this.data.profile(this.u()!.id)) ?? null);
    this.checking.set(false);
    await this.say('Status cleared');
  }

  async toggleFollow(): Promise<void> {
    const u = this.u();
    if (!u) return;
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/auth'], { queryParams: { next: '/user/' + u.id } });
      return;
    }
    try {
      await this.data.toggleFollow(u.id);
      const state = await this.data.followStatus(u.id);
      this.following.set(state === 'accepted');
      this.followRequested.set(state === 'pending');
    } catch (e: any) {
      await this.say(e?.message ?? 'Could not follow');
    }
  }

  async message(): Promise<void> {
    const u = this.u();
    if (!u) return;
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/auth']);
      return;
    }
    const mutual = await this.data.mutualFollow(u.id);
    if (!mutual) {
      await this.say('Private chat needs a shared post plus mutual follows. Follow them first.');
      return;
    }
    const thread = await this.chat.ensureThread(null, u.id, 'friend');
    if (thread) await this.router.navigate(['/chat', thread.id]);
  }

  async share(): Promise<void> {
    const u = this.u();
    if (!u) return;
    await this.platform.share(`${u.displayName} on LulaFind`, `${u.displayName} - LulaFind`, this.platform.link(`/user/${u.id}`));
  }

  vote(p: Post, v: 'up' | 'down'): void {
    void this.data.vote(p.id, v);
  }

  open(p: Post): void {
    void this.router.navigate(['/post', p.id]);
  }

  async sharePost(p: Post): Promise<void> {
    await this.platform.share(p.title, `${p.title}\n\nShared from LulaFind`, this.platform.link(`/post/${p.id}`));
    await this.data.recordShare(p.id);
  }

  async more(): Promise<void> {
    const u = this.u();
    if (!u) return;
    if (this.isMe()) {
      await this.router.navigate(['/me']);
      return;
    }
    const a = await this.alert.create({
      header: u.displayName,
      buttons: [
        { text: 'Share profile', handler: () => void this.share() },
        { text: 'Report this person', role: 'destructive', handler: () => void this.report() },
        ...(this.mod.isAdmin()
          ? [
              { text: u.suspended ? 'Unsuspend (admin)' : 'Suspend (admin)', role: 'destructive' as const, handler: () => void this.suspend(u) },
              { text: 'Remove this person (admin)', role: 'destructive' as const, handler: () => void this.remove(u) }
            ]
          : []),
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await a.present();
  }

  async report(): Promise<void> {
    const u = this.u();
    if (!u) return;
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/auth'], { queryParams: { next: '/user/' + u.id } });
      return;
    }
    const a = await this.alert.create({
      header: `Report ${u.displayName}`,
      message: 'A LulaFind admin reviews every report.',
      inputs: this.mod.reasons.map((r) => ({ name: 'reason', type: 'radio' as const, label: r.label, value: r.id })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send report',
          handler: async (v: any) => {
            try {
              await this.mod.report({ target: 'user', targetId: u.id, summary: u.displayName, reason: v?.reason ?? 'other' });
              await this.say('Report sent. Thank you.');
            } catch (e: any) {
              await this.say(e?.message ?? 'Could not send the report');
            }
          }
        }
      ]
    });
    await a.present();
  }

  async suspend(u: UserProfile): Promise<void> {
    const a = await this.alert.create({
      header: u.suspended ? 'Lift the suspension?' : 'Suspend this person?',
      inputs: [{ name: 'note', type: 'text', placeholder: 'Reason (they will see this)' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          role: 'destructive',
          handler: async (v: any) => {
            await this.mod.suspendUser(u.id, String(v?.note ?? '').trim() || 'No reason given', !u.suspended);
            this.u.set((await this.data.profile(u.id)) ?? null);
            await this.say(u.suspended ? 'Suspension lifted' : 'Account suspended');
          }
        }
      ]
    });
    await a.present();
  }

  async remove(u: UserProfile): Promise<void> {
    const a = await this.alert.create({
      header: 'Remove this person?',
      message: `${u.displayName} and everything they posted will be deleted.`,
      inputs: [{ name: 'note', type: 'text', placeholder: 'Reason' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async (v: any) => {
            await this.mod.removeUser(u.id, String(v?.note ?? '').trim() || 'No reason given');
            await this.data.refresh();
            await this.router.navigate(['/home']);
          }
        }
      ]
    });
    await a.present();
  }

  private async say(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 2400, position: 'bottom' });
    await t.present();
  }
}
