import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonInput } from '@ionic/angular/ion-input';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { ToastController } from '@ionic/angular/toast-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PROVINCES, ProvinceCode, Spotlight, provinceName } from '../../core/models/types';
import { cover } from '../../core/data/seed';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Spotlight: one community page per surname.
 *
 * Filter by any letter of the alphabet, or see them all. Joining is instant -
 * no admin approval - and once you have joined you can post to it.
 */
@Component({
  selector: 'lf-spotlight',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonModal, IonInput, IonTextarea, IonSelect,
    IonSelectOption, IonItem, IonLabel, IonSearchbar, RouterLink, IconComponent, EmptyComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-title>Spotlight communities</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <div class="filters">
          <ion-searchbar class="grow" placeholder="Search a surname" [debounce]="200"
                       (ionInput)="query.set($any($event.detail).value ?? '')" animated="true"></ion-searchbar>
          <ion-select class="letter" [value]="letter()" placeholder="A–Z"
                      (ionChange)="letter.set($any($event.detail).value)">
            <ion-select-option value="all">All letters</ion-select-option>
            @for (l of alphabet; track l) { <ion-select-option [value]="l">{{ l }}</ion-select-option> }
          </ion-select>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      <div class="lf-banner">
        <lf-icon name="users" [size]="18" />
        <div>
          A Spotlight is a page for a surname. Anyone can join - no approval needed - and once you are in you can
          post cases, stories and updates to that family.
        </div>
      </div>

      @if (mine().length) {
        <h3 class="section">Your communities</h3>
        <div class="grid">
          @for (s of mine(); track s.id) {
            <a class="tile" [routerLink]="'/spotlight/' + s.id" [style.--hue]="s.coverHue">
              <img [src]="coverOf(s.surname, s.coverHue)" [alt]="s.surname" loading="lazy" />
              <div class="meta">
                <strong>{{ s.surname }}</strong>
                <span>{{ s.postIds.length }} posts · {{ s.followers }} members</span>
              </div>
              @if (s.verified) { <span class="lf-chip lf-chip--success lf-tiny">verified</span> }
            </a>
          }
        </div>
      }

      <h3 class="section">
        {{ letter() === 'all' ? 'All spotlights' : 'Surnames starting with ' + letter() }}
        <span class="lf-muted lf-tiny">{{ list().length }}</span>
      </h3>
      @if (!list().length) {
        <lf-empty icon="users" title="No spotlight for that letter yet"
                  message="Create one and it becomes the home for every post with that surname."
                  actionLabel="Create a spotlight" (action)="openCreate()" />
      }
      <div class="grid">
        @for (s of list(); track s.id) {
          <a class="tile" [routerLink]="'/spotlight/' + s.id">
            <img [src]="coverOf(s.surname, s.coverHue)" [alt]="s.surname" loading="lazy" />
            <div class="meta">
              <strong>{{ s.surname }}</strong>
              <span>{{ s.postIds.length }} posts · {{ s.followers }} members</span>
              @if (s.province) { <span>{{ provinceName(s.province) }}</span> }
            </div>
            @if (joined(s)) { <span class="lf-chip lf-chip--success lf-tiny">joined</span> }
            @else if (s.verified) { <span class="lf-chip lf-chip--success lf-tiny">verified</span> }
          </a>
        }
      </div>

      <div class="lf-pad lf-safe-bottom">
        <button class="lf-btn lf-btn--primary lf-btn--block" (click)="openCreate()">
          <lf-icon name="plus" [size]="18" /> Create a spotlight for your surname
        </button>
      </div>
    </ion-content>

    <ion-modal [isOpen]="creating()" (didDismiss)="creating.set(false)" [initialBreakpoint]="0.9" [breakpoints]="[0.5, 0.9, 1]">
      <ng-template>
        <div class="sheet">
          <h3 class="lf-h2">Create a spotlight</h3>
          <p class="lf-muted lf-small">
            One community per surname, per province. You become the first admin, and anyone can join straight away.
          </p>

          <ion-item [class.bad]="touched.surname && !!surnameError()">
            <ion-label position="stacked">Surname</ion-label>
            <ion-input placeholder="e.g. Ndlela" [value]="form.surname"
                       (ionInput)="form.surname = $any($event.target).value" (ionBlur)="touched.surname = true"></ion-input>
          </ion-item>
          @if (touched.surname && surnameError()) { <p class="field-err">{{ surnameError() }}</p> }
          @if (duplicate()) {
            <p class="field-err">
              <lf-icon name="alert" [size]="13" /> A "{{ form.surname.trim() }}" spotlight already exists in
              {{ form.province ? provinceName(form.province) : 'that province' }}. Join that one instead.
            </p>
          }

          <ion-item [class.bad]="touched.province && !form.province">
            <ion-label position="stacked">Province</ion-label>
            <ion-select placeholder="Choose a province" [value]="form.province"
                        (ionChange)="form.province = $any($event.detail).value">
              <ion-select-option [value]="null">Choose a province</ion-select-option>
              @for (p of provinces; track p.code) { <ion-select-option [value]="p.code">{{ p.name }}</ion-select-option> }
            </ion-select>
          </ion-item>
          @if (touched.province && !form.province) { <p class="field-err">Choose the province this community belongs to</p> }

          <ion-item>
            <ion-label position="stacked">Tagline (optional)</ion-label>
            <ion-input placeholder="One surname. One search." [value]="form.tagline"
                       (ionInput)="form.tagline = $any($event.target).value"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">About (optional)</ion-label>
            <ion-textarea rows="3" placeholder="Who looks after this page" [value]="form.about"
                          (ionInput)="form.about = $any($event.target).value"></ion-textarea>
          </ion-item>

          @if (error()) { <p class="err"><lf-icon name="alert" [size]="15" /> {{ error() }}</p> }

          <div class="row">
            <button class="lf-btn lf-btn--ghost" (click)="creating.set(false)">Cancel</button>
            <button class="lf-btn lf-btn--primary" [disabled]="!!duplicate() || busy()" (click)="submit()">
              {{ busy() ? 'Creating…' : 'Create spotlight' }}
            </button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .filters { display: flex; align-items: center; gap: 8px; padding: 0 8px 0 0; }
    .filters .grow { flex: 1; }
    .letter { max-width: 132px; --background: var(--lf-card); border-radius: 12px; font-size: 14px;
      padding-left: 12px; min-height: 40px; }
    .section { padding: 18px var(--lf-gap) 8px; font-size: 15px; font-weight: 800; display: flex; gap: 8px;
      align-items: baseline; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 var(--lf-gap); }
    @media (min-width: 620px) { .grid { grid-template-columns: repeat(3, 1fr); } }
    .tile { position: relative; border-radius: var(--lf-radius); overflow: hidden; border: 1px solid var(--lf-line);
      background: var(--lf-card); text-decoration: none; color: inherit; display: block; }
    .tile img { width: 100%; height: 84px; object-fit: cover; display: block; }
    .tile .meta { padding: 9px 11px 12px; display: flex; flex-direction: column; gap: 2px; }
    .tile .meta strong { font-size: 15px; }
    .tile .meta span { font-size: 11.5px; color: var(--lf-muted); }
    .tile .lf-chip { position: absolute; top: 8px; right: 8px; }
    .sheet { padding: 20px var(--lf-gap) 34px; }
    .sheet p { margin: 6px 0 14px; line-height: 1.45; }
    ion-item { --background: var(--lf-card); border-radius: 12px; margin-bottom: 8px; --border-radius: 12px; }
    ion-item.bad { --border-color: var(--lf-signal); box-shadow: inset 0 0 0 1.5px var(--lf-signal); }
    .field-err { color: var(--lf-signal); font-size: 12px; font-weight: 600; margin: -4px 0 8px 4px;
      display: flex; align-items: center; gap: 5px; }
    .err { display: flex; align-items: center; gap: 8px; color: var(--lf-signal); font-size: 13px; margin: 4px 0 0; }
    .row { display: flex; gap: 10px; margin-top: 18px; }
    .row .lf-btn { flex: 1; }
  `]
})
export class SpotlightComponent {
  protected data = inject(DataService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastController);

  query = signal('');
  creating = signal(false);
  busy = signal(false);
  error = signal('');
  letter = signal<'all' | string>('all');
  touched = { surname: false, province: false };

  form = { surname: '', tagline: '', about: '', province: null as ProvinceCode | null };
  protected readonly provinces = PROVINCES;
  protected readonly provinceName = provinceName;
  protected readonly alphabet = ALPHABET;

  readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    const l = this.letter();
    return this.data
      .spotlights()
      .filter((s) => (l === 'all' ? true : s.surname.trim().charAt(0).toUpperCase() === l))
      .filter((s) => !q || s.surname.toLowerCase().includes(q) || s.tagline.toLowerCase().includes(q))
      .sort((a, b) => a.surname.localeCompare(b.surname));
  });

  readonly mine = computed(() => {
    const me = this.auth.viewerId;
    return me ? this.data.spotlights().filter((s) => s.memberIds.includes(me)) : [];
  });

  /**
   * Does this surname already have a community in the chosen province?
   * Read on every change-detection pass - the form is a plain object, so a
   * memoised computed would go stale as the person types.
   */
  duplicate(): boolean {
    const surname = this.form.surname.trim().toLowerCase();
    if (surname.length < 2 || !this.form.province) return false;
    return this.data
      .spotlights()
      .some((s) => s.surname.toLowerCase() === surname && s.province === this.form.province);
  }

  joined(s: Spotlight): boolean {
    const me = this.auth.viewerId;
    return !!me && s.memberIds.includes(me);
  }

  surnameError(): string {
    const surname = this.form.surname.trim();
    if (!surname) return 'Enter a surname';
    if (surname.length < 2) return 'A surname needs at least 2 letters';
    if (!/^[a-zA-Z'\-\s]+$/.test(surname)) return 'A surname can only contain letters';
    return '';
  }

  coverOf(surname: string, hue: number): string {
    return cover(`${surname} family`, hue || undefined);
  }

  openCreate(): void {
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/auth'], { queryParams: { next: '/spotlight' } });
      return;
    }
    this.error.set('');
    this.touched = { surname: false, province: false };
    this.form.surname = this.auth.user()?.surname ?? '';
    // never pre-select the province - the person must choose it
    this.form.province = null;
    this.creating.set(true);
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.touched = { surname: true, province: true };
    if (this.surnameError()) { this.error.set(this.surnameError()); return; }
    if (!this.form.province) { this.error.set('Choose the province this community belongs to.'); return; }
    if (this.duplicate()) {
      this.error.set(
        `A "${this.form.surname.trim()}" spotlight already exists in ` +
        `${this.form.province ? provinceName(this.form.province) : 'that province'}. Join that one instead.`
      );
      return;
    }
    this.busy.set(true);
    try {
      const sp = await this.data.createSpotlight(this.form as any);
      this.creating.set(false);
      const t = await this.toast.create({ message: `${sp.surname} spotlight created. You are the first member.`, duration: 2400, position: 'bottom' });
      await t.present();
      await this.router.navigate(['/spotlight', sp.id]);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not create the spotlight');
    } finally {
      this.busy.set(false);
    }
  }
}
