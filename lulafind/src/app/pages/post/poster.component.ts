import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IconComponent } from '../../shared/components/icon.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { Post } from '../../core/models/types';
import { publicPoster } from '../../core/utils/poster';
import { SAPS_MISSING_LIST } from '../../core/data/sa-help';

@Component({
  selector: 'lf-poster',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IconComponent],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button [defaultHref]="'/post/' + id" text=""></ion-back-button></ion-buttons>
        <ion-title>Poster</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="lf-page">
      @if (p(); as post) {
        <article class="flyer">
          <p class="kicker">{{ post.type === 'vehicle' ? 'STOLEN' : post.type === 'pet' ? 'LOST PET' : 'MISSING' }}</p>
          <h1>{{ post.title }}</h1>
          @if (photo()) { <img [src]="photo()" alt="" /> }
          @for (line of flyer().lines; track line) { <p>{{ line }}</p> }
          <p class="close">{{ post.type === 'vehicle'
            ? 'LulaFind cannot track this vehicle. Report it at a police station. Do not buy it from a stranger.'
            : 'If they are in danger, call 10111. This is not a police poster.' }}</p>
        </article>
        @if (isMine() && flyer().withheld) {
          <p class="note">Not on this poster: {{ flyer().withheld }}. Ask a caller to name that mark before you trust them.</p>
        }
        <div class="lf-pad actions">
          <button class="lf-btn lf-btn--primary lf-btn--block" type="button" (click)="share()">
            <lf-icon name="share" [size]="16" /> Share this poster
          </button>
          <a class="lf-btn lf-btn--block" [href]="sapsList" target="_blank" rel="noopener">Official SAPS missing list</a>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .flyer { margin: 16px var(--lf-gap); padding: 18px; background: #fff4b8; color: #1a1200;
      border: 3px solid #1a1200; border-radius: 8px; }
    .kicker { margin: 0 0 6px; font-weight: 900; letter-spacing: 1px; color: #9a1b1b; }
    h1 { margin: 0 0 10px; font-size: 26px; line-height: 1.15; }
    img { width: 100%; max-height: 280px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; }
    p { margin: 0 0 8px; font-size: 16px; font-weight: 700; line-height: 1.35; }
    .close { margin-top: 12px; font-size: 14px; }
    .note { margin: 0 var(--lf-gap) 8px; font-size: 13px; color: var(--lf-muted); }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    a.lf-btn { text-decoration: none; }
  `]
})
export class PosterComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private data = inject(DataService);
  private auth = inject(AuthService);
  private platform = inject(PlatformService);

  protected readonly sapsList = SAPS_MISSING_LIST;
  id = '';
  p = signal<Post | null>(null);

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    const cached = this.data.post(this.id);
    if (cached) this.p.set(cached);
    void this.data.loadPost(this.id).then((fresh) => { if (fresh) this.p.set(fresh); });
  }

  flyer() {
    return publicPoster(this.p()!);
  }

  photo(): string | null {
    return this.p()?.media.find((m) => m.kind === 'image')?.src ?? null;
  }

  isMine(): boolean {
    return this.p()?.authorId === this.auth.viewerId;
  }

  async share(): Promise<void> {
    const post = this.p();
    if (!post) return;
    await this.platform.share(post.title, publicPoster(post).shareText, this.platform.link(`/post/${post.id}/poster`));
  }
}
