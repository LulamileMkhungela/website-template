import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PlatformService } from './core/services/platform.service';
import { PrefetchService } from './core/services/prefetch.service';
import { SettingsService } from './core/services/settings.service';
import { supabaseNotice } from './core/data/supabase-client';

@Component({
  selector: 'lf-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      @if (notice()) {
        <p style="margin:0;padding:10px 14px;background:#7a2e24;color:#fff;font:600 13px/1.35 system-ui">{{ notice() }}</p>
      }

      <!-- ── Animated splash overlay ── shown until auth is ready, then fades out -->
      @if (splashVisible()) {
        <div class="lf-splash" [class.lf-splash--out]="splashFading()" aria-hidden="true">
          <div class="lf-splash__logo">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="32" cy="32" r="32" fill="#f2b233"/>
              <!-- Stylised magnifier with a heart inside -->
              <circle cx="29" cy="28" r="12" stroke="#04150c" stroke-width="4" fill="none"/>
              <line x1="38" y1="37" x2="50" y2="49" stroke="#04150c" stroke-width="4" stroke-linecap="round"/>
              <path d="M29 24 c0-2 3-3 3 0 c0-3 3-2 3 0 c0 3-3 5-3 5 s-3-2-3-5z" fill="#04150c"/>
            </svg>
          </div>
          <div class="lf-splash__wordmark">
            <span class="lf-splash__lula">Lula</span><span class="lf-splash__find">Find</span>
          </div>
          <p class="lf-splash__tagline">Bring them home.</p>
          <div class="lf-splash__dots" role="status" aria-label="Loading">
            <span></span><span></span><span></span>
          </div>
        </div>
      }

      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  styles: [`
    .lf-splash {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px;
      background: #0a1024;
      transition: opacity .55s cubic-bezier(.4,0,.2,1), transform .55s cubic-bezier(.4,0,.2,1);
    }
    .lf-splash--out {
      opacity: 0;
      transform: scale(1.04);
      pointer-events: none;
    }
    .lf-splash__logo {
      animation: splash-pop .7s cubic-bezier(.2,.8,.2,1) both;
    }
    .lf-splash__logo svg {
      display: block;
      filter: drop-shadow(0 8px 24px rgba(242,178,51,.45));
    }
    .lf-splash__wordmark {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -1.5px;
      animation: splash-up .6s .1s cubic-bezier(.2,.8,.2,1) both;
    }
    .lf-splash__lula { color: #f2b233; }
    .lf-splash__find { color: #eaf0ff; }
    .lf-splash__tagline {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: rgba(234,240,255,.55);
      letter-spacing: .4px;
      animation: splash-up .6s .2s cubic-bezier(.2,.8,.2,1) both;
    }
    .lf-splash__dots {
      display: flex; gap: 7px; margin-top: 28px;
      animation: splash-up .6s .3s cubic-bezier(.2,.8,.2,1) both;
    }
    .lf-splash__dots span {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(242,178,51,.7);
      animation: splash-dot 1.2s ease-in-out infinite;
    }
    .lf-splash__dots span:nth-child(2) { animation-delay: .2s; }
    .lf-splash__dots span:nth-child(3) { animation-delay: .4s; }
    @keyframes splash-pop {
      from { transform: scale(.5); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }
    @keyframes splash-up {
      from { transform: translateY(14px); opacity: 0; }
      to   { transform: none; opacity: 1; }
    }
    @keyframes splash-dot {
      0%, 80%, 100% { transform: scale(.6); opacity: .4; }
      40%           { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .lf-splash, .lf-splash__logo, .lf-splash__wordmark,
      .lf-splash__tagline, .lf-splash__dots,
      .lf-splash__dots span { animation: none; transition: none; }
    }
  `]
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private prefetch = inject(PrefetchService);
  private settings = inject(SettingsService);
  readonly notice = supabaseNotice;

  /** Splash overlay state — visible until auth.ready(), then fades for .55s and removes. */
  readonly splashVisible = signal(true);
  readonly splashFading = signal(false);

  constructor() {
    this.prefetch.start(0);

    // Once auth is restored, start the fade-out sequence and route to login if not signed in.
    effect(() => {
      if (!this.auth.ready()) return;
      this.splashFading.set(true);
      // Remove from DOM after the CSS transition finishes (580ms) and redirect if needed.
      setTimeout(() => {
        this.splashVisible.set(false);
        if (!this.auth.signedIn() && !this.auth.guestBrowsing()) {
          void this.router.navigate(['/auth']);
        }
      }, 580);
    });

    // Signed in but not onboarded -> straight into the Snapchat-style walkthrough.
    effect(() => {
      const u = this.auth.user();
      if (this.auth.passwordRecovery()) {
        if (!this.router.url.startsWith('/auth')) void this.router.navigate(['/auth']);
        return;
      }
      if (u && !u.onboarded && this.auth.ready()) void this.router.navigate(['/onboarding']);
    });

    effect(() => {
      this.settings.settings();
      if (this.platform.isNative) void this.syncStatusBar();
    });
  }

  private isLight(): boolean {
    const mode = this.settings.settings().theme;
    return mode === 'light' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: light)').matches);
  }

  private async syncStatusBar(): Promise<void> {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: this.isLight() ? Style.Light : Style.Dark });
    } catch {
      /* plugin unavailable in this build target */
    }
  }

  async ngOnInit(): Promise<void> {
    this.platform.watchKeyboard();
    this.listenForPress();
    await this.configureNative();
  }

  /** A light tap on every button, so the app answers the finger. */
  private listenForPress(): void {
    document.addEventListener('pointerdown', (ev) => {
      const el = ev.target as HTMLElement | null;
      if (!this.settings.settings().haptics) return;
      if (!el?.closest('button, ion-tab-button, a, .lf-action, .chip, .quickbtn')) return;
      void this.platform.haptic('light');
    }, { passive: true });
  }

  private async configureNative(): Promise<void> {
    if (!this.platform.isNative) return;
    try {
      const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen')
      ]);
      const light = this.isLight();
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark });
      // The native splash screen is hidden after the in-app splash begins fading.
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch {
      /* plugins unavailable in this build target */
    }
  }
}
