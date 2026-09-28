import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { AuthService } from '../../core/services/auth.service';

/**
 * The middle tab has no screen of its own.
 * Tapping it opens the composer on its own page, above the tab bar,
 * so the form is never an empty tab.
 */
@Component({
  selector: 'lf-create',
  standalone: true,
  imports: [IonContent],
  template: `
    <ion-content class="lf-page">
      <div class="opening">
        <p>{{ message() }}</p>
        <button type="button" class="lf-btn lf-btn--primary" (click)="go()">{{ button() }}</button>
      </div>
    </ion-content>
  `,
  styles: [`
    .opening {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 32px var(--lf-gap);
      text-align: center;
    }
    p { margin: 0; color: var(--lf-muted); font-size: 15px; font-weight: 700; }
  `]
})
export class CreateComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  protected readonly message = signal('Opening the form…');
  protected readonly button = signal('Open the form');

  constructor() {
    void this.go();
  }

  ionViewWillEnter(): void {
    void this.go();
  }

  async go(): Promise<void> {
    if (!this.auth.signedIn()) {
      this.message.set('Sign in to post. You must be 18 or older.');
      this.button.set('Sign in');
      await this.router.navigate(['/auth'], { queryParams: { next: '/new' }, replaceUrl: true });
      return;
    }
    this.message.set('Opening the form…');
    this.button.set('Open the form');
    await this.router.navigate(['/new'], { replaceUrl: true });
  }
}
