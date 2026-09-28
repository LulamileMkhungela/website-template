import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { ToastController } from '@ionic/angular/toast-controller';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { ChatState, PostCardComponent } from '../../shared/components/post-card.component';
import { StoryRailComponent } from '../../shared/components/story-rail.component';
import { FilterBarComponent } from '../../shared/components/filter-bar.component';
import { CHECK_IN_COPY } from '../../core/services/safety.service';
import { UserProfile } from '../../core/models/types';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { PlatformService } from '../../core/services/platform.service';
import { ModerationService } from '../../core/services/moderation.service';
import { POST_TYPE_META, Post } from '../../core/models/types';

@Component({
  selector: 'lf-home',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonRefresher, IonRefresherContent,
    IonInfiniteScroll, IonInfiniteScrollContent, IonSkeletonText,
    RouterLink, IconComponent, AvatarComponent, EmptyComponent, PostCardComponent, StoryRailComponent, FilterBarComponent
  ],
  template: `
    <ion-header class="fb-header" [translucent]="false">
      <!-- Level 1 Top Bar -->
      <div class="fb-topbar">
        <div class="fb-brand">
          <span class="fb-brand-text">LulaFind</span>
        </div>
        <div class="fb-tools">
          <button class="fb-tool-btn" (click)="onPromptClick()" aria-label="Create Case">
            <lf-icon name="plus" [size]="18" [weight]="2.5" />
          </button>
          <button class="fb-tool-btn" routerLink="/search" aria-label="Search">
            <lf-icon name="search" [size]="18" />
          </button>
          <button class="fb-tool-btn" routerLink="/me" aria-label="Menu">
            <lf-icon name="menu" [size]="18" />
          </button>
        </div>
      </div>

      <!-- Level 2 Navigation Tabs -->
      <div class="fb-nav-tabs">
        <button class="fb-tab active">
          <lf-icon name="home" [size]="22" />
        </button>
        <button class="fb-tab" routerLink="/spotlight">
          <lf-icon name="users" [size]="22" />
        </button>
        <button class="fb-tab" routerLink="/chats">
          <div class="fb-badge-wrap">
            <lf-icon name="chat" [size]="22" />
            @if (chat.unreadTotal() > 0) {
              <span class="fb-count-badge">{{ chat.unreadTotal() }}</span>
            }
          </div>
        </button>
        <button class="fb-tab" routerLink="/notifications">
          <div class="fb-badge-wrap">
            <lf-icon name="bell" [size]="22" />
            @if (data.unreadNotifications() > 0) {
              <span class="fb-count-badge">{{ data.unreadNotifications() }}</span>
            }
          </div>
        </button>
        <button class="fb-tab" routerLink="/tips">
          <lf-icon name="info" [size]="22" />
        </button>
      </div>
    </ion-header>

    <ion-content class="lf-page" [scrollY]="!isGuestLocked()">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content pullingText="Pull to refresh"></ion-refresher-content>
      </ion-refresher>

      <!-- Facebook "What's on your mind?" Create Post Box -->
      <div class="fb-create-card">
        <div class="fb-create-top" (click)="onPromptClick()">
          <lf-avatar [src]="auth.userAvatar()" [name]="auth.user()?.displayName ?? 'Guest'" [size]="40" />
          <div class="fb-create-input">
            <span>What's on your mind? Report a case...</span>
          </div>
        </div>
        <div class="fb-create-actions">
          <button class="fb-sub-btn" (click)="goReportMissing()">
            <lf-icon name="plus" [size]="16" />
            <span>Report Case</span>
          </button>
          <span class="fb-sub-divider"></span>
          <button class="fb-sub-btn" (click)="goSighting()">
            <lf-icon name="pin" [size]="16" />
            <span>Sighting</span>
          </button>
          <span class="fb-sub-divider"></span>
          <button class="fb-sub-btn" (click)="onPromptClick()">
            <lf-icon name="alert" [size]="16" />
            <span>Emergency</span>
          </button>
        </div>
      </div>

      <!-- Facebook Stories Rail -->
      <lf-story-rail (addStory)="onAddStory()" />

      <!-- Facebook Feed Filter Chips -->
      <lf-filter-bar
        [filter]="data.filter()"
        [missingCount]="missingPip()"
        (filterChange)="data.setFilter($event)"
        (reset)="data.resetFilter()" />

      @if (data.loading() && !data.feed().length) {
        @for (i of [1, 2, 3]; track i) {
          <div class="fb-card-skel"><ion-skeleton-text style="height:160px"></ion-skeleton-text></div>
        }
      }

      @if (!data.loading() && !data.feed().length) {
        <lf-empty icon="search" title="No cases here yet"
                  message="Posts people create will show in this feed."
                  actionLabel="Reset filters" (action)="data.resetFilter()" />
      }

      @for (p of displayedFeed(); track p.id; let i = $index) {
        <lf-post-card
          [post]="p"
          [author]="data.authorOf(p.authorId) ?? null"
          [chatState]="chatStateOf(p)"
          (vote)="onVote(p, $event)"
          (comment)="onComment(p)"
          (share)="onShare(p)"
          (chat)="onChat(p)"
          (more)="onMore(p)"
          (savedChange)="onSave(p)" />
      }

      @if (isGuestLocked()) {
        <div class="guest-scroll-lock" role="region" aria-label="Sign in or Create Account">
          <div class="guest-scroll-lock__card">
            <span class="guest-scroll-lock__badge">
              <lf-icon name="lock" [size]="28" />
            </span>
            <h2 class="guest-scroll-lock__title">Sign in or Create an Account to view more</h2>
            <p class="guest-scroll-lock__body">
              You have viewed 4 posts in guest preview mode. Join LulaFind to view full case details and help bring missing people home across South Africa.
            </p>
            <div class="guest-scroll-lock__btns">
              <button class="snap-btn snap-btn--blue snap-block" (click)="goSignUp()">
                Create free account
              </button>
              <button class="snap-btn snap-btn--black snap-block" (click)="goSignIn()">
                Sign in
              </button>
            </div>
          </div>
        </div>
      }

      @if (auth.signedIn()) {
        <ion-infinite-scroll threshold="180px" (ionInfinite)="onInfinite($event)">
          <ion-infinite-scroll-content loadingSpinner="circles" loadingText="Loading more"></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      }
    </ion-content>
  `,
  styles: [`
    .fb-header {
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .fb-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      height: 48px;
      background: #ffffff;
    }
    .fb-brand-text {
      font-size: 28px;
      font-weight: 900;
      color: #1877f2;
      letter-spacing: -1.2px;
    }
    .fb-tools { display: flex; align-items: center; gap: 8px; }
    .fb-tool-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #e4e6eb;
      border: 0;
      color: #050505;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    /* Level 2 Navigation Tabs */
    .fb-nav-tabs {
      display: flex;
      align-items: center;
      justify-content: space-around;
      height: 44px;
      background: #ffffff;
      border-top: 1px solid #f0f2f5;
      border-bottom: 1px solid #ced0d4;
    }
    .fb-tab {
      flex: 1;
      height: 100%;
      border: 0;
      background: transparent;
      color: #65676b;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
    }
    .fb-tab.active {
      color: #1877f2;
    }
    .fb-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: #1877f2;
    }
    .fb-badge-wrap { position: relative; }
    .fb-count-badge {
      position: absolute;
      top: -4px;
      right: -8px;
      background: #e41e3f;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      border-radius: 999px;
      padding: 1px 5px;
      min-width: 16px;
    }

    /* Facebook "What's on your mind?" Card */
    .fb-create-card {
      background: #ffffff;
      margin: 0 0 8px;
      border-bottom: 1px solid #ced0d4;
    }
    .fb-create-top {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      cursor: pointer;
    }
    .fb-create-input {
      flex: 1;
      height: 38px;
      border-radius: 999px;
      background: #f0f2f5;
      padding: 0 16px;
      display: flex;
      align-items: center;
      color: #65676b;
      font-size: 14px;
      font-weight: 500;
    }
    .fb-create-actions {
      display: flex;
      align-items: center;
      border-top: 1px solid #f0f2f5;
      height: 40px;
    }
    .fb-sub-btn {
      flex: 1;
      height: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 0;
      background: transparent;
      color: #65676b;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .fb-sub-btn:active { background: #e4e6eb; }
    .fb-sub-divider { width: 1px; height: 20px; background: #ced0d4; flex-shrink: 0; }

    .fb-card-skel { background: #ffffff; margin: 8px 0; padding: 16px; border: 1px solid #ced0d4; }

    .guest-scroll-lock {
      margin: 16px 12px 28px;
      padding: 24px 20px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #ced0d4;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .guest-scroll-lock__badge {
      display: flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; border-radius: 50%;
      background: #e7f3ff; color: #1877f2;
    }
    .guest-scroll-lock__title { margin: 0; font-size: 18px; font-weight: 800; color: #050505; }
    .guest-scroll-lock__body { margin: 0; font-size: 13.5px; line-height: 1.45; color: #65676b; }
    .guest-scroll-lock__btns { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px; }
  `]
})
export class HomeComponent {
  protected data = inject(DataService);
  protected auth = inject(AuthService);
  protected chat = inject(ChatService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private sheetCtl = inject(ActionSheetController);
  private alertCtl = inject(AlertController);
  private mod = inject(ModerationService);

  readonly missingPip = computed(() =>
    this.data.feed().filter((p) => p.type === 'missing' && p.status === 'active').length
  );

  readonly isGuestLocked = computed(() => !this.auth.signedIn() && this.data.feed().length >= 4);

  readonly displayedFeed = computed(() => {
    const feed = this.data.feed();
    if (!this.auth.signedIn()) {
      return feed.slice(0, 4);
    }
    return feed;
  });

  private chatGates = signal<Record<string, ChatState>>({});

  constructor() {
    void this.chat.load();
    effect(() => {
      const n = this.data.feed().length;
      if (n >= 0) void this.recomputeGates();
    });
    this.data.startAutoSync();
  }

  goSignUp(): void {
    void this.router.navigate(['/auth'], { queryParams: { mode: 'signup' } });
  }

  goSignIn(): void {
    void this.router.navigate(['/auth']);
  }

  async onPromptClick(): Promise<void> {
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/auth'], { queryParams: { next: '/new' } });
      return;
    }
    void this.router.navigate(['/new']);
  }

