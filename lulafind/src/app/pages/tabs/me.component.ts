import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonInput } from '@ionic/angular/ion-input';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ToastController } from '@ionic/angular/toast-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { ChatState, PostCardComponent } from '../../shared/components/post-card.component';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { PlatformService } from '../../core/services/platform.service';
import { ModerationService } from '../../core/services/moderation.service';
import { compact, contributorLabel, dayMonth, parseFullName } from '../../core/utils/format';
import { PROVINCES, ProvinceCode, Post, UserProfile, defaultPrivacy, provinceName } from '../../core/models/types';
import { CHECK_IN_COPY, RING_KEY, SafetyService } from '../../core/services/safety.service';
import { MediaService } from '../../core/services/media.service';

@Component({
  selector: 'lf-me',
  standalone: true,
  imports: [
    IonContent, IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption, IonItem, IonLabel, IonToggle,
    RouterLink, IconComponent, AvatarComponent, EmptyComponent, PostCardComponent
  ],
  template: `
    <ion-content class="lf-page">
      @if (!me()) {
        <lf-empty icon="user" title="You are browsing as a guest"
                  message="You can read every public case. Sign in to post, vote, comment and chat."
                  actionLabel="Sign in / Sign up" (action)="goAuth()" />
      } @else {
        <div class="hero">
          <button class="face" type="button" (click)="addPhoto()" aria-label="Add a profile photo">
            <lf-avatar [src]="avatar()" [name]="me()!.displayName" [size]="84" [ring]="true"
                       [status]="me()!.checkIn?.status ?? null" />
            <span>{{ me()!.avatarUrl ? 'Change photo' : 'Add photo' }}</span>
          </button>
          <div class="lf-row-between">
            <div>
              <h1 class="lf-h2">
                {{ me()!.displayName }}
                @if (me()!.verified) { <lf-icon name="award" [size]="16" /> }
              </h1>
              <div class="lf-meta">&#64;{{ me()!.handle }} · {{ location() }}</div>
              @if (contributorLabel(me()!.contributorCredits)) {
                <span class="lf-contrib" [class.top]="mostNamed()">{{ contributorLabel(me()!.contributorCredits) }}</span>
              }
            </div>
            <button class="lf-icon-btn" routerLink="/settings"><lf-icon name="settings" [size]="20" /></button>
          </div>
          @if (me()!.bio) { <p class="bio">{{ me()!.bio }}</p> }
          <div class="stats">
            <button type="button" (click)="openPeople('followers')"><strong>{{ data.followerIds().length }}</strong><span>followers</span></button>
            <button type="button" (click)="openPeople('following')"><strong>{{ data.followingIds().length }}</strong><span>following</span></button>
            <div><strong>{{ compact(me()!.karma) }}</strong><span>help points</span></div>
            <div><strong>{{ myPosts().length }}</strong><span>posts</span></div>
          </div>
          @if (people()) {
            <div class="requests">
              <div class="lf-row-between">
                <h3 class="lf-h2">{{ people() === 'followers' ? 'People who follow you' : 'People you follow' }}</h3>
                <button class="lf-btn lf-btn--ghost lf-btn--sm" type="button" (click)="people.set(null)">Close</button>
              </div>
              @if (!peopleRows().length) {
                <p class="lf-small lf-muted">No one here yet.</p>
              }
              @for (u of peopleRows(); track u.id) {
                <div class="req">
                  <lf-avatar [src]="data.avatarFor(u)" [name]="u.displayName" [size]="40" />
                  <div class="lf-grow">
                    <strong>{{ u.displayName }}</strong>
                    <span class="lf-small lf-muted">&#64;{{ u.handle }}</span>
                  </div>
                  @if (people() === 'following') {
                    <button class="lf-btn lf-btn--sm lf-btn--ghost" type="button" (click)="unfollow(u.id)">Unfollow</button>
                  }
                  <a class="lf-btn lf-btn--sm" [routerLink]="'/user/' + u.id">View</a>
                </div>
              }
            </div>
          }
          @if (statusLine()) {
            <div class="status" [attr.data-status]="me()!.checkIn?.status">
              <lf-icon [name]="me()!.checkIn?.status === 'safe' ? 'check' : 'alert'" [size]="15" />
              {{ statusLine() }}
              <button type="button" class="clear" (click)="clearStatus()">Clear</button>
            </div>
          }
          <p class="ring-key">{{ ringKey }}</p>
          <div class="lf-row" style="gap:8px;flex-wrap:wrap">
            <button class="lf-btn lf-btn--primary lf-btn--sm" routerLink="/user/{{ me()!.id }}">
              <lf-icon name="shield" [size]="15" /> Check in
            </button>
            <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="editing.set(true); prepareEdit()">
              <lf-icon name="edit" [size]="15" /> Edit profile
            </button>
            <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="shareProfile()">
              <lf-icon name="share" [size]="15" /> Share
            </button>
          </div>
          <div class="lf-meta" style="margin-top:10px">Joined {{ dayMonth(me()!.createdAt) }}</div>
        </div>

        <div class="quick">
          <a class="q" routerLink="/notifications"><lf-icon name="bell" [size]="20" /><span>Alerts</span>
            @if (data.unreadNotifications() > 0) { <em class="lf-badge">{{ data.unreadNotifications() }}</em> }</a>
          <a class="q" routerLink="/safety"><lf-icon name="shield" [size]="20" /><span>Safety</span></a>
          <a class="q" routerLink="/tips"><lf-icon name="info" [size]="20" /><span>Tips</span></a>
          <a class="q" routerLink="/spotlight"><lf-icon name="users" [size]="20" /><span>Spotlight</span></a>
          <a class="q" routerLink="/settings"><lf-icon name="lock" [size]="20" /><span>Privacy</span></a>
          @if (isAdmin()) {
            <a class="q" routerLink="/admin"><lf-icon name="shield" [size]="20" /><span>Admin</span>
              @if (mod.openCount() > 0) { <em class="lf-badge">{{ mod.openCount() }}</em> }</a>
          }
          <a class="q" (click)="signOut()"><lf-icon name="logout" [size]="20" /><span>Sign out</span></a>
        </div>

        @if (data.followRequests().length) {
          <div class="requests">
            <div class="lf-row-between">
              <h3 class="lf-h2"><lf-icon name="users" [size]="16" /> Follow requests</h3>
              <span class="lf-badge">{{ data.followRequests().length }}</span>
            </div>
            @for (r of requestPeople(); track r.id) {
              <div class="req">
                <lf-avatar [src]="data.avatarFor(r.u)" [name]="r.u?.displayName ?? '?'" [size]="40" />
                <div class="lf-grow">
                  <strong>{{ r.u?.displayName ?? 'A member' }}</strong>
                  <span class="lf-small lf-muted">wants to follow you</span>
                </div>
                <button class="lf-btn lf-btn--sm" (click)="respond(r.id, true)">Accept</button>
                <button class="lf-btn lf-btn--sm lf-btn--ghost" (click)="respond(r.id, false)">Decline</button>
              </div>
            }
          </div>
        }

        <div class="tabs">
          @for (t of tabs; track t.key) {
            <button class="tab" [class.on]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }}</button>
          }
        </div>

        @if (visible().length) {
          @for (p of visible(); track p.id) {
            <lf-post-card [post]="p" [author]="data.authorOf(p.authorId) ?? null" chatState="off"
                          (vote)="vote(p, $event)" (comment)="open(p)" (share)="share(p)" (more)="more(p)" />
          }
        } @else {
          <lf-empty icon="book" [title]="emptyTitle()" message="Anything you post shows up here instantly."
                    actionLabel="Create a post" (action)="create()" />
        }

        <div class="lf-pad lf-safe-bottom" style="padding-top:18px">
          <button class="lf-btn lf-btn--ghost lf-btn--block" (click)="signOut()">
            <lf-icon name="logout" [size]="16" /> Sign out
          </button>
        </div>
      }
    </ion-content>

    <ion-modal [isOpen]="editing()" (didDismiss)="editing.set(false)" [initialBreakpoint]="0.8" [breakpoints]="[0.5, 0.8, 1]">
      <ng-template>
        <div class="sheet">
          <h3 class="lf-h2">Edit profile</h3>
          @if (formError()) { <p class="err"><lf-icon name="alert" [size]="15" /> {{ formError() }}</p> }
          <div class="ident-lock">
            <lf-avatar [src]="avatar()" [name]="me()!.displayName" [size]="36" />
            <div>
              <span class="k">Name</span>
              <strong>{{ me()!.displayName }}</strong>
              <span class="k">Username &#64;{{ me()!.handle }}</span>
            </div>
            <lf-icon name="lock" [size]="15" />
          </div>
          <p class="lf-small lf-muted">Your name was set from the full name you entered when you created the account. It cannot be edited. You can still follow, chat, comment, and add a photo.</p>
          <button class="lf-btn lf-btn--ghost lf-btn--block" type="button" (click)="addPhoto()">
            <lf-icon name="camera" [size]="15" /> {{ me()!.avatarUrl ? 'Change profile photo' : 'Add profile photo' }}
          </button>
          @if (me()!.avatarUrl) {
            <button class="lf-btn lf-btn--ghost lf-btn--block" type="button" (click)="removePhoto()">Use initials instead</button>
          }
          <ion-item><ion-label position="stacked">Town</ion-label>
            <ion-input [value]="form.town" (ionInput)="form.town = $any($event.target).value"></ion-input></ion-item>
          <ion-item><ion-label position="stacked">Province</ion-label>
            <ion-select [value]="form.province" (ionChange)="form.province = $any($event.detail).value" placeholder="Province">
              @for (p of provinces; track p.code) { <ion-select-option [value]="p.code">{{ p.name }}</ion-select-option> }
            </ion-select></ion-item>
          <ion-item><ion-label position="stacked">Bio</ion-label>
            <ion-textarea rows="3" [value]="form.bio" (ionInput)="form.bio = $any($event.target).value"></ion-textarea></ion-item>

          <ion-item>
            <ion-label>
              <strong>Let LulaFind match me to cases</strong><br />
              <span class="lf-muted lf-small">If your name matches a KhumbulEkhaya post, we may ask if it is you. You can turn this off at any time.</span>
            </ion-label>
            <ion-toggle [checked]="form.findableProfile" (ionChange)="form.findableProfile = $any($event.detail).checked"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label>
              <strong>Safety beacon</strong><br />
              <span class="lf-muted lf-small">Send "I am safe" check-ins with your location to people you choose.</span>
            </ion-label>
            <ion-toggle [checked]="form.safetyBeacon" (ionChange)="form.safetyBeacon = $any($event.detail).checked"></ion-toggle>
          </ion-item>

          <h4 class="lf-h2" style="margin:14px 0 6px">What other people see</h4>
          <ion-item>
            <ion-label><strong>Show my town and province</strong></ion-label>
            <ion-toggle [checked]="form.showLocation" (ionChange)="form.showLocation = $any($event.detail).checked"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label><strong>Show my follower numbers</strong></ion-label>
            <ion-toggle [checked]="form.showStats" (ionChange)="form.showStats = $any($event.detail).checked"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label><strong>Show my Spotlight communities</strong></ion-label>
            <ion-toggle [checked]="form.showSpotlights" (ionChange)="form.showSpotlights = $any($event.detail).checked"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label><strong>Let people message me</strong></ion-label>
            <ion-toggle [checked]="form.allowMessages" (ionChange)="form.allowMessages = $any($event.detail).checked"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label>
              <strong>Ask my followers to check on me</strong><br />
              <span class="lf-muted lf-small">Only if a live location share ends and I have not said I am safe.</span>
            </ion-label>
            <ion-toggle [checked]="form.notifyFollowersOnExpiry" (ionChange)="form.notifyFollowersOnExpiry = $any($event.detail).checked"></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label>
              <strong>Approve follow requests</strong><br />
              <span class="lf-muted lf-small">
                Off: anyone can follow you straight away. On: they send a request you accept or decline.
              </span>
            </ion-label>
            <ion-toggle [checked]="form.requireFollowApproval"
                        (ionChange)="form.requireFollowApproval = $any($event.detail).checked"></ion-toggle>
          </ion-item>

          <div class="row">
            <button class="lf-btn lf-btn--ghost" (click)="editing.set(false)">Cancel</button>
            <button class="lf-btn lf-btn--primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .hero { padding: 26px var(--lf-gap) 14px; display: flex; flex-direction: column; gap: 12px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--lf-beacon) 9%, transparent), transparent 70%); }
    .hero h1 { display: flex; align-items: center; gap: 6px; }
    .hero h1 lf-icon { color: var(--lf-beacon); }
    .bio { margin: 0; font-size: 14px; line-height: 1.5; }
    .status { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; padding: 7px 12px; flex-wrap: wrap;
      border-radius: 999px; font-size: 12.5px; font-weight: 700;
      background: color-mix(in srgb, var(--lf-marigold) 18%, transparent); }
    .clear { border: 0; background: transparent; color: inherit; font-weight: 800; font-size: 12px; cursor: pointer; text-decoration: underline; }
    .status.safe { background: color-mix(in srgb, var(--lf-ubuntu) 18%, transparent); }
    .stats { display: flex; gap: 18px; }
    .stats div, .stats button { display: flex; flex-direction: column; align-items: flex-start;
      border: 0; background: transparent; color: inherit; padding: 0; cursor: pointer; }
    .stats strong { font-size: 17px; }
    .stats span { font-size: 11.5px; color: var(--lf-muted); }
    .quick { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 6px var(--lf-gap) 14px; }
    .q { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 13px 6px;
      border-radius: var(--lf-radius); border: 1px solid var(--lf-line); background: var(--lf-card);
      color: inherit; text-decoration: none; font-size: 12px; font-weight: 600; cursor: pointer; }
    .q:active { background: var(--lf-card-2); }
    .q .lf-badge { position: absolute; top: 8px; right: 10px; }
    .tabs { display: flex; gap: 8px; padding: 4px var(--lf-gap) 10px; border-bottom: 1px solid var(--lf-line); }
    .tab { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--lf-line); background: transparent;
      color: var(--lf-muted); font-weight: 700; font-size: 13px; cursor: pointer; }
    .tab.on { background: var(--lf-beacon); color: #1a1200; border-color: var(--lf-beacon); }
    .requests { margin: 12px var(--lf-gap) 0; padding: 12px 13px; border-radius: 14px;
      background: var(--lf-card); border: 1px solid color-mix(in srgb, var(--lf-beacon) 40%, var(--lf-line)); }
    .requests h3 { display: flex; align-items: center; gap: 7px; margin: 0; }
    .req { display: flex; align-items: center; gap: 9px; padding: 9px 0; border-top: 1px solid var(--lf-line); }
    .req strong { display: block; font-size: 14px; }
    .req span { display: block; }
    .field-err { color: var(--lf-signal); font-size: 12px; font-weight: 600; margin: -2px 0 6px 4px; }
    .ident-lock { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin: 4px 0 8px;
      border-radius: 12px; border: 1px dashed var(--lf-line); background: var(--lf-card-2); }
    .ident-lock .k { display: block; font-size: 11px; color: var(--lf-muted); font-weight: 700; }
    .ident-lock lf-icon { margin-left: auto; color: var(--lf-muted); }
    .face { align-self: flex-start; display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
      border: 0; background: transparent; color: inherit; padding: 0; cursor: pointer; }
    .face span { font-size: 12px; font-weight: 700; color: var(--lf-beacon); }
    .err { display: flex; align-items: center; gap: 8px; color: var(--lf-signal); font-size: 13px; margin: 6px 0 0; }
    ion-item.bad { --border-color: var(--lf-signal); box-shadow: inset 0 0 0 1.5px var(--lf-signal); }
    .sheet { padding: 20px var(--lf-gap) 34px; }
    .row { display: flex; gap: 10px; margin-top: 18px; }
    .row .lf-btn { flex: 1; }
  `]
})
export class MeComponent {
  protected data = inject(DataService);
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private safety = inject(SafetyService);
  private media = inject(MediaService);
  private alert = inject(AlertController);
  protected mod = inject(ModerationService);

