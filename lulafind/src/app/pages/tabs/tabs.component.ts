import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonTabs } from '@ionic/angular/ion-tabs';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonTabBar, IonTabButton } from '@ionic/angular';
import { IconComponent } from '../../shared/components/icon.component';
import { ChatService } from '../../core/services/chat.service';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'lf-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, IconComponent],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home">
          <lf-icon name="home" [size]="22" />
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="spotlight">
          <lf-icon name="users" [size]="22" />
          <ion-label>Spotlight</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="create" (click)="openCreate($event)">
          <div class="fb-fab"><lf-icon name="plus" [size]="22" [weight]="2.5" /></div>
          <ion-label>Report</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="chats">
          <div class="wrap">
            <lf-icon name="chat" [size]="22" />
            @if (unread() > 0) { <span class="lf-badge">{{ unread() }}</span> }
          </div>
          <ion-label>Chats</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="me">
          <div class="wrap">
            <lf-icon name="user" [size]="22" />
            @if (alerts() > 0) { <span class="lf-badge dot"></span> }
          </div>
          <ion-label>Menu</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar {
      background: #ffffff;
      border-top: 1px solid #ced0d4;
      height: 56px;
      padding: 0;
      box-shadow: 0 -1px 3px rgba(0,0,0,0.06);
    }
    ion-tab-button {
      --color: #65676b;
      --color-selected: #1877f2;
      background: transparent;
      padding: 4px 0;
    }
    ion-tab-button.tab-selected lf-icon {
      color: #1877f2;
    }
    ion-label {
      font-size: 11px;
      font-weight: 600;
      margin-top: 2px;
    }
    .fb-fab {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #1877f2;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wrap { position: relative; }
    .lf-badge {
      position: absolute;
      top: -4px;
      right: -8px;
      background: #e41e3f;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      border-radius: 999px;
      min-width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .lf-badge.dot {
      min-width: 8px; width: 8px; height: 8px; padding: 0; top: 0; right: -2px; background: #e41e3f;
    }
  `]
})
export class TabsComponent {
  private chat = inject(ChatService);
  private data = inject(DataService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly unread = computed(() => this.chat.unreadTotal());
  readonly alerts = computed(() => this.data.unreadNotifications());

  openCreate(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/auth'], { queryParams: { next: '/new' } });
      return;
    }
    void this.router.navigate(['/new']);
  }
}
