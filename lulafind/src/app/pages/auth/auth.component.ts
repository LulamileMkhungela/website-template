import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonProgressBar } from '@ionic/angular/ion-progress-bar';
import { ToastController } from '@ionic/angular/toast-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { AuthService, AuthProvider } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ProvinceCode, PROVINCES } from '../../core/models/types';
import { SUPPORT_EMAIL, SUPPORT_NAME } from '../../core/config';
import { parseFullName } from '../../core/utils/format';

type Mode = 'welcome' | 'signup' | 'signin' | 'forgot' | 'newpass';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * LulaFind account flow: email + password, Google OAuth, recovery, and a compact profile setup.
 * The screens keep the social-app familiarity while making age, terms and privacy choices explicit.
 */
@Component({
  selector: 'lf-auth',
  standalone: true,
  imports: [IonContent, IconComponent, AvatarComponent],
  template: `
    <ion-content class="lf-page auth" [class.welcome-bg]="mode() === 'welcome'">
      @if (mode() === 'welcome') {
        <section class="lf-fade-in snap-welcome">
          <div class="snap-logo-wrap">
            <div class="ghost-logo">
              <span class="mark">Lula</span><span class="mark mark--2">Find</span>
            </div>
          </div>

          <div class="snap-bottom-cta">
            <button class="snap-btn snap-btn--google" (click)="provider('google')">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <button class="snap-btn snap-btn--blue" (click)="startSignup()">
              Sign Up
            </button>

            <p class="snap-switch">
              Already have an account? <button class="snap-link" (click)="mode.set('signin')">Log in</button>
            </p>
            <p class="snap-switch guest-link">
              <button class="snap-link-muted" (click)="browse()">Browse as guest</button>
            </p>
          </div>
        </section>
      }

      @if (mode() === 'signin') {
        <section class="lf-fade-in snap-form">
          <div class="snap-header">
            <button class="snap-back" (click)="mode.set('welcome')" aria-label="Back">
              <lf-icon name="arrowLeft" [size]="22" />
            </button>
            <h1 class="snap-title">Log in</h1>
            <div style="width:32px"></div>
          </div>

          <div class="snap-body">
            <div class="snap-field">
              <label class="snap-label">EMAIL ADDRESS</label>
              <input class="snap-input" type="email" autocomplete="email" placeholder="you@example.co.za"
                     [value]="f.email" (input)="f.email = $any($event.target).value"
                     (blur)="touched.email = true" />
              @if (touched.email && !emailOk() && f.email.length > 0) {
                <p class="field-err">Enter a valid email address</p>
              }
            </div>

            <div class="snap-field">
              <label class="snap-label">PASSWORD</label>
              <div class="snap-pass-wrap">
                <input class="snap-input" [type]="showPass() ? 'text' : 'password'" placeholder=""
                       [value]="f.password" (input)="f.password = $any($event.target).value"
                       (blur)="touched.password = true" />
                <button class="eye-btn" (click)="showPass.set(!showPass())" type="button" aria-label="Toggle password visibility">
                  <lf-icon [name]="showPass() ? 'eyeOff' : 'eye'" [size]="18" />
                </button>
              </div>
              @if (touched.password && !f.password) {
                <p class="field-err">Enter your password</p>
              }
            </div>

            <button class="snap-btn snap-btn--blue snap-block" [disabled]="busy()" (click)="signin()">
              {{ busy() ? 'Logging in…' : 'Log in' }}
            </button>

            <button class="snap-text-link" type="button" (click)="mode.set('forgot')">
              Forgot your password?
            </button>

            <div class="snap-divider"><span>OR</span></div>

            <button class="snap-btn snap-btn--black snap-block" (click)="provider('google')">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <label class="snap-checkbox-row">
              <input type="checkbox" [checked]="saveLoginInfo" (change)="saveLoginInfo = $any($event.target).checked" />
              <span>Save Login Info on your device</span>
            </label>

            @if (error()) { <p class="err-msg"><lf-icon name="alert" [size]="15" /> {{ error() }}</p> }
            @if (notice()) { <p class="ok-msg"><lf-icon name="check" [size]="15" /> {{ notice() }}</p> }
          </div>
        </section>
      }

      @if (mode() === 'signup') {
        <section class="lf-fade-in snap-form">
          <div class="snap-header">
            <button class="snap-back" (click)="prevStep()" aria-label="Back">
              <lf-icon name="arrowLeft" [size]="22" />
            </button>
            <div class="snap-title-group">
              <h1 class="snap-title-sm">Create account</h1>
              <p class="snap-step-sub">Step {{ signupStep() }} of 5</p>
            </div>
            <div style="width:32px"></div>
          </div>

          <div class="snap-body">
            @if (signupStep() === 1) {
              <h2 class="snap-question">What's your name?</h2>
              <div class="snap-field">
                <label class="snap-label">FIRST NAME AND SURNAME</label>
                <input class="snap-input" type="text" placeholder="e.g. John Doe"
                       [value]="f.displayName" (input)="onFullName($any($event.target).value)"
                       (blur)="touched.name = true" />
                @if (touched.name && !nameOk()) {
                  <p class="field-err">Enter your first name and surname</p>
                }
              </div>

              <div class="snap-footer-notes">
                <p class="fine-terms">
                  By tapping "Agree and continue" below, you agree to the
                  <button class="linklike" type="button" (click)="openTerms()">Terms of Service</button>
                  and acknowledge that you have read the
                  <button class="linklike" type="button" (click)="openPrivacy()">Privacy Policy</button>.
                </p>
                <button class="snap-btn snap-btn--blue snap-block" (click)="nextStep()">
                  Agree and continue
                </button>
              </div>
            }

            @if (signupStep() === 2) {
              <h2 class="snap-question">What's your username?</h2>
              <p class="snap-subtext">Your username is how your community identifies your case posts.</p>
              @if (nameParts()) {
                <div class="snap-ident-card">
                  <lf-avatar src="" [name]="f.displayName" [size]="48" />
                  <div>
                    <span class="k">YOUR USERNAME</span>
                    <strong>&#64;{{ usernamePreview() }}</strong>
                  </div>
                </div>
              }
              <div class="snap-footer-notes">
                <button class="snap-btn snap-btn--blue snap-block" (click)="nextStep()">
                  Continue
                </button>
              </div>
            }

            @if (signupStep() === 3) {
              <h2 class="snap-question">Set a password</h2>
              <p class="snap-subtext">Your password must be at least 8 characters long.</p>
              <div class="snap-field">
                <label class="snap-label">PASSWORD</label>
                <div class="snap-pass-wrap">
                  <input class="snap-input" [type]="showPass() ? 'text' : 'password'" placeholder="At least 8 characters"
                         [value]="f.password" (input)="f.password = $any($event.target).value"
                         (blur)="touched.password = true" />
                  <button class="eye-btn" (click)="showPass.set(!showPass())" type="button" aria-label="Toggle password">
                    <lf-icon [name]="showPass() ? 'eyeOff' : 'eye'" [size]="18" />
                  </button>
                </div>
                @if (touched.password && f.password.length < 8) {
                  <p class="field-err">Use at least 8 characters</p>
                }
              </div>
              <div class="snap-footer-notes">
                <button class="snap-btn snap-btn--blue snap-block" (click)="nextStep()">
                  Continue
                </button>
              </div>
            }

            @if (signupStep() === 4) {
              <h2 class="snap-question">What's your email?</h2>
              <div class="snap-field">
                <label class="snap-label">EMAIL</label>
                <input class="snap-input" type="email" placeholder="you@example.co.za"
                       [value]="f.email" [disabled]="!!pendingName()"
                       (input)="f.email = $any($event.target).value" (blur)="touched.email = true" />
                @if (touched.email && !emailOk()) {
                  <p class="field-err">Enter a valid email address</p>
                }
              </div>
              <div class="snap-footer-notes">
                <button class="snap-btn snap-btn--blue snap-block" (click)="nextStep()">
                  Continue
                </button>
              </div>
            }

            @if (signupStep() === 5) {
              <h2 class="snap-question">Select your province</h2>
              <p class="snap-subtext">Choose your province to customize local emergency and search party alerts.</p>
              <div class="snap-field">
                <label class="snap-label">PROVINCE</label>
                <select class="snap-select" [value]="f.province ?? ''" (change)="f.province = $any($event.target).value">
                  <option value="" disabled>Select province...</option>
                  @for (p of provinces; track p.code) {
                    <option [value]="p.code">{{ p.name }}</option>
                  }
                </select>
              </div>

              <div class="snap-agree-box">
                <label class="snap-check">
                  <input type="checkbox" [checked]="over18" (change)="over18 = $any($event.target).checked" />
                  <span>I am <strong>18 or older</strong>.</span>
                </label>
                <label class="snap-check">
                  <input type="checkbox" [checked]="terms" (change)="terms = $any($event.target).checked" />
                  <span>I agree to the Terms & Privacy Policy and confirm my information is true.</span>
                </label>
              </div>

              <div class="snap-footer-notes">
                <button class="snap-btn snap-btn--blue snap-block" [disabled]="busy()" (click)="signup()">
                  {{ busy() ? 'Creating account…' : 'Agree and continue' }}
                </button>
              </div>
            }

            @if (error()) { <p class="err-msg"><lf-icon name="alert" [size]="15" /> {{ error() }}</p> }
            @if (notice()) { <p class="ok-msg"><lf-icon name="check" [size]="15" /> {{ notice() }}</p> }
          </div>
        </section>
      }

      @if (mode() === 'forgot') {
        <section class="lf-fade-in snap-form">
          <div class="snap-header">
            <button class="snap-back" (click)="mode.set('signin')" aria-label="Back">
              <lf-icon name="arrowLeft" [size]="22" />
            </button>
            <h1 class="snap-title">Reset password</h1>
            <div style="width:32px"></div>
          </div>
          <div class="snap-body">
            <p class="snap-subtext">Enter your email address and we'll send you a password reset link.</p>
            <div class="snap-field">
              <label class="snap-label">EMAIL</label>
              <input class="snap-input" type="email" placeholder="you@example.co.za"
                     [value]="f.email" (input)="f.email = $any($event.target).value" />
            </div>
            <button class="snap-btn snap-btn--blue snap-block" (click)="forgot()">Send reset link</button>
            @if (error()) { <p class="err-msg"><lf-icon name="alert" [size]="15" /> {{ error() }}</p> }
            @if (notice()) { <p class="ok-msg"><lf-icon name="check" [size]="15" /> {{ notice() }}</p> }
          </div>
        </section>
      }

      @if (mode() === 'newpass') {
        <section class="lf-fade-in snap-form">
          <div class="snap-header">
            <button class="snap-back" type="button" (click)="mode.set('signin')" aria-label="Back to sign in">
              <lf-icon name="arrowLeft" [size]="22" />
            </button>
            <h1 class="snap-title">Choose a new password</h1>
            <div style="width:32px"></div>
          </div>
          <div class="snap-body">
            <p class="snap-subtext">Use at least 8 characters. You can sign in with it straight away.</p>
            <div class="snap-field">
              <label class="snap-label" for="new-password">NEW PASSWORD</label>
              <div class="snap-pass-wrap">
                <input id="new-password" class="snap-input" [type]="showPass() ? 'text' : 'password'"
                       autocomplete="new-password" placeholder="At least 8 characters"
                       [value]="f.newPassword" (input)="f.newPassword = $any($event.target).value" />
                <button class="eye-btn" type="button" (click)="showPass.set(!showPass())" aria-label="Toggle password visibility">
                  <lf-icon [name]="showPass() ? 'eyeOff' : 'eye'" [size]="18" />
                </button>
              </div>
            </div>
            <div class="snap-field">
              <label class="snap-label" for="confirm-password">CONFIRM NEW PASSWORD</label>
              <input id="confirm-password" class="snap-input" type="password" autocomplete="new-password"
                     placeholder="Enter it again" [value]="f.confirmPassword"
                     (input)="f.confirmPassword = $any($event.target).value" />
            </div>
            <button class="snap-btn snap-btn--blue snap-block" [disabled]="busy()" (click)="saveNewPassword()">
              {{ busy() ? 'Saving…' : 'Save new password' }}
            </button>
            @if (error()) { <p class="err-msg" role="alert"><lf-icon name="alert" [size]="15" /> {{ error() }}</p> }
            @if (notice()) { <p class="ok-msg"><lf-icon name="check" [size]="15" /> {{ notice() }}</p> }
          </div>
        </section>
      }
    </ion-content>

    @if (legal()) {
      <div class="legal" (click)="legal.set(null)">
        <div class="sheet" (click)="$event.stopPropagation()">
          <div class="lf-row-between">
            <h3 class="lf-h2">{{ legal() }}</h3>
            <button class="lf-icon-btn" (click)="legal.set(null)"><lf-icon name="x" [size]="20" /></button>
          </div>
          <p class="lf-small">
            LulaFind is a community tool for finding missing people in South Africa. In an emergency call <strong>10111</strong>.
          </p>
          <p class="lf-small">
            <strong>Your duty:</strong> Everything you post must be true. Sharing false information about a missing person is a criminal offence in South Africa.
          </p>
          <button class="snap-btn snap-btn--blue snap-block" style="margin-top:16px" (click)="legal.set(null)">Close</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .welcome-bg { --background: #f0f2f5 !important; }
    .snap-welcome {
      min-height: 100dvh;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: max(56px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
      background: #f0f2f5;
    }
    .snap-logo-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ghost-logo {
      font-size: clamp(46px, 14vw, 64px);
      font-weight: 850;
      letter-spacing: -2.6px;
      color: #1877f2;
      line-height: 1;
      text-shadow: 0 4px 18px rgba(24,119,242,.12);
    }
    .mark { color: #1877f2; }
    .mark--2 { color: #1c1e21; }

    .snap-bottom-cta {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 360px;
      margin: 0 auto;
    }

    .snap-btn {
      height: 50px;
      border-radius: 999px;
      border: 0;
      font-size: 16px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      width: 100%;
      transition: transform 0.1s ease, filter 0.12s ease;
    }
    .snap-btn:active { transform: scale(0.98); }
    .snap-btn--google {
      background: #ffffff;
      color: #000000;
      box-shadow: 0 4px 14px rgba(0,0,0,0.1);
    }
    .snap-btn--blue {
      background: #1877f2;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(24, 119, 242, .2);
    }
    .snap-btn--black {
      background: #ffffff;
      color: #1c1e21;
      border: 1px solid #ced0d4;
    }
    .snap-block { width: 100%; margin-top: 10px; }

    .snap-switch {
      text-align: center;
      font-size: 14px;
      color: #000000;
      margin: 6px 0 0;
      font-weight: 600;
    }
    .snap-link {
      background: none;
      border: 0;
      color: #1877f2;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
      text-decoration: underline;
    }
    .snap-link-muted {
      background: none;
      border: 0;
      color: rgba(0,0,0,0.6);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Snapchat Form Screens */
    .snap-form {
      box-sizing: border-box;
      padding: max(16px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
      max-width: 440px;
      width: min(100% - 24px, 440px);
      margin: 12px auto max(12px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      min-height: calc(100dvh - 24px);
      border: 1px solid #e4e6eb;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 10px 32px rgba(20, 42, 72, .07);
    }
    .snap-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 48px;
    }
    .snap-back {
      background: none;
      border: 0;
      color: #000;
      cursor: pointer;
      padding: 4px;
    }
    .snap-title {
      font-size: 24px;
      font-weight: 800;
      color: #000000;
      margin: 0;
    }
    .snap-title-group { text-align: center; }
    .snap-title-sm { font-size: 18px; font-weight: 800; margin: 0; color: #000; }
    .snap-step-sub { font-size: 12px; color: #65676b; margin: 2px 0 0; font-weight: 600; }

    .snap-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      margin-top: 24px;
    }
    .snap-question {
      font-size: 22px;
      font-weight: 800;
      color: #000000;
      margin: 0 0 16px;
    }
    .snap-subtext {
      font-size: 14px;
      color: #65676b;
      margin: -8px 0 16px;
      line-height: 1.4;
    }

    .snap-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 18px;
    }
    .snap-label {
      font-size: 11px;
      font-weight: 800;
      color: #1877f2;
      letter-spacing: 0.5px;
    }
    .snap-input, .snap-select {
      height: 50px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      padding: 0 16px;
      font-size: 16px;
      color: #000000;
      background: #ffffff;
      outline: none;
      width: 100%;
    }
    .snap-input:focus, .snap-select:focus {
      border-color: #1877f2;
      box-shadow: 0 0 0 2px rgba(24, 119, 242, .15);
    }
    .snap-pass-wrap {
      position: relative;
      width: 100%;
    }
    .eye-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: 0;
      color: #65676b;
      cursor: pointer;
    }

    .snap-text-link {
      background: none;
      border: 0;
      color: #1877f2;
      font-size: 14px;
      font-weight: 700;
      margin-top: 12px;
      cursor: pointer;
      align-self: center;
    }

    .snap-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #8e8e93;
      font-size: 12px;
      font-weight: 700;
      margin: 24px 0 16px;
    }
    .snap-divider::before, .snap-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e5ea;
    }

    .snap-checkbox-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #65676b;
      margin-top: 18px;
      justify-content: center;
    }
    .snap-checkbox-row input { accent-color: #1877f2; width: 18px; height: 18px; }

    .snap-ident-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid #e5e5ea;
      background: #f9f9fb;
      margin-bottom: 20px;
    }
    .snap-ident-card .k { font-size: 10px; color: #8e8e93; font-weight: 800; display: block; }
    .snap-ident-card strong { font-size: 17px; color: #000000; }

    .snap-footer-notes {
      margin-top: auto;
      padding-top: 20px;
    }
    .fine-terms {
      font-size: 12px;
      color: #65676b;
      line-height: 1.45;
      text-align: center;
      margin-bottom: 12px;
    }

    .snap-agree-box {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }
    .snap-check {
      display: flex;
      gap: 10px;
      font-size: 13px;
      color: #333333;
      line-height: 1.4;
    }
    .snap-check input { accent-color: #1877f2; width: 20px; height: 20px; flex-shrink: 0; }

    .field-err { color: #d93025; font-size: 12px; font-weight: 600; margin: 4px 0 0; }
    .err-msg { color: #d93025; font-size: 13px; margin: 12px 0 0; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .ok-msg { color: #148a52; font-size: 13px; margin: 12px 0 0; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }

    .linklike { background: none; border: 0; color: #1877f2; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0; font-size: inherit; }

    .legal { position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.6); display: flex; align-items: flex-end; justify-content: center; }
    .legal .sheet { width: 100%; max-width: 520px; max-height: 86vh; overflow-y: auto; background: #ffffff; border-radius: 18px 18px 0 0; padding: 20px 20px 32px; color: #000; }
  `]
})
export class AuthComponent implements OnInit {
  private auth = inject(AuthService);
  private data = inject(DataService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtl = inject(ToastController, { optional: true });

  protected readonly support = SUPPORT_EMAIL;
  protected readonly supportName = SUPPORT_NAME;
  protected readonly provinces = PROVINCES;
  private readonly taken = signal<string[]>([]);

  mode = signal<Mode>('welcome');
  signupStep = signal<number>(1);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  legal = signal<string | null>(null);
  over18 = false;
  terms = false;
  saveLoginInfo = true;
  showPass = signal(false);
  private next = '/home';

  touched = { name: false, email: false, password: false, surname: false, province: false, over18: false, terms: false, otp: false };

  f = {
    displayName: '', email: '', password: '', newPassword: '', confirmPassword: '', surname: '', otp: '',
    province: null as ProvinceCode | null, town: ''
  };

  /** Name of a Google account waiting to finish signing up. */
  readonly pendingName = computed(() => this.auth.pendingProvider()?.displayName ?? '');

  nameParts() {
    return parseFullName(this.f.displayName);
  }

  nameOk(): boolean {
    return this.nameParts() !== null;
  }

  usernamePreview(): string {
    return this.auth.previewHandle(this.f.displayName, this.taken());
  }

  onFullName(value: string): void {
    this.f.displayName = value;
  }

  ngOnInit(): void {
    const requestedNext = this.route.snapshot.queryParamMap.get('next') ?? '/home';
    this.next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/home';
    const requestedMode = this.route.snapshot.queryParamMap.get('mode');
    if (requestedMode === 'signup' || requestedMode === 'signin' || requestedMode === 'forgot' || requestedMode === 'newpass') {
      this.mode.set(requestedMode);
    }
    void this.afterRestore();
  }

  private async afterRestore(): Promise<void> {
    for (let i = 0; i < 50 && !this.auth.ready(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    if (this.mode() === 'newpass' || this.auth.passwordRecovery()) {
      this.mode.set('newpass');
      return;
    }
    if (this.auth.signedIn()) {
      await this.afterAuth();
      return;
    }
    if (this.mode() === 'signup') {
      await this.loadHandles();
    }
    const pending = this.auth.pendingProvider();
    if (pending) {
      this.f.email = pending.email;
      this.f.displayName = pending.displayName;
      this.mode.set('signup');
      this.signupStep.set(1);
      return;
    }
  }

  emailOk(): boolean {
    return EMAIL_RE.test(this.f.email.trim());
  }

  startSignup(): void {
    this.error.set('');
    this.notice.set('');
    this.signupStep.set(1);
    this.mode.set('signup');
    void this.loadHandles();
  }

  nextStep(): void {
    this.error.set('');
    const step = this.signupStep();
    if (step === 1) {
      if (!this.nameOk()) {
        this.touched.name = true;
        this.error.set('Enter your first name and surname.');
        return;
      }
      this.signupStep.set(2);
      return;
    }
    if (step === 2) {
      // If user came from Google provider, skip password step (step 3)!
      if (this.pendingName()) {
        this.signupStep.set(4);
      } else {
        this.signupStep.set(3);
      }
      return;
    }
    if (step === 3) {
      if (this.f.password.length < 8) {
        this.touched.password = true;
        this.error.set('Password must be at least 8 characters.');
        return;
      }
      this.signupStep.set(4);
      return;
    }
    if (step === 4) {
      if (!this.emailOk()) {
        this.touched.email = true;
        this.error.set('Enter a valid email address.');
        return;
      }
      this.signupStep.set(5);
      return;
    }
  }

  prevStep(): void {
    const step = this.signupStep();
    if (step === 1) {
      this.mode.set('welcome');
      return;
    }
    if (step === 4 && this.pendingName()) {
      this.signupStep.set(2);
      return;
    }
    this.signupStep.set(step - 1);
  }

  private async loadHandles(): Promise<void> {
    this.taken.set(await this.data.allHandles());
  }

  openTerms(): void { this.legal.set('Terms and Conditions'); }
  openPrivacy(): void { this.legal.set('Privacy Policy'); }

  async signup(): Promise<void> {
    this.error.set('');
    if (!this.f.province) {
      this.error.set('Please select your province.');
      return;
    }
    if (!this.over18) {
      this.error.set('You must be 18 or older to use LulaFind.');
      return;
    }
    if (!this.terms) {
      this.error.set('Please accept the Terms & Privacy Policy.');
      return;
    }

    this.busy.set(true);
    try {
      const payload = {
        displayName: this.f.displayName,
        email: this.f.email,
        password: this.f.password || 'provider-login',
        surname: '',
        province: this.f.province,
        town: this.f.town,
        provider: this.auth.pendingProvider()?.provider ?? null,
        over18: this.over18,
        acceptedTerms: this.terms,
        otpVerified: true
      };
      if (this.auth.pendingProvider()) await this.auth.finishProviderSignUp(payload);
      else await this.auth.signUp(payload);
      await this.afterAuth();
    } catch (e: any) {
      const message = String(e?.message ?? 'Could not create the account');
      if (message === 'EMAIL_CONFIRMATION_REQUIRED') {
        this.notice.set('Check your email and follow the confirmation link to finish creating your account.');
        this.mode.set('signin');
      } else {
        this.error.set(message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async signin(): Promise<void> {
    this.error.set('');
    if (!this.f.email.trim()) {
      this.touched.email = true;
      this.error.set('Enter your email address.');
      return;
    }
    if (!this.f.password) {
      this.touched.password = true;
      this.error.set('Enter your password.');
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.signIn(this.f.email, this.f.password);
      await this.afterAuth();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not log in');
    } finally {
      this.busy.set(false);
    }
  }

  async provider(p: AuthProvider): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.signInWithProvider(p);
      await this.afterAuth();
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg === 'OAUTH_REDIRECT' || msg === 'GOOGLE_REDIRECT') return;
      if (msg === 'GOOGLE_CANCELED') return; // the person closed the Google window - not an error
      if (msg === 'NEW_ACCOUNT') {
        const pending = this.auth.pendingProvider();
        if (pending) {
          this.f.email = pending.email;
          this.f.displayName = pending.displayName;
        }
        this.mode.set('signup');
        this.signupStep.set(1);
        return;
      }
      this.error.set(msg || 'That sign-in did not complete.');
    } finally {
      this.busy.set(false);
    }
  }

  async forgot(): Promise<void> {
    this.error.set('');
    this.notice.set('');
    if (!this.emailOk()) { this.error.set('Enter the email on the account.'); return; }
    this.busy.set(true);
    try {
      const result = await this.auth.sendPasswordReset(this.f.email);
      if (result === 'preview') {
        this.notice.set('Offline preview: email delivery is not configured, so you can set a new password now.');
        this.f.newPassword = '';
        this.f.confirmPassword = '';
        this.mode.set('newpass');
      } else {
        this.notice.set('If an account exists for that email, a password reset link has been sent. Check your inbox.');
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not send a reset link.');
    } finally {
      this.busy.set(false);
    }
  }

  async saveNewPassword(): Promise<void> {
    this.error.set('');
    if (this.f.newPassword.length < 8) { this.error.set('Use at least 8 characters for your new password.'); return; }
    if (this.f.newPassword !== this.f.confirmPassword) { this.error.set('The passwords do not match.'); return; }
    this.busy.set(true);
    try {
      const profile = await this.auth.completePasswordReset(this.f.newPassword);
      this.f.newPassword = '';
      this.f.confirmPassword = '';
      this.auth.passwordRecovery.set(false);
      if (!profile) {
        this.mode.set('signin');
        this.notice.set('Password changed. Sign in with your new password.');
        return;
      }
      await this.afterAuth();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not update your password. Request a new reset link.');
    } finally {
      this.busy.set(false);
    }
  }

  browse(): void {
    this.auth.setGuestBrowsing(true);
    void this.router.navigate(['/home']);
  }

  private async afterAuth(): Promise<void> {
    this.auth.setGuestBrowsing(false);
    this.auth.passwordRecovery.set(false);
    await this.data.refresh();
    await this.router.navigateByUrl(this.next);
  }
}