  protected readonly compact = compact;
  protected readonly dayMonth = dayMonth;
  protected readonly provinceName = provinceName;
  protected readonly provinces = PROVINCES;
  protected readonly contributorLabel = contributorLabel;
  readonly mostNamed = signal(false);

  editing = signal(false);
  /** The pending requests with each requester's profile attached. */
  readonly requestPeople = computed(() =>
    this.data.followRequests().map((r) => ({ id: r.followerId, u: this.data.authorOf(r.followerId) ?? null }))
  );

  async respond(followerId: string, accept: boolean): Promise<void> {
    try {
      await this.data.respondToFollowRequest(followerId, accept);
      await this.toast.create({
        message: accept ? 'Accepted. They can follow you now.' : 'Request declined.',
        duration: 1800, position: 'bottom'
      }).then((t) => t.present());
    } catch (e: any) {
      await this.toast.create({ message: e?.message ?? 'Could not update the request', duration: 2200, position: 'bottom' })
        .then((t) => t.present());
    }
  }

  tab = signal<'posts' | 'saved' | 'khumbu'>('posts');
  tabs = [
    { key: 'posts' as const, label: 'My posts' },
    { key: 'saved' as const, label: 'Watchlist' },
    { key: 'khumbu' as const, label: 'KhumbulEkhaya' }
  ];

