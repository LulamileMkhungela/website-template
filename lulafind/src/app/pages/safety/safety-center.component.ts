import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ToastController } from '@ionic/angular/toast-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { LocationService } from '../../core/services/location.service';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { provinceName } from '../../core/models/types';
import { fullDate } from '../../core/utils/format';

@Component({
  selector: 'lf-safety-center',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonItem, IonLabel, IonToggle,
    RouterLink, IconComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/me" text=""></ion-back-button></ion-buttons>
        <ion-title>Safety & consent centre</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      <div class="lf-banner">
        <lf-icon name="shield" [size]="20" />
        <div>
          LulaFind never reads anyone's location without that person's own consent, and never sends a case
          to the police or an NGO. <a routerLink="/help">Get help</a> has the real numbers.
        </div>
      </div>

      <!-- my location -->
      <section class="card">
        <div class="lf-row" style="gap:8px">
          <lf-icon name="target" [size]="20" />
          <h2 class="lf-h2" style="margin:0">My location</h2>
        </div>
        <p class="lf-small lf-muted">Permission: <strong>{{ location.permission() }}</strong>
          @if (location.current()) { · last read {{ fullDate(location.current()!.at) }} }</p>

        <div class="stat">
          @if (location.current()) {
            <div><span>Latitude</span><strong>{{ location.current()!.lat.toFixed(5) }}</strong></div>
            <div><span>Longitude</span><strong>{{ location.current()!.lng.toFixed(5) }}</strong></div>
            <div><span>Province</span><strong>{{ provinceName(location.province()) }}</strong></div>
            <div><span>Town</span><strong>{{ location.town() || 'unknown' }}</strong></div>
          } @else {
            <p class="lf-small lf-muted">No location has been read yet.</p>
          }
        </div>

        <div class="btns">
          <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="refresh()">
            <lf-icon name="refresh" [size]="15" /> Read my location
          </button>
          <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="revoke()">
            <lf-icon name="trash" [size]="15" /> Forget my location
          </button>
        </div>
      </section>

      <!-- beacon -->
      <section class="card">
        <div class="lf-row" style="gap:8px">
          <lf-icon name="heart" [size]="20" />
          <h2 class="lf-h2" style="margin:0">Safety beacon</h2>
        </div>
        <p class="lf-small lf-muted">Send "I am safe" check-ins with your location to people you choose. Off by default.</p>
        <ion-item>
          <ion-label><strong>Beacon enabled</strong><br />
            @if (location.lastBeacon()) {
              <span class="lf-muted lf-small">Last check-in {{ fullDate(location.lastBeacon()!.at) }}</span>
            }
          </ion-label>
          <ion-toggle [checked]="location.beaconEnabled()" (ionChange)="toggleBeacon($any($event.detail).checked)"></ion-toggle>
        </ion-item>
        <button class="lf-btn lf-btn--primary lf-btn--block" (click)="checkIn()" [disabled]="!auth.signedIn()">
          <lf-icon name="send" [size]="16" /> Send an "I am safe" check-in now
        </button>
      </section>

      <!-- findability -->
      <section class="card">
        <div class="lf-row" style="gap:8px">
          <lf-icon name="eye" [size]="20" />
          <h2 class="lf-h2" style="margin:0">Being found</h2>
        </div>
        <p class="lf-small lf-muted">
          If your name matches a KhumbulEkhaya post, LulaFind can ask <em>you</em> whether it is you.
          It never tells the family where you are, and it never exposes your account automatically.
        </p>
        <ion-item>
          <ion-label><strong>Allow name matching</strong></ion-label>
          <ion-toggle [checked]="findable()" (ionChange)="setFindable($any($event.detail).checked)"></ion-toggle>
        </ion-item>
      </section>

      <!-- consent log -->
      <section class="card">
        <div class="lf-row" style="gap:8px">
          <lf-icon name="lock" [size]="20" />
          <h2 class="lf-h2" style="margin:0">Consent log on my cases</h2>
        </div>
        @if (!myConsents().length) {
          <p class="lf-small lf-muted">You have not granted any escalation or location consent yet.</p>
        }
        @for (c of myConsents(); track c.key) {
          <div class="consent" [class.off]="!c.granted">
            <lf-icon [name]="c.granted ? 'check' : 'x'" [size]="16" />
            <div class="lf-grow">
              <strong>{{ c.label }}</strong>
              <span class="lf-small lf-muted">{{ c.post }} · {{ fullDate(c.at) }}</span>
              @if (c.expiresAt) { <span class="lf-small lf-muted">expires {{ fullDate(c.expiresAt) }}</span> }
            </div>
          </div>
        }
      </section>

      <div class="lf-pad">
        <button class="lf-btn lf-btn--ghost lf-btn--block" routerLink="/settings">
          <lf-icon name="settings" [size]="16" /> Privacy & data settings
        </button>
      </div>
    </ion-content>
  `,
  styles: [`
    .card { margin: 12px var(--lf-gap); padding: 15px; border-radius: var(--lf-radius);
      border: 1px solid var(--lf-line); background: var(--lf-card); display: flex; flex-direction: column; gap: 10px; }
    .stat { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .stat div { padding: 10px 12px; border-radius: 11px; background: var(--lf-card-2); display: flex; flex-direction: column; gap: 2px; }
    .stat span { font-size: 11px; color: var(--lf-muted); text-transform: uppercase; letter-spacing: .5px; }
    .stat strong { font-size: 14px; }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .consent { display: flex; gap: 10px; align-items: center; padding: 11px 12px; border-radius: 11px;
      background: var(--lf-card-2); color: var(--lf-ubuntu); }
    .consent.off { color: var(--lf-signal); }
    .consent div { display: flex; flex-direction: column; gap: 2px; }
  `]
})
export class SafetyCenterComponent {
  protected location = inject(LocationService);
  protected auth = inject(AuthService);
  protected data = inject(DataService);
  private toast = inject(ToastController);

  protected readonly provinceName = provinceName;
  protected readonly fullDate = fullDate;

  readonly findable = computed(() => this.auth.user()?.findableProfile ?? false);

  readonly myConsents = computed(() => {
    const me = this.auth.viewerId;
    const out: { key: string; label: string; post: string; granted: boolean; at: number; expiresAt: number | null }[] = [];
    for (const p of this.data.feed().filter((x) => x.authorId === me)) {
      for (const c of p.consent) {
        out.push({ key: p.id + c.kind, label: c.label, post: p.title.slice(0, 34), granted: c.granted, at: c.at, expiresAt: c.expiresAt });
      }
    }
    return out;
  });

  async refresh(): Promise<void> {
    if (this.location.permission() !== 'granted') {
      const ok = await this.location.askWithExplanation();
      if (!ok) {
        await this.say('Location permission was declined. You can enable it in your phone settings.');
        return;
      }
    }
    const p = await this.location.readDevicePosition();
    await this.say(p ? 'Location read and stored on this device only.' : 'Could not read your location.');
  }

  async revoke(): Promise<void> {
    await this.location.revokeAll();
    await this.say('Location forgotten.');
  }

  async toggleBeacon(on: boolean): Promise<void> {
    if (on) await this.location.enableBeacon([]);
    else await this.location.disableBeacon();
  }

  async checkIn(): Promise<void> {
    const rec = await this.location.checkIn([]);
    await this.say(rec ? 'Check-in recorded. Your people will see "safe".' : 'Location permission needed for a check-in.');
  }

  async setFindable(v: boolean): Promise<void> {
    if (!this.auth.signedIn()) return;
    await this.auth.setFindable(v);
    await this.say(v ? 'Name matching enabled.' : 'Name matching disabled.');
  }

  private async say(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 2600, position: 'bottom' });
    await t.present();
  }
}
