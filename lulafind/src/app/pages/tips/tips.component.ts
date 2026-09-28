import { Component, computed, inject, signal } from '@angular/core';
import { Router } from "@angular/router";
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IconComponent } from '../../shared/components/icon.component';
import { DataService } from '../../core/services/data.service';
import { PlatformService } from '../../core/services/platform.service';
import { Tip } from '../../core/models/types';

const CATS = [
  { key: 'all', label: 'All' },
  { key: 'reporting', label: 'Reporting' },
  { key: 'safety', label: 'Safety' },
  { key: 'digital', label: 'Online' },
  { key: 'legal', label: 'Consent & law' },
  { key: 'support', label: 'Support' }
] as const;

@Component({
  selector: 'lf-tips',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IconComponent],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-title>Safety & tips</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <div class="lf-scroller cats">
          @for (c of cats; track c.key) {
            <button class="chip" [class.on]="cat() === c.key" (click)="cat.set(c.key)">{{ c.label }}</button>
          }
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      <button class="lf-banner lf-banner--danger help-jump" type="button" (click)="router.navigate(['/help'])">
        <lf-icon name="phone" [size]="20" />
        <div>
          <strong>In an emergency call 10111.</strong><br />
          <span class="lf-small">Ambulance 10177 · GBV Command Centre 0800 428 428 · Childline 116. Tap for every checked number.</span>
        </div>
      </button>

      <div class="list">
        @for (t of list(); track t.id) {
          <article class="tip" [class.urgent]="t.urgent">
            <div class="hd">
              <lf-icon [name]="iconFor(t.category)" [size]="18" />
              <span class="cat">{{ t.category }}</span>
              @if (t.urgent) { <span class="lf-chip lf-chip--danger lf-tiny">important</span> }
            </div>
            <h3>{{ t.title }}</h3>
            <p>{{ t.body }}</p>
            @if (t.cta) {
              <button class="lf-btn lf-btn--sm" (click)="go(t)"><lf-icon name="chevronRight" [size]="14" /> {{ t.cta!.label }}</button>
            }
            <button class="share" (click)="share(t)"><lf-icon name="share" [size]="13" /> Share this tip</button>
          </article>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .help-jump { width: calc(100% - 2 * var(--lf-gap)); margin: 12px var(--lf-gap) 0; text-align: left;
      cursor: pointer; color: inherit; border: 0; font: inherit; }
    .cats { padding: 8px var(--lf-gap); gap: 6px; }
    .chip { padding: 6px 13px; border-radius: 999px; border: 1px solid var(--lf-line); background: transparent;
      color: var(--lf-muted); font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .chip.on { background: var(--lf-beacon); color: #1a1200; border-color: var(--lf-beacon); }
    .list { padding: 4px var(--lf-gap) 30px; display: flex; flex-direction: column; gap: 10px; }
    .tip { padding: 15px; border-radius: var(--lf-radius); border: 1px solid var(--lf-line); background: var(--lf-card); }
    .tip.urgent { border-color: color-mix(in srgb, var(--lf-signal) 50%, var(--lf-line)); }
    .hd { display: flex; align-items: center; gap: 8px; color: var(--lf-beacon); margin-bottom: 6px; }
    .cat { font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: var(--lf-muted); }
    .tip h3 { margin: 0 0 6px; font-size: 16px; line-height: 1.3; }
    .tip p { margin: 0 0 10px; font-size: 13.5px; line-height: 1.55; color: var(--ion-text-color); opacity: .92; }
    .share { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; background: none; border: 0;
      color: var(--lf-muted); font-size: 12px; font-weight: 700; cursor: pointer; padding: 0; }
  `]
})
export class TipsComponent {
  protected data = inject(DataService);
  private platform = inject(PlatformService);
  protected router = inject(Router);

  protected readonly cats = CATS;
  cat = signal<(typeof CATS)[number]['key']>('all');

  readonly list = computed(() => {
    const c = this.cat();
    const all = this.data.tips();
    return c === 'all' ? all : all.filter((t) => t.category === c);
  });

  iconFor(c: Tip['category']): string {
    return { reporting: 'megaphone', safety: 'shield', digital: 'lock', legal: 'award', support: 'heart' }[c];
  }

  go(t: Tip): void {
    if (t.cta) void this.router.navigateByUrl(t.cta.route);
  }

  async share(t: Tip): Promise<void> {
    await this.platform.share(t.title, `${t.title}\n\n${t.body}\n\nFrom LulaFind`);
  }
}