  form = {
    displayName: '', handle: '', surname: '', town: '',
    province: 'GP' as ProvinceCode, bio: '', findableProfile: true, safetyBeacon: false,
    showLocation: false, showStats: true, showSpotlights: true, allowMessages: true,
    notifyFollowersOnExpiry: true, requireFollowApproval: false
  };

  readonly me = computed(() => this.auth.user());
  readonly avatar = computed(() => this.data.avatarFor(this.me()));
  readonly location = computed(() => this.auth.locationLabel(this.me()));
  readonly myPosts = computed(() => {
    const id = this.auth.viewerId;
    return this.data.feed().filter((p) => p.authorId === id);
  });
  readonly visible = computed(() => {
    switch (this.tab()) {
      case 'saved': return this.data.feed().filter((p) => this.data.savedIds().includes(p.id));
      case 'khumbu': return this.myPosts().filter((p) => p.type === 'khumbulekhaya');
      default: return this.myPosts();
    }
  });

  constructor() {
    this.syncForm();
    void this.loadRequests();
    void this.loadBadge();
  }

  /**
   * Pull the pending requests, then make sure each requester's profile is in
   * the author cache so the row can show a name and a picture.
   */
  private async loadRequests(): Promise<void> {
    await this.data.loadFollowRequests();
    for (const r of this.data.followRequests()) {
      if (!this.data.authorOf(r.followerId)) {
        const u = await this.data.profile(r.followerId);
        if (u) this.data.touchAuthor(u);
      }
    }
  }

