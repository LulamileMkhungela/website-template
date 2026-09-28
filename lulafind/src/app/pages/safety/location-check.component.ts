import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { ToastController } from '@ionic/angular/toast-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { DataService } from '../../core/services/data.service';
import { LocationService } from '../../core/services/location.service';
import { AuthService } from '../../core/services/auth.service';
import { LULA_API } from '../../core/data/api';
import { Post } from '../../core/models/types';
import { fullDate } from '../../core/utils/format';
import { uid } from '../../core/utils/format';

@Component({
  selector: 'lf-location-check',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonSkeletonText, IonTextarea, IconComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button [defaultHref]="'/post/' + id" text=""></ion-back-button></ion-buttons>
        <ion-title>Location & consent</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      @if (!p()) {
        <div class="lf-card"><ion-skeleton-text style="height:160px"></ion-skeleton-text></div>
      } @else {
        <div class="lf-banner lf-banner--warn">
          <lf-icon name="lock" [size]="20" />
          <div>
            LulaFind will <strong>never</strong> read a person's location without that person's own consent.
            This screen sends a request - it does not return a location.
          </div>
        </div>

        <section class="card">
          <h2 class="lf-h2" style="margin:0 0 6px">1 · Is the subject registered on LulaFind?</h2>
          <ion-textarea rows="1" placeholder="Search by name or surname" [value]="lookup"
                        (ionInput)="lookup = $any($event.target).value"></ion-textarea>
          <button class="lf-btn lf-btn--ghost lf-btn--block" (click)="runLookup()">
            <lf-icon name="search" [size]="16" /> Check the member directory
          </button>
          @if (lookupDone()) {
            <div class="result" [class.yes]="foundMatch()">
              <lf-icon [name]="foundMatch() ? 'check' : 'info'" [size]="18" />
              <div>
                @if (foundMatch()) {
                  <strong>A member matches "{{ lookup }}"</strong>
                  <span class="lf-small">They have "allow name matching" turned on. You can send a consent request.</span>
                } @else {
                  <strong>No match found</strong>
                  <span class="lf-small">Nobody with that name has allowed matching. This is the end of the road for a location check - use posters and the community instead.</span>
                }
              </div>
            </div>
          }
        </section>

        @if (foundMatch()) {
          <section class="card">
            <h2 class="lf-h2" style="margin:0 0 6px">2 · Send a consent request</h2>
            <p class="lf-small lf-muted">
              The subject gets a notification: "{{ p()!.subject?.name ?? 'Someone' }} may be the person in this case.
              Do you want to share your location with this search?" They can say yes, no, or ignore it.
            </p>
            <ion-textarea rows="2" placeholder="A short message to them (optional)" [value]="note"
                          (ionInput)="note = $any($event.target).value"></ion-textarea>
            <button class="lf-btn lf-btn--primary lf-btn--block" [disabled]="requested()" (click)="request()">
              <lf-icon name="send" [size]="16" /> {{ requested() ? 'Request sent' : 'Send consent request' }}
            </button>
          </section>
        }

        <section class="card">
          <h2 class="lf-h2" style="margin:0 0 6px">3 · Consent status</h2>
          <div class="state" [attr.data-s]="p()!.locationCheck.consentFromSubject">
            <lf-icon [name]="stateIcon()" [size]="18" />
            <div class="lf-grow">
              <strong>{{ stateLabel() }}</strong>
              @if (p()!.locationCheck.consentAt) {
                <span class="lf-small lf-muted">Updated {{ fullDate(p()!.locationCheck.consentAt) }}</span>
              }
            </div>
          </div>
          @if (p()!.locationCheck.note) { <p class="lf-small lf-muted">{{ p()!.locationCheck.note }}</p> }
          @if (p()!.locationCheck.points.length) {
            <div class="points">
              @for (pt of p()!.locationCheck.points; track $index) {
                <div><span>Lat / Lng</span><strong>{{ pt.lat.toFixed(5) }}, {{ pt.lng.toFixed(5) }}</strong></div>
                <div><span>Recorded</span><strong>{{ fullDate(pt.at) }}</strong></div>
              }
            </div>
          }
        </section>

        <section class="card">
          <h2 class="lf-h2" style="margin:0 0 6px">Simulate the subject's answer</h2>
          <p class="lf-small lf-muted">
            In production this screen is the subject's phone. In the demo you can answer on their behalf so the
            whole consent loop is testable end to end.
          </p>
          <div class="btns">
            <button class="lf-btn lf-btn--success lf-btn--sm" (click)="subjectDecides('granted')">
              <lf-icon name="check" [size]="15" /> Grant + share location
            </button>
            <button class="lf-btn lf-btn--danger lf-btn--sm" (click)="subjectDecides('declined')">
              <lf-icon name="x" [size]="15" /> Decline
            </button>
            <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="subjectDecides('none')">Reset</button>
          </div>
        </section>
      }
    </ion-content>
  `,
  styles: [`
    .card { margin: 12px var(--lf-gap); padding: 15px; border-radius: var(--lf-radius);
      border: 1px solid var(--lf-line); background: var(--lf-card); display: flex; flex-direction: column; gap: 10px; }
    .result { display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 12px; background: var(--lf-card-2); }
    .result.yes { background: color-mix(in srgb, var(--lf-ubuntu) 16%, transparent); }
    .result div { display: flex; flex-direction: column; gap: 2px; }
    .state { display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 12px; background: var(--lf-card-2); }
    .state[data-s="granted"] { color: var(--lf-ubuntu); }
    .state[data-s="declined"] { color: var(--lf-signal); }
    .state[data-s="requested"] { color: var(--lf-marigold); }
    .state div { display: flex; flex-direction: column; gap: 2px; }
    .points { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .points div { padding: 10px 12px; border-radius: 11px; background: var(--lf-card-2); display: flex; flex-direction: column; gap: 2px; }
    .points span { font-size: 11px; color: var(--lf-muted); text-transform: uppercase; letter-spacing: .5px; }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; }
  `]
})
export class LocationCheckComponent implements OnInit {
  protected data = inject(DataService);
  private location = inject(LocationService);
  private auth = inject(AuthService);
  private api = inject(LULA_API);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);
  private alert = inject(AlertController);

  protected readonly fullDate = fullDate;

  id = '';
  p = signal<Post | null>(null);
  lookup = '';
  note = '';
  lookupDone = signal(false);
  foundMatch = signal(false);

  readonly requested = computed(() => this.p()?.locationCheck.consentFromSubject === 'requested');

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('postId') ?? '';
    const cached = this.data.post(this.id);
    if (cached) {
      this.p.set(cached);
      this.lookup = cached.subject?.name ?? '';
    }
    void this.data.loadPost(this.id).then((fresh) => {
      if (fresh) {
        this.p.set(fresh);
        this.lookup = fresh.subject?.name ?? '';
      }
    });
  }

  async runLookup(): Promise<void> {
    const needle = this.lookup.trim().toLowerCase();
    const matches = needle ? await this.data.searchUsers(needle) : [];
    this.foundMatch.set(matches.some((u) => u.findableProfile));
    this.lookupDone.set(true);
  }

  async request(): Promise<void> {
    const p = this.p();
    if (!p) return;
    const next: Post = {
      ...p,
      locationCheck: {
        ...p.locationCheck,
        subjectRegisteredInApp: true,
        requestedBy: this.auth.viewerId,
        requestedAt: Date.now(),
        consentFromSubject: 'requested',
        note: this.note.trim() || 'A location consent request has been sent to the member who matches this case.'
      },
      events: [...p.events, { at: Date.now(), kind: 'claimed', byUserId: this.auth.viewerId, note: 'Location consent requested from subject' }]
    };
    await this.api.savePost(next);
    this.data.touch(next);
    this.p.set(next);
    await this.say('Consent request sent. They decide - not you.');
  }

  async subjectDecides(decision: 'granted' | 'declined' | 'none'): Promise<void> {
    const p = this.p();
    if (!p) return;
    let points = p.locationCheck.points;
    if (decision === 'granted') {
      const pt = await this.location.readDevicePosition();
      points = pt ? [pt] : [];
    } else if (decision === 'none') {
      points = [];
    }
    const next: Post = {
      ...p,
      locationCheck: {
        ...p.locationCheck,
        consentFromSubject: decision,
        consentAt: decision === 'none' ? null : Date.now(),
        points,
        lastKnownAt: points[0]?.at ?? null,
        deviceReachable: decision === 'granted',
        note: decision === 'granted'
          ? 'The subject granted consent and shared their location once. Consent can be withdrawn at any time.'
          : decision === 'declined'
            ? 'The subject declined. LulaFind holds no location data for them and will not ask again unless the poster requests and they agree.'
            : ''
      },
      events: [
        ...p.events,
        { at: Date.now(), kind: decision === 'granted' ? 'found' : 'claimed', byUserId: null, note: `Location consent ${decision}` }
      ]
    };
    await this.api.savePost(next);
    this.data.touch(next);
    this.p.set(next);
    await this.say(decision === 'granted' ? 'Location shared with this search.' : decision === 'declined' ? 'Consent declined.' : 'Consent state reset.');
  }

  stateIcon(): string {
    switch (this.p()?.locationCheck.consentFromSubject) {
      case 'granted': return 'check';
      case 'declined': return 'x';
      case 'requested': return 'clock';
      default: return 'info';
    }
  }

  stateLabel(): string {
    switch (this.p()?.locationCheck.consentFromSubject) {
      case 'granted': return 'Consent granted - location shared';
      case 'declined': return 'Consent declined';
      case 'requested': return 'Request sent - waiting for the subject';
      default: return 'No request yet';
    }
  }

  private async say(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 2600, position: 'bottom' });
    await t.present();
  }
}
