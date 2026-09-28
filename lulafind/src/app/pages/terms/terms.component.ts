import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IconComponent } from '../../shared/components/icon.component';
import { environment } from '../../../environments/environment';
import { SUPPORT_EMAIL, SUPPORT_NAME } from '../../core/config';

/**
 * Terms, privacy and community rules in plain English.
 * Both app stores require a reachable privacy policy - host this page (or the
 * text below) at a public URL before you submit.
 */
@Component({
  selector: 'lf-terms',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IconComponent],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/settings" text=""></ion-back-button></ion-buttons>
        <ion-title>Terms and privacy</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      <div class="wrap">
        <p class="lf-small lf-muted">LulaFind {{ version }} · last updated 24 September 2026</p>

        <h2 class="lf-h2">In one paragraph</h2>
        <p>
          LulaFind helps South Africans find missing people and supports families of people who left home and did
          not come back. It is a community tool. It does not replace the South African Police Service. In an
          emergency call <strong>10111</strong>.
        </p>

        <h2 class="lf-h2">The rules</h2>
        <ul>
          <li><strong>You must be 18 or older.</strong></li>
          <li>
            <strong>Everything you post must be true.</strong> Sharing false information about a missing person,
            opening a fake case, or posting someone's private details without permission is a criminal offence in
            South Africa - defamation, crimen injuria and defeating the ends of justice. It can lead to arrest.
            LulaFind hands account records to SAPS on a lawful request.
          </li>
          <li>
            <strong>Children.</strong> You may only post about a person under 18 if you are their parent, guardian
            or a SAPS officer. Those posts are reviewed by a moderator before they go live.
          </li>
          <li><strong>Never approach someone you think you have recognised.</strong> Report the sighting and call 10111.</li>
          <li><strong>Never post a home address</strong> - not the family's, not a suspect's.</li>
          <li><strong>Do not ask for money.</strong> Rewards are handled by the family, not through LulaFind.</li>
          <li><strong>One account per person.</strong> Fake accounts are removed and the person behind them is blocked.</li>
        </ul>

        <h2 class="lf-h2">What we store</h2>
        <ul>
          <li>Your email, name, surname, province and town. This is what makes a case trustworthy.</li>
          <li>Your posts, comments, votes and messages.</li>
          <li>
            Your location - <strong>only</strong> when you tap a button to share it. Live location always stops
            after one hour. You can turn every location feature off in Settings.
          </li>
          <li>Photos you upload. We do not use them for anything else.</li>
        </ul>

        <h2 class="lf-h2">What we never do</h2>
        <ul>
          <li>We never sell your data or your location.</li>
          <li>We never read a person's location without that person's own consent.</li>
          <li>We never sign you up with a phone number.</li>
        </ul>

        <h2 class="lf-h2">Your controls</h2>
        <ul>
          <li>Hide your location, your numbers and your communities from your public profile (Settings → Privacy).</li>
          <li>Post anonymously - LulaFind and SAPS still know who you are.</li>
          <li>Turn private chat off on any post you make.</li>
          <li>Delete your account and everything in it (Settings → Delete my account).</li>
        </ul>

        <h2 class="lf-h2">Reporting and moderation</h2>
        <p>
          Anyone can report a post, a comment or a person. A LulaFind admin reviews every report and can remove the
          post, suspend the account, or dismiss the report as unfounded. If you are a moderator you will see the
          queue at <strong>Me → Admin</strong>.
        </p>

        <h2 class="lf-h2">Support</h2>
        <p>
          Email <a href="mailto:{{ support }}">support&#64;{{ support }}</a> - {{ supportName }}.
          We answer every message.
        </p>

        <div class="lf-banner lf-banner--warn">
          <lf-icon name="alert" [size]="18" />
          <div>
            Free lines: SAPS 10111 (24 hours) · Crime Stop 08600 10111 (anonymous) · Stop GBV 0800 428 428 ·
            Childline 0800 055 555 · SADAG 0800 567 567.
          </div>
        </div>

        <button class="lf-btn lf-btn--primary lf-btn--block" (click)="back()">Close</button>
      </div>
    </ion-content>
  `,
  styles: [`
    .wrap { padding: 18px 20px 40px; max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
    h2 { margin: 18px 0 4px; }
    p { line-height: 1.6; margin: 6px 0; font-size: 14.5px; }
    ul { margin: 6px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
    li { line-height: 1.55; font-size: 14.5px; }
    a { color: var(--lf-beacon); }
  `]
})
export class TermsComponent {
  private nav = inject(Location);
  private router = inject(Router);
  protected readonly version = environment.appVersion;
  protected readonly support = SUPPORT_EMAIL;
  protected readonly supportName = SUPPORT_NAME;

  back(): void {
    if (window.history.length > 1) this.nav.back();
    else void this.router.navigate(['/settings']);
  }
}