  private syncForm(): void {
    const u = this.me();
    if (!u) return;
    const p = u.privacy ?? defaultPrivacy();
    this.form = {
      displayName: u.displayName, handle: u.handle, surname: u.surname, town: u.town,
      province: u.province ?? 'GP', bio: u.bio, findableProfile: u.findableProfile, safetyBeacon: u.safetyBeacon,
      showLocation: p.showLocation, showStats: p.showStats, showSpotlights: p.showSpotlights,
      allowMessages: p.allowMessages, notifyFollowersOnExpiry: p.notifyFollowersOnExpiry,
      requireFollowApproval: p.requireFollowApproval
    };
  }

  emptyTitle(): string {
    return this.tab() === 'saved' ? 'Your watchlist is empty' : 'You have not posted yet';
  }

  touched = { name: false };
  readonly saving = signal(false);
  readonly formError = signal('');
  /** loaded once when the sheet opens, so typing stays instant */
  readonly handles = signal<string[]>([]);

  nameOk(): boolean {
    return parseFullName(this.form.displayName) !== null;
  }

  nameError(): string {
    return this.nameOk() ? '' : 'Enter your first name and surname';
  }

  /** Locked. Changes only when the second name changes. */
  lockedHandle(): string {
    const me = this.me();
    return this.auth.previewHandle(this.form.displayName, this.handles(), me?.handle ?? '', me?.surname ?? '');
  }

