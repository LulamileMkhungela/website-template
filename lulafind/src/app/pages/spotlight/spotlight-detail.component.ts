import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { ToastController } from '@ionic/angular/toast-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { ChatState, PostCardComponent } from '../../shared/components/post-card.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { Post, Spotlight, provinceName } from '../../core/models/types';
import { compact } from '../../core/utils/format';
import { cover } from '../../core/data/seed';

@Component({
  selector: 'lf-spotlight-detail',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonSearchbar, IonSkeletonText,
    IconComponent, EmptyComponent, PostCardComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/spotlight" text=""></ion-back-button></ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      @if (!sp()) {
        <div class="lf-card"><ion-skeleton-text style="height:180px"></ion-skeleton-text></div>
      } @else {
        <div class="hero">
          <img class="banner" [src]="coverOf()" [alt]="sp()!.surname" />
          <div class="ident">
            <h1 class="lf-h1">{{ sp()!.surname }} <span class="lf-chip">Spotlight</span></h1>
            @if (sp()!.verified) { <span class="lf-chip lf-chip--success"><lf-icon name="check" [size]="12" /> verified family page</span> }
            <p class="tag">{{ sp()!.tagline }}</p>
            <div class="stats">
              <div><strong>{{ compact(sp()!.followers) }}</strong><span>members</span></div>
              <div><strong>{{ posts().length }}</strong><span>posts</span></div>
              <div><strong>{{ sp()!.adminIds.length }}</strong><span>admins</span></div>
            </div>
            @if (sp()!.about) { <p class="about">{{ sp()!.about }}</p> }
            <div class="acts">
              @if (!member()) {
                <button class="lf-btn lf-btn--primary lf-btn--sm" (click)="join()">
                  <lf-icon name="plus" [size]="15" /> Join this community
                </button>
                <span class="lf-meta">No approval needed - you can post as soon as you join.</span>
              } @else {
                <span class="lf-chip lf-chip--success"><lf-icon name="check" [size]="12" /> you are a member</span>
                <button class="lf-btn lf-btn--primary lf-btn--sm" (click)="postHere()">
                  <lf-icon name="plus" [size]="15" /> Post to {{ sp()!.surname }}
                </button>
                @if (!owner()) {
                  <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="leave()">Leave</button>
                }
              }
              @if (owner()) {
                <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="edit()">Edit</button>
                <button class="lf-btn lf-btn--danger lf-btn--sm" (click)="remove()">Delete</button>
              }
              <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="share()">
                <lf-icon name="share" [size]="15" /> Share
              </button>
            </div>
          </div>
        </div>

        <ion-searchbar placeholder="Search inside the {{ sp()!.surname }} spotlight" [debounce]="200"
                       (ionInput)="q.set($any($event.detail).value ?? '')"></ion-searchbar>

        @if (!posts().length) {
          <lf-empty icon="users" title="Nothing posted to this spotlight yet"
                    message="Be the first to bring a case, story or update to the community."
                    actionLabel="Post here" (action)="postHere()" />
        }
        @for (p of posts(); track p.id) {
          <lf-post-card [post]="p" [author]="data.authorOf(p.authorId) ?? null" chatState="off"
                        (vote)="vote(p, $event)" (comment)="open(p)" (share)="sharePost(p)" (more)="open(p)" />
        }
      }
    </ion-content>
  `,
  styles: [`
    .banner { width: 100%; height: 150px; object-fit: cover; display: block; }
    .ident { padding: 14px var(--lf-gap) 10px; display: flex; flex-direction: column; gap: 8px; margin-top: -18px; }
    .ident h1 { display: flex; align-items: center; gap: 8px; margin: 0; flex-wrap: wrap; }
    .tag { margin: 0; font-weight: 600; }
    .about { margin: 0; font-size: 13.5px; color: var(--lf-muted); line-height: 1.5; }
    .stats { display: flex; gap: 18px; }
    .stats div { display: flex; flex-direction: column; }
    .stats strong { font-size: 17px; }
    .stats span { font-size: 11.5px; color: var(--lf-muted); }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  `]
})
export class SpotlightDetailComponent implements OnInit {
  protected data = inject(DataService);
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);
  private alert = inject(AlertController);

  protected readonly compact = compact;
  protected readonly provinceName = provinceName;

  sp = signal<Spotlight | null>(null);
  q = signal('');

  readonly member = computed(() => {
    const me = this.auth.viewerId;
    return !!me && !!this.sp() && this.sp()!.memberIds.includes(me);
  });
  readonly owner = computed(() => {
    const me = this.auth.user();
    const sp = this.sp();
    return !!me && !!sp && (sp.ownerId === me.id || me.isAdmin === true);
  });

  readonly posts = computed(() => {
    const id = this.sp()?.id;
    const needle = this.q().trim().toLowerCase();
    let list = this.data.feed().filter((p) => p.spotlightId === id);
    if (needle) {
      list = list.filter(
        (p) => p.title.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle) ||
          (p.subject?.name.toLowerCase().includes(needle) ?? false)
      );
    }
    return list;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const all = this.data.spotlights();
    this.sp.set(all.find((s) => s.id === id) ?? null);
    if (!this.sp()) {
      await this.data.loadStatic();
      this.sp.set(this.data.spotlights().find((s) => s.id === id) ?? null);
    }
  }

  coverOf(): string {
    return cover(`${this.sp()?.surname ?? ''} family`, this.sp()?.coverHue || undefined);
  }

  /** Instant - no admin approval. You can post the moment you join. */
  async join(): Promise<void> {
    const sp = this.sp();
    if (!sp) return;
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/auth'], { queryParams: { next: '/spotlight/' + sp.id } });
      return;
    }
    try {
      const joined = await this.data.joinSpotlight(sp.id);
      await this.data.loadStatic();
      this.sp.set(this.data.spotlights().find((s) => s.id === sp.id) ?? null);
      const t = await this.toast.create({
        message: joined ? `You joined the ${sp.surname} community. You can post here now.` : `You are already a member of ${sp.surname}.`,
        duration: 2400,
        position: 'bottom'
      });
      await t.present();
    } catch (e: any) {
      const t = await this.toast.create({ message: e?.message ?? 'Could not join', duration: 2600, position: 'bottom' });
      await t.present();
    }
  }

  async edit(): Promise<void> {
    const sp = this.sp();
    if (!sp || !this.owner()) return;
    const a = await this.alert.create({
      header: 'Edit spotlight',
      message: 'The surname stays as it was when you created this community.',
      inputs: [
        { name: 'tagline', type: 'text', value: sp.tagline, placeholder: 'Short line' },
        { name: 'about', type: 'textarea', value: sp.about, placeholder: 'About this community' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Save', role: 'confirm' }
      ]
    });
    await a.present();
    const result = await a.onDidDismiss();
    if (result.role !== 'confirm') return;
    try {
      const next = await this.data.updateSpotlight(sp.id, {
        tagline: String(result.data?.values?.tagline ?? ''),
        about: String(result.data?.values?.about ?? '')
      });
      this.sp.set(next);
      const t = await this.toast.create({ message: 'Spotlight saved', duration: 1600, position: 'bottom' });
      await t.present();
    } catch (e: unknown) {
      const t = await this.toast.create({ message: e instanceof Error ? e.message : 'Could not save', duration: 2600, position: 'bottom' });
      await t.present();
    }
  }

  async remove(): Promise<void> {
    const sp = this.sp();
    if (!sp || !this.owner()) return;
    const a = await this.alert.create({
      header: 'Delete this spotlight?',
      message: 'This removes the community. Posts already published stay on the feed.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive' }
      ]
    });
    await a.present();
    const result = await a.onDidDismiss();
    if (result.role !== 'destructive') return;
    try {
      await this.data.deleteSpotlight(sp.id);
      await this.router.navigate(['/spotlight']);
    } catch (e: unknown) {
      const t = await this.toast.create({ message: e instanceof Error ? e.message : 'Could not delete', duration: 2600, position: 'bottom' });
      await t.present();
    }
  }

  async leave(): Promise<void> {
    const sp = this.sp();
    if (!sp) return;
    try {
      await this.data.leaveSpotlight(sp.id);
      await this.data.loadStatic();
      this.sp.set(this.data.spotlights().find((s) => s.id === sp.id) ?? null);
      const t = await this.toast.create({ message: `You left the ${sp.surname} community`, duration: 2000, position: 'bottom' });
      await t.present();
    } catch (e: any) {
      const t = await this.toast.create({ message: e?.message ?? 'Could not leave', duration: 2600, position: 'bottom' });
      await t.present();
    }
  }

  async postHere(): Promise<void> {
    const sp = this.sp();
    if (!sp) return;
    if (!this.auth.signedIn()) {
      await this.router.navigate(['/auth']);
      return;
    }
    this.data.setFilter({ spotlightId: sp.id });
    await this.router.navigate(['/create', 'missing']);
  }

  async share(): Promise<void> {
    const sp = this.sp();
    if (!sp) return;
    await this.platform.share(`${sp.surname} Spotlight`, `${sp.tagline} - join the ${sp.surname} community on LulaFind`, this.platform.link(`/spotlight/${sp.id}`));
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
}