  async goSighting(): Promise<void> {
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/auth'], { queryParams: { next: '/create/sighting' } });
      return;
    }
    void this.router.navigate(['/create/sighting']);
  }

  async goReportMissing(): Promise<void> {
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/auth'], { queryParams: { next: '/create/missing' } });
      return;
    }
    void this.router.navigate(['/create/missing']);
  }

  private async recomputeGates(): Promise<void> {
    const gates: Record<string, ChatState> = {};
    for (const p of this.data.feed()) {
      if (!p.chatEnabled) { gates[p.id] = 'off'; continue; }
      const g = await this.chat.gate(p, p.khumbu?.claimedByUserId === this.auth.viewerId);
      gates[p.id] = g.allowed ? 'open' : g.step === 'vote' ? 'locked-vote' : g.step === 'follow' ? 'locked-follow' : 'off';
    }
    this.chatGates.set(gates);
  }

  chatStateOf(p: Post): ChatState {
    if (p.authorId === this.auth.viewerId) return 'off';
    return this.chatGates()[p.id] ?? 'locked-vote';
  }

  async onRefresh(e: any): Promise<void> {
    await this.data.refresh();
    await this.chat.load();
    await this.recomputeGates();
    e.target.complete();
  }

  onInfinite(e: any): void {
    setTimeout(() => e.target.complete(), 450);
  }

  private async needAuth(): Promise<boolean> {
    if (this.auth.signedIn()) return true;
    const t = await this.toast.create({
      message: 'Sign in to do that',
      duration: 2600,
      position: 'bottom',
      buttons: [{ text: 'Sign in', role: 'cancel', handler: () => void this.router.navigate(['/auth']) }]
    });
    await t.present();
    return false;
  }

  async onVote(p: Post, v: 'up' | 'down'): Promise<void> {
    if (!(await this.needAuth())) return;
    try {
      await this.data.vote(p.id, v);
      await this.platform.haptic('light');
      await this.recomputeGates();
    } catch (e: any) {
      await this.show(e?.message ?? 'Could not record your vote');
    }
  }

  async onComment(p: Post): Promise<void> {
    if (!(await this.needAuth())) return;
    await this.router.navigate(['/post', p.id], { fragment: 'comments' });
  }

  async onShare(p: Post): Promise<void> {
    const text = `${p.title}\n\n${p.body.slice(0, 220)}\n\nShared from LulaFind`;
    const mode = await this.platform.share(p.title, text, this.platform.link(`/post/${p.id}`));
    await this.data.recordShare(p.id);
    await this.show(mode === 'native' ? 'Shared' : 'Copied to clipboard');
  }

  async onSave(p: Post): Promise<void> {
    const saved = await this.data.toggleSaved(p.id);
    await this.show(saved ? 'Saved to watchlist' : 'Removed from watchlist');
  }

  async onChat(p: Post): Promise<void> {
    if (!(await this.needAuth())) return;
    const thread = await this.chat.ensureThread(p, p.authorId, 'vote');
    if (thread) await this.router.navigate(['/chat', thread.id]);
  }

  async onMore(p: Post): Promise<void> {
    const mine = this.data.canEdit(p);
    const sheet = await this.sheetCtl.create({
      header: p.title.slice(0, 40),
      buttons: [
        ...(mine
          ? [
            { text: 'Edit post', icon: 'pencil' as const, handler: () => void this.router.navigate(['/post', p.id, 'edit']) },
            { text: 'Mark as found', icon: 'checkmark-circle' as const, handler: () => void this.router.navigate(['/post', p.id], { fragment: 'found' }) },
            { text: 'Delete post', role: 'destructive' as const, icon: 'trash' as const, handler: async () => { await this.data.deletePost(p.id); } }
          ]
          : [
            { text: 'Report', role: 'destructive' as const, icon: 'flag' as const, handler: () => this.report(p) }
          ]),
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  async report(p: Post): Promise<void> {
    if (!this.auth.signedIn()) {
      await this.show('Sign in to report a post');
      await this.router.navigate(['/auth'], { queryParams: { next: '/home' } });
      return;
    }
    const reasons = this.mod.reasons;
    const pick = await this.alertCtl.create({
      header: 'Report this post',
      inputs: reasons.map((r) => ({ name: 'reason', type: 'radio' as const, label: r.label, value: r.id })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send report',
          handler: async (v: any) => {
            try {
              await this.mod.report({ target: 'post', targetId: p.id, summary: p.title, reason: v?.reason ?? 'other' });
              await this.show('Report sent.');
            } catch (e: any) {
              await this.show(e?.message ?? 'Could not send report');
            }
          }
        }
      ]
    });
    await pick.present();
  }

  async onAddStory(): Promise<void> {
    if (!(await this.needAuth())) return;
    await this.router.navigate(['/create-story']);
  }

  private async show(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
