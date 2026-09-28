import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { ToastController } from '@ionic/angular/toast-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { EscalationService } from '../../core/services/escalation.service';
import { DataService } from '../../core/services/data.service';
import { Post } from '../../core/models/types';
import { escalationNote } from '../../core/data/sa-help';

@Component({
  selector: 'lf-escalate',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonSkeletonText,
    RouterLink, IconComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button [defaultHref]="'/post/' + id" text=""></ion-back-button></ion-buttons>
        <ion-title>Call for help</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      @if (!p()) {
        <div class="lf-card"><ion-skeleton-text style="height:160px"></ion-skeleton-text></div>
      } @else {
        <div class="lf-banner lf-banner--danger">
          <lf-icon name="phone" [size]="20" />
          <div>
            LulaFind cannot open a police docket or message an NGO.
            <strong>You call. We only save a note if you ask.</strong>
          </div>
        </div>

        <section class="card">
          <h2 class="lf-h2" style="margin:0 0 4px">Call them yourself</h2>
          @if (p()!.type === 'missing' && (p()!.subject?.age ?? 99) < 18) {
            <p class="lf-small">An Amber Alert is issued by SAPS, not by LulaFind. Ask the investigating officer.</p>
          }
          @for (partner of partners(); track partner.id) {
            <div class="partner">
              <div class="lf-grow">
                <strong>{{ partner.name }}</strong>
                <span class="lf-small lf-muted">{{ partner.detail }}</span>
              </div>
              <a class="lf-btn lf-btn--sm" [href]="partner.href"
                 [attr.target]="partner.href.startsWith('http') ? '_blank' : null"
                 [attr.rel]="partner.href.startsWith('http') ? 'noopener' : null">{{ partner.actionLabel }}</a>
            </div>
            <label class="tick">
              <input type="checkbox" [checked]="selected().includes(partner.id)" (change)="toggle(partner.id)" />
              I contacted them
            </label>
          }
          <p class="lf-tiny lf-muted">A tick does not send your photos, your number, or this case.</p>
        </section>

        @if (p()!.escalation.partners.length) {
          <section class="card">
            <h2 class="lf-h2" style="margin:0 0 6px">On this case</h2>
            @for (e of p()!.escalation.partners; track e.partnerId) {
              <div class="status">
                <lf-icon name="info" [size]="16" />
                <div class="lf-grow">
                  <strong>{{ e.partnerName }}</strong>
                  <span class="lf-small lf-muted">{{ note(e.status) }}
                    @if (e.reference) { · station case {{ e.reference }} }</span>
                </div>
              </div>
            }
          </section>
        }

        <div class="lf-pad actions">
          <a class="lf-btn lf-btn--block" routerLink="/help">All help numbers</a>
          <button class="lf-btn lf-btn--primary lf-btn--block" [disabled]="!selected().length || escalation.sending()" (click)="agree()">
            <lf-icon name="check" [size]="16" /> {{ escalation.sending() ? 'Saving…' : 'Save a note that I called' }}
          </button>
          @if (p()!.escalation.consentGranted) {
            <button class="lf-btn lf-btn--danger lf-btn--block" (click)="revoke()">
              <lf-icon name="x" [size]="16" /> Remove this note
            </button>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .card { margin: 12px var(--lf-gap); padding: 15px; border-radius: var(--lf-radius);
      border: 1px solid var(--lf-line); background: var(--lf-card); }
    .partner { display: flex; gap: 12px; align-items: center; padding: 11px 0 4px; border-top: 1px solid var(--lf-line); }
    .partner:first-of-type { border-top: 0; }
    .partner div { display: flex; flex-direction: column; gap: 2px; }
    .tick { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; padding: 0 0 8px; }
    .tick input { width: 18px; height: 18px; accent-color: var(--lf-beacon); }
    .status { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 11px;
      background: var(--lf-card-2); margin-bottom: 6px; }
    .status div { display: flex; flex-direction: column; gap: 2px; }
    .actions { display: flex; flex-direction: column; gap: 10px; padding-bottom: 30px; }
    a.lf-btn { text-decoration: none; }
  `]
})
export class EscalateComponent implements OnInit {
  protected escalation = inject(EscalationService);
  protected data = inject(DataService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);

  protected readonly note = escalationNote;

  id = '';
  p = signal<Post | null>(null);
  selected = signal<string[]>([]);

  readonly partners = computed(() => (this.p() ? this.escalation.partnersFor(this.p()!) : []));

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('postId') ?? '';
    const cached = this.data.post(this.id);
    if (cached) this.p.set(cached);
    void this.data.loadPost(this.id).then((fresh) => {
      if (fresh) this.p.set(fresh);
    });
  }

  toggle(id: string): void {
    const cur = this.selected();
    this.selected.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  async agree(): Promise<void> {
    const p = this.p();
    if (!p || !this.selected().length) return;
    try {
      const next = await this.escalation.grantConsent(p, this.selected());
      if (next) this.p.set(next);
      await this.saveNote();
    } catch (e: unknown) {
      await this.say(e instanceof Error ? e.message : 'Could not save the note');
    }
  }

  async saveNote(): Promise<void> {
    const p = this.p();
    if (!p) return;
    try {
      const next = await this.escalation.dispatch(p, this.selected());
      if (next) this.p.set(next);
      this.selected.set([]);
      await this.say(this.escalation.lastResult() ?? 'Saved. Nothing was sent.');
    } catch (e: unknown) {
      await this.say(e instanceof Error ? e.message : 'Could not save the note');
    }
  }

  async revoke(): Promise<void> {
    const p = this.p();
    if (!p) return;
    const next = await this.escalation.revokeConsent(p);
    if (next) this.p.set(next);
    await this.say('Note removed. Nothing was sent.');
  }

  private async say(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 2800, position: 'bottom' });
    await t.present();
  }
}