  /** Called when the edit sheet opens. */
  async prepareEdit(): Promise<void> {
    this.touched = { name: false };
    this.formError.set('');
    this.handles.set(await this.data.allHandles());
  }

  async addPhoto(): Promise<void> {
    this.formError.set('');
    const item = await this.media.pickImage({ source: 'gallery', quality: 70 });
    if (!item) {
      if (this.media.lastError()) this.formError.set(this.media.lastError()!);
      return;
    }
    const src = await this.media.compress(item.src, 480);
    await this.auth.updateProfile({ avatarUrl: src });
    this.data.touchAuthor(this.me()!);
    await this.toast.create({ message: 'Profile photo saved', duration: 1400, position: 'bottom' }).then((x) => x.present());
  }

  async removePhoto(): Promise<void> {
    await this.auth.updateProfile({ avatarUrl: '' });
    this.data.touchAuthor(this.me()!);
  }

  async save(): Promise<void> {
    this.formError.set('');
    this.saving.set(true);
    try {
      const {
        showLocation, showStats, showSpotlights, allowMessages,
        notifyFollowersOnExpiry, requireFollowApproval
      } = this.form;
      await this.auth.updateProfile({
        town: this.form.town.trim(),
        province: this.form.province,
        bio: this.form.bio.trim(),
        findableProfile: this.form.findableProfile,
        safetyBeacon: this.form.safetyBeacon,
        privacy: {
          showLocation, showStats, showSpotlights, allowMessages,
          autoShareLocation: false, notifyFollowersOnExpiry, requireFollowApproval
        }
      });
      this.data.touchAuthor(this.me()!);
      this.editing.set(false);
      void this.loadBadge();
      await this.toast.create({ message: 'Profile saved', duration: 1600, position: 'bottom' }).then((t) => t.present());
    } catch (e: any) {
      this.formError.set(e?.message ?? 'Could not save your profile');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadBadge(): Promise<void> {
    const n = this.me()?.contributorCredits ?? 0;
    if (n <= 0) { this.mostNamed.set(false); return; }
    this.mostNamed.set(n >= await this.data.topContributorCount());
  }

  readonly isAdmin = computed(() => this.auth.user()?.isAdmin === true);

  protected readonly ringKey = RING_KEY;

  async clearStatus(): Promise<void> {
    await this.safety.clearCheckIn();
    const t = await this.toast.create({ message: 'Check-in cleared. The ring is gone.', duration: 1600, position: 'bottom' });
    await t.present();
  }

  statusLine(): string {
    const c = this.me()?.checkIn;
    if (!c) return '';
    const copy = CHECK_IN_COPY[c.status];
    const label = `${copy.ring} · ${copy.short}`;
    return c.liveShareOn ? `${label} · sharing live location` : label;
  }

  people = signal<'followers' | 'following' | null>(null);
  peopleRows = signal<UserProfile[]>([]);

  async openPeople(kind: 'followers' | 'following'): Promise<void> {
    this.people.set(kind);
    const ids = kind === 'followers' ? this.data.followerIds() : this.data.followingIds();
    this.peopleRows.set(await this.data.people(ids));
  }

  async unfollow(id: string): Promise<void> {
    try {
      await this.data.toggleFollow(id);
      await this.openPeople('following');
    } catch (e: unknown) {
      await this.toast.create({ message: e instanceof Error ? e.message : 'Could not unfollow', duration: 2200, position: 'bottom' }).then((x) => x.present());
    }
  }

  async shareProfile(): Promise<void> {
    const u = this.me();
    if (!u) return;
    await this.platform.share(`${u.displayName} on LulaFind`, `Follow ${u.displayName} on LulaFind`, this.platform.link(`/user/${u.id}`));
  }

  vote(p: Post, v: 'up' | 'down'): void {
    void this.data.vote(p.id, v);
  }

  open(p: Post): void {
    void this.router.navigate(['/post', p.id]);
  }

  more(p: Post): void {
    void this.router.navigate(['/post', p.id]);
  }

  async share(p: Post): Promise<void> {
    await this.platform.share(p.title, `${p.title}\n\nShared from LulaFind`, this.platform.link(`/post/${p.id}`));
    await this.data.recordShare(p.id);
  }

  create(): void {
    void this.router.navigate(['/create']);
  }

  goAuth(): void {
    void this.router.navigate(['/auth']);
  }

  async signOut(): Promise<void> {
    const a = await this.alert.create({
      header: 'Sign out?',
      message: 'Your posts stay live. You can sign back in any time.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign out', role: 'destructive', handler: () => void this.auth.signOut() }
      ]
    });
    await a.present();
  }
}
