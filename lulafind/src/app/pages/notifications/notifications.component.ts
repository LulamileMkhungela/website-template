import { Component, computed, inject } from '@angular/core';
import { Router } from "@angular/router";
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IconComponent } from '../../shared/components/icon.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { DataService } from '../../core/services/data.service';
import { Notification } from '../../core/models/types';
import { timeAgo } from '../../core/utils/format';

@Component({
  selector: 'lf-notifications',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IconComponent, EmptyComponent],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-title>Alerts</ion-title>
        <ion-buttons slot="end">
          <button class="lf-icon-btn" (click)="readAll()"><lf-icon name="check" [size]="20" /></button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      @if (!items().length) {
        <lf-empty icon="bell" title="No alerts yet"
                  message="You will get pinged when someone votes, comments, follows, or when a case you posted is escalated." />
      }
      <div class="list">
        @for (n of items(); track n.id) {
          <button class="row" [class.unread]="!n.read" (click)="go(n)">
            <span class="ic" [attr.data-kind]="n.kind"><lf-icon [name]="iconFor(n.kind)" [size]="17" /></span>
            <div class="lf-grow">
              <strong>{{ n.title }}</strong>
              <p>{{ n.body }}</p>
              <span class="lf-tiny lf-muted">{{ timeAgo(n.at) }}</span>
            </div>
            @if (!n.read) { <span class="dot"></span> }
          </button>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .list { padding: 8px var(--lf-gap) 26px; display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; gap: 12px; align-items: flex-start; padding: 13px; border-radius: var(--lf-radius);
      border: 1px solid var(--lf-line); background: var(--lf-card); color: inherit; text-align: left; cursor: pointer; }
    .row.unread { border-color: color-mix(in srgb, var(--lf-beacon) 40%, var(--lf-line)); }
    .row p { margin: 3px 0; font-size: 13px; color: var(--lf-muted); line-height: 1.45; }
    .ic { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      background: var(--lf-card-2); color: var(--lf-beacon); flex-shrink: 0; }
    .ic[data-kind="danger"] { color: var(--lf-signal); }
    .ic[data-kind="escalation"] { color: var(--lf-ubuntu); }
    .ic[data-kind="vote"] { color: var(--lf-ubuntu); }
    .ic[data-kind="outcome"] { color: var(--lf-marigold); }
    .ic[data-kind="claim"] { color: var(--lf-marigold); }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--lf-beacon); flex-shrink: 0; margin-top: 6px; }
  `]
})
export class NotificationsComponent {
  protected data = inject(DataService);
  private router = inject(Router);

  protected readonly timeAgo = timeAgo;
  readonly items = computed(() => this.data.notifications());

  iconFor(kind: Notification['kind']): string {
    return ({
      vote: 'thumbup', comment: 'comment', follow: 'users', chat: 'chat', system: 'info',
      escalation: 'megaphone', location_consent: 'target', claim: 'user', outcome: 'award', spotlight: 'users', danger: 'alert'
    } as Record<string, string>)[kind] ?? 'bell';
  }

  async go(n: Notification): Promise<void> {
    await this.data.markNotificationsRead();
    if (n.route) await this.router.navigateByUrl(n.route);
  }

  async readAll(): Promise<void> {
    await this.data.markNotificationsRead();
  }
}
