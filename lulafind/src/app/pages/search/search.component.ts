import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { PostCardComponent } from '../../shared/components/post-card.component';
import { DataService } from '../../core/services/data.service';
import { UserProfile, Post, PROVINCES } from '../../core/models/types';

@Component({
  selector: 'lf-search',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonSearchbar,
    RouterLink, IconComponent, AvatarComponent, EmptyComponent, PostCardComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-searchbar placeholder="Name, surname, case number, town…" [debounce]="220" showCancelButton="never"
                       (ionInput)="onQuery($any($event.target).value)"></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <div class="lf-scroller quick">
          @for (c of quick; track c) { <button class="chip" (click)="apply(c)">{{ c }}</button> }
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      @if (!query()) {
        <div class="lf-pad">
          <h3 class="lf-h2" style="margin:16px 0 8px">Start with a surname</h3>
          <div class="lf-scroller">
            @for (sp of data.spotlights(); track sp.id) {
              <a class="sp" [routerLink]="'/spotlight/' + sp.id">
                <lf-icon name="users" [size]="18" />
                <div><strong>{{ sp.surname }}</strong><span>{{ sp.postIds.length }} posts</span></div>
              </a>
            }
          </div>

          <h3 class="lf-h2" style="margin:18px 0 8px">Jump to a province</h3>
          <div class="provs">
            @for (p of provinces; track p.code) {
              <button class="prov" (click)="byProvince(p.code)">{{ p.name }}</button>
            }
          </div>

          <h3 class="lf-h2" style="margin:18px 0 8px">People</h3>
          <div class="people">
            @for (u of people(); track u.id) {
              <a class="person" [routerLink]="'/user/' + u.id">
                <lf-avatar [src]="data.avatarFor(u)" [name]="u.displayName" [size]="40" />
                <div class="lf-grow">
                  <strong>{{ u.displayName }}</strong>
                  <span class="lf-meta">&#64;{{ u.handle }}</span>
                </div>
              </a>
            }
          </div>
        </div>
      } @else if (!results().length && !users().length) {
        <lf-empty icon="search" title="Nothing matches that"
                  message="Try a surname, a case number, or the town where they went missing." />
      } @else {
        @if (users().length) {
          <div class="lf-pad">
            <h3 class="lf-h2" style="margin:16px 0 8px">People</h3>
            @for (u of users(); track u.id) {
              <a class="person" [routerLink]="'/user/' + u.id">
                <lf-avatar [src]="data.avatarFor(u)" [name]="u.displayName" [size]="44" />
                <div class="lf-grow">
                  <strong>{{ u.displayName }}</strong>
                  <span class="lf-meta">&#64;{{ u.handle }}@if (u.privacy && u.privacy.showLocation === true && u.town) { · {{ u.town }} }</span>
                </div>
              </a>
            }
          </div>
        }
        @for (p of results(); track p.id) {
          <lf-post-card [post]="p" [author]="data.authorOf(p.authorId) ?? null" chatState="off"
                        (vote)="vote(p, $event)" (comment)="open(p)" (share)="open(p)" (more)="open(p)" />
        }
      }
    </ion-content>
  `,
  styles: [`
    .quick { padding: 6px var(--lf-gap); gap: 6px; }
    .chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--lf-line); background: transparent;
      color: var(--lf-muted); font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .sp { display: flex; align-items: center; gap: 10px; min-width: 168px; padding: 12px 14px; border-radius: 12px;
      border: 1px solid var(--lf-line); background: var(--lf-card); color: inherit; text-decoration: none; }
    .sp div { display: flex; flex-direction: column; }
    .sp span { font-size: 11.5px; color: var(--lf-muted); }
    .provs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .prov { padding: 12px 8px; border-radius: 11px; border: 1px solid var(--lf-line); background: var(--lf-card);
      color: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
    .people { display: flex; flex-direction: column; gap: 8px; }
    .person { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 12px;
      border: 1px solid var(--lf-line); background: var(--lf-card); color: inherit; text-decoration: none; }
    .person div { display: flex; flex-direction: column; gap: 2px; }
  `]
})
export class SearchComponent {
  protected data = inject(DataService);
  private router = inject(Router);

  protected readonly provinces = PROVINCES;
  query = signal('');
  users = signal<UserProfile[]>([]);

  quick = ['missing in Gauteng', 'SAPS case', 'KhumbulEkhaya', 'found', 'Orlando', 'Ndlela'];

  readonly results = computed(() => {
    const q = this.query();
    if (!q) return [];
    return this.data.feed().filter((p) => {
      const hay = [p.title, p.body, p.town, p.caseNumber ?? '', p.subject?.name ?? '', p.subject?.surname ?? ''].join(' ').toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  });

  readonly people = computed(() => this.users().slice(0, 8));

  async onQuery(q: string): Promise<void> {
    this.query.set(q.trim());
    this.users.set(q.trim() ? await this.data.searchUsers(q) : []);
  }

  apply(q: string): void {
    void this.onQuery(q);
  }

  byProvince(code: string): void {
    this.data.setFilter({ province: code as any, query: '' });
    void this.router.navigate(['/home']);
  }

  vote(p: Post, v: 'up' | 'down'): void {
    void this.data.vote(p.id, v);
  }

  open(p: Post): void {
    void this.router.navigate(['/post', p.id]);
  }
}
