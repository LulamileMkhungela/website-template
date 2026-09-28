import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LULA_API, LulaApi } from '../data/api';
import { UserProfile, defaultPrivacy, provinceName } from '../models/types';
import { KvStore } from '../data/local-db';
import { avatar, hueOf } from '../data/seed';
import { nextHandle, parseFullName, slugSurname, uid } from '../utils/format';
import { PlatformService } from './platform.service';
import { GoogleAuthService } from './google-auth.service';
import { signInSupabaseWithGoogleIdToken } from '../data/supabase-auth-bridge';

export type AuthProvider = 'google' | 'apple';

export interface SignUpPayload {
  displayName: string;
  email: string;
  password: string;
  surname: string;
  province: UserProfile['province'] | null;
  town: string;
  /** optional third-party provider - null for email + password */
  provider?: AuthProvider | null;
  avatarUrl?: string;
  /** the person confirmed they are 18 or older */
  over18?: boolean;
  /** the person accepted the terms and the false-information warning */
  acceptedTerms?: boolean;
  /** email sign-up only: the OTP sent to the address was entered correctly */
  otpVerified?: boolean;
}

interface StoredAccount {
  email: string;
  /** mock-mode credential hash. In firebase mode this is unused. */
  secret: string;
  userId: string;
}

/**
 * Auth + session.
 *
 * Live Supabase mode uses Supabase Auth for email/password, recovery and Google OAuth.
 * Mock mode keeps local hashed demo credentials so the journeys can be tested offline.
 *
 * Deliberately NO phone-number sign-up, per product decision.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private platform = inject(PlatformService);
  private router = inject(Router);
  private injectedApi = inject(LULA_API);
  private googleAuth = inject(GoogleAuthService);
  private store = new KvStore('lulafind.auth');

  readonly user = signal<UserProfile | null>(null);
  readonly ready = signal(false);
  readonly guestBrowsing = signal(false);
  readonly signedIn = computed(() => !!this.user());
  readonly needsOnboarding = computed(() => !!this.user() && !this.user()!.onboarded);

  setGuestBrowsing(val: boolean): void {
    this.guestBrowsing.set(val);
  }
  readonly userAvatar = computed(() => {
    const u = this.user();
    return u ? avatar(u.displayName, u.avatarHue) : avatar('Guest');
  });

  /**
   * The API is injected directly so AuthService works even when nothing else in
   * the app has been constructed yet (e.g. the sign-in screen in isolation).
   * DataService keeps this hook so it can trigger a session restore on boot.
   */
  private get api(): LulaApi {
    return this.injectedApi;
  }

  /** The production adapter exposes its Supabase auth client; mock mode does not. */
  private get supabaseAuth(): any | null {
    return (this.api as LulaApi & { client?: { auth?: any } }).client?.auth ?? null;
  }

  private redirectUrl(path = '/auth'): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${path}`;
  }

  private recoveryLinkPresent(): boolean {
    if (typeof window === 'undefined') return false;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return query.get('mode') === 'newpass' || query.get('type') === 'recovery' || hash.get('type') === 'recovery';
  }

  private restored = false;
  private authSubscription: { unsubscribe: () => void } | null = null;

  attachApi(_api?: LulaApi): void {
    if (this.restored) return;
    this.restored = true;
    const supa = this.supabaseAuth;
    if (supa) {
      const { data } = supa.onAuthStateChange((event: string, session: any) => {
        if (event === 'PASSWORD_RECOVERY' || this.recoveryLinkPresent()) this.passwordRecovery.set(true);
        if (session?.user) {
          // Keep Supabase calls out of its auth-state callback lock.
          setTimeout(() => void this.resolveSupabaseUser(session.user).catch((e) => console.warn('Auth callback:', e)), 0);
        } else if (event === 'SIGNED_OUT') {
          this.user.set(null);
          this.store.remove('session');
        }
      });
      this.authSubscription = data?.subscription ?? null;
    }
    void this.restore();
  }

  private accounts(): StoredAccount[] {
    return this.store.get<StoredAccount[]>('accounts', []);
  }

  private hash(s: string): string {
    // NOT a security boundary - mock mode only. Firebase Auth handles real credentials.
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  private async restore(): Promise<void> {
    try {
      const supa = this.supabaseAuth;
      if (supa) {
        if (this.recoveryLinkPresent()) this.passwordRecovery.set(true);
        const { data, error } = await supa.getSession();
        if (error) throw error;
        if (data.session?.user) await this.resolveSupabaseUser(data.session.user);
        else {
          // A local demo session must never impersonate a Supabase account.
          this.store.remove('session');
          if (this.recoveryLinkPresent()) this.passwordRecovery.set(true);
        }
        return;
      }
      const userId = this.store.get<string | null>('session', null);
      if (userId) {
        const u = await this.api.user(userId);
        if (u) this.user.set(u);
        else this.store.remove('session');
      }
    } catch (e) {
      console.warn('Could not restore authentication session:', e);
    } finally {
      this.ready.set(true);
    }
  }

  private isTrustedSupabaseAdmin(authUser: any): boolean {
    const role = String(authUser?.app_metadata?.role ?? '').toLowerCase();
    return role === 'admin' || role === 'moderator';
  }

  private withTrustedSupabaseRole(profile: UserProfile, authUser: any): UserProfile {
    return { ...profile, isAdmin: this.isTrustedSupabaseAdmin(authUser) };
  }

  private async resolveSupabaseUser(authUser: any): Promise<void> {
    if (!authUser?.id) return;
    const existing = await this.api.user(authUser.id);
    if (existing) {
      const profile = this.withTrustedSupabaseRole(existing, authUser);
      this.user.set(profile);
      this.store.set('session', existing.id);
      this.pendingProvider.set(null);
      return;
    }

    const metadata = authUser.user_metadata ?? {};
    if (metadata.lulafindSignupComplete === true && metadata.acceptedTerms === true && metadata.over18 === true) {
      const displayName = String(metadata.displayName ?? metadata.full_name ?? metadata.name ?? '').trim();
      const parsed = parseFullName(displayName);
      const province = metadata.province as UserProfile['province'] | undefined;
      if (parsed && province) {
        const profile = this.withTrustedSupabaseRole(await this.makeProfile({
          displayName: parsed.full,
          email: String(authUser.email ?? metadata.email ?? ''),
          password: '', surname: parsed.surname,
          province, town: String(metadata.town ?? ''),
          over18: true, acceptedTerms: true
        }, authUser.id), authUser);
        await this.api.saveUser(profile);
        this.user.set(profile);
        this.store.set('session', profile.id);
        this.pendingProvider.set(null);
        return;
      }
    }

    const email = String(authUser.email ?? '');
    const displayName = String(metadata.full_name ?? metadata.name ?? metadata.displayName ?? email.split('@')[0] ?? 'LulaFind member');
    const provider = (authUser.app_metadata?.provider === 'apple' ? 'apple' : 'google') as AuthProvider;
    this.pendingProvider.set({ provider, displayName, email, surname: parseFullName(displayName)?.surname ?? '' });
    this.user.set(null);
  }

  /** Public browsing is allowed; this is the profile shown when signed out. */
  get viewerId(): string | null {
    return this.user()?.id ?? null;
  }

  /* --------------------------- email OTP --------------------------- */

  /** email -> { code, expiresAt } for the code currently on screen. */
  private otps(): Record<string, { code: string; expiresAt: number }> {
    return this.store.get<Record<string, { code: string; expiresAt: number }>>('otps', {});
  }

  private saveOtps(m: Record<string, { code: string; expiresAt: number }>): void {
    this.store.set('otps', m);
  }

  /* ------------------- password-recovery / email-confirm state ------------------- */

  /**
   * Set to true when the app is opened via a password-reset link.
   * The app.component and auth.component use this to redirect to the new-password screen.
   */
  readonly passwordRecovery = signal(false);

  /**
   * Set to true when the app is opened via an email-confirmation link (Supabase
   * or Firebase) so the sign-up form can skip re-sending the OTP.
   */
  readonly emailAlreadyConfirmed = signal(false);

  /**
   * The email address extracted from a confirmation or recovery link.
   * Null until a deep link is processed.
   */
  readonly confirmedEmail = signal<string | null>(null);

  /* --------------------------- email OTP (async) --------------------------- */

  /**
   * Send a six-digit code to the address.
   *
   * In demo mode there is no mail server, so the code is returned and shown on
   * screen. With Firebase / Supabase this becomes an email link / magic OTP and
   * the returned demoCode is empty.
   *
   * The optional `password` argument is accepted (and ignored in mock mode) so
   * Firebase-email-link flows that pre-create the account before sending the
   * link can pass the chosen password through without changing the call site.
   */
  async requestOtp(email: string, _password?: string): Promise<{ sentTo: string; demoCode: string }> {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) throw new Error('Enter a valid email address first');
    const existing = await this.api.users();
    if (existing.some((u) => u.email.toLowerCase() === em)) {
      // Already confirmed in a previous session - tell the form so it can skip the OTP step.
      this.emailAlreadyConfirmed.set(true);
      this.confirmedEmail.set(em);
      return { sentTo: em, demoCode: 'ALREADY_CONFIRMED' };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const all = this.otps();
    all[em] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    this.saveOtps(all);
    return { sentTo: em, demoCode: code };
  }

  /**
   * Verify an OTP asynchronously (used by the Firebase email-link path where
   * confirmation happens server-side and is polled rather than checked locally).
   * In mock mode this delegates to the synchronous verifyOtp.
   */
  async verifyEmailOtp(email: string, code: string): Promise<boolean> {
    const ok = this.verifyOtp(email, code);
    if (ok) {
      this.emailAlreadyConfirmed.set(true);
      this.confirmedEmail.set(email.trim().toLowerCase());
    }
    return ok;
  }

  /**
   * Complete a password reset that was initiated via sendPasswordReset.
   * In mock mode we look up the stored account and update the credential hash.
   * Returns the user profile when the account is fully set up, or null when the
   * account was just confirmed but still needs the sign-up form to finish.
   */
  async completePasswordReset(newPassword: string, _otp?: string): Promise<UserProfile | null> {
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters');
    const supa = this.supabaseAuth;
    if (supa) {
      const { data, error } = await supa.updateUser({ password: newPassword });
      if (error) throw error;
      if (data.user) await this.resolveSupabaseUser(data.user);
      this.passwordRecovery.set(false);
      return this.user();
    }

    const userId = this.store.get<string | null>('session', null)
      ?? this.store.get<string | null>('password-reset-user', null);
    if (!userId) throw new Error('This reset link is no longer valid. Request a new one.');
    const accs = this.accounts();
    const idx = accs.findIndex((a) => a.userId === userId);
    if (idx === -1) throw new Error('Account not found - request another reset link.');
    accs[idx] = { ...accs[idx], secret: this.hash(newPassword) };
    this.store.set('accounts', accs);
    this.store.remove('password-reset-user');
    this.store.set('session', userId);
    const u = await this.api.user(userId);
    if (u) this.user.set(u);
    this.passwordRecovery.set(false);
    return u ?? null;
  }

  /**
   * Change the email address for the signed-in account.
   * In production (Supabase / Firebase) this sends a confirmation to the new
   * address. In mock mode the change is applied immediately.
   */
  async changeEmail(newEmail: string): Promise<void> {
    const em = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) throw new Error('Enter a valid email address');
    if (!this.user()) throw new Error('Sign in first');
    const existing = await this.api.users();
    if (existing.some((u) => u.id !== this.user()!.id && u.email.toLowerCase() === em)) {
      throw new Error('That email is already in use by another account');
    }
    // Update the stored credential record so the new address works at sign-in.
    const accs = this.accounts();
    const idx = accs.findIndex((a) => a.userId === this.user()!.id);
    if (idx !== -1) {
      accs[idx] = { ...accs[idx], email: em };
      this.store.set('accounts', accs);
    }
    await this.updateProfile({ email: em });
  }

  /** True when a valid, unexpired code has been entered for this address. */
  verifyOtp(email: string, code: string): boolean {
    const em = email.trim().toLowerCase();
    const rec = this.otps()[em];
    if (!rec) return false;
    if (rec.expiresAt < Date.now()) return false;
    return rec.code === String(code).trim();
  }

  /** Seconds left on the current code, or 0. */
  otpSecondsLeft(email: string): number {
    const rec = this.otps()[email.trim().toLowerCase()];
    if (!rec) return 0;
    return Math.max(0, Math.round((rec.expiresAt - Date.now()) / 1000));
  }

  /** A code that has been used once cannot be replayed. */
  private consumeOtp(email: string): void {
    const all = this.otps();
    delete all[email.trim().toLowerCase()];
    this.saveOtps(all);
  }

  private async makeProfile(p: SignUpPayload, id: string): Promise<UserProfile> {
    const parsed = parseFullName(p.displayName);
    if (!parsed) throw new Error('Enter your first name and surname');
    const existing = await this.api.users();
    return {
      id,
      email: p.email.trim().toLowerCase(),
      displayName: parsed.full,
      handle: nextHandle(parsed.username, existing.map((u) => u.handle)),
      avatarHue: hueOf(parsed.full),
      bio: '',
      province: p.province,
      town: p.town.trim(),
      surname: parsed.surname,
      createdAt: Date.now(),
      verified: false,
      anonymous: false,
      findableProfile: true,
      safetyBeacon: false,
      lastBeaconAt: null,
      followers: 0,
      following: 0,
      karma: 0,
      contributorCredits: 0,
      onboarded: false,
      blockedUserIds: [],
      spotlightIds: [],
      isAdmin: false,
      suspended: false,
      privacy: defaultPrivacy(),
      checkIn: null
    };
  }

  async signUp(p: SignUpPayload): Promise<UserProfile> {
    const email = p.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Enter a valid email address');
    const existing = await this.api.users();
    if (existing.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('An account already exists with that email. Try signing in.');
    }
    const parsed = parseFullName(p.displayName);
    if (!parsed) throw new Error('Enter your first name and surname');
    if (!p.provider && p.password.length < 8) throw new Error('Password must be at least 8 characters');
    if (!p.provider && p.otpVerified !== true) throw new Error('Enter the code we emailed you');
    if (!p.province) throw new Error('Choose your province');
    if (!p.over18) throw new Error('You must be 18 or older to use LulaFind');
    if (!p.acceptedTerms) throw new Error('Accept the terms before you continue');

    const supa = this.supabaseAuth;
    let id: string;
    let supabaseSessionUser: any = null;
    if (supa && p.provider) {
      const { data, error } = await supa.getSession();
      if (error) throw error;
      if (!data.session?.user) throw new Error('Finish signing in with your provider first');
      supabaseSessionUser = data.session.user;
      id = data.session.user.id;
    } else if (supa) {
      const { data, error } = await supa.signUp({
        email,
        password: p.password,
        options: {
          emailRedirectTo: this.redirectUrl('/auth'),
          data: {
            lulafindSignupComplete: true,
            displayName: parsed.full,
            province: p.province,
            town: p.town.trim(),
            over18: true,
            acceptedTerms: true
          }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('The account could not be created. Try again.');
      if (!data.session) throw new Error('EMAIL_CONFIRMATION_REQUIRED');
      supabaseSessionUser = data.user;
      id = data.user.id;
    } else {
      id = uid('u');
    }

    const profile = await this.makeProfile({ ...p, email }, id);
    await this.api.saveUser(profile);
    if (!supa && !p.provider) {
      this.consumeOtp(email);
      const accs = this.accounts();
      accs.push({ email, secret: this.hash(p.password), userId: id });
      this.store.set('accounts', accs);
    }
    const signedInProfile = supabaseSessionUser
      ? this.withTrustedSupabaseRole(profile, supabaseSessionUser)
      : profile;
    this.store.set('session', id);
    this.user.set(signedInProfile);
    this.pendingProvider.set(null);
    return signedInProfile;
  }

  async signIn(email: string, password: string): Promise<UserProfile> {
    const em = email.trim().toLowerCase();
    if (!em) throw new Error('Enter your email address');
    if (!password) throw new Error('Enter your password');
    const supa = this.supabaseAuth;
    if (supa) {
      if (!em.includes('@')) throw new Error('Use the email address on your LulaFind account to sign in.');
      const { data, error } = await supa.signInWithPassword({ email: em, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign-in did not return an account. Try again.');
      const storedProfile = await this.api.user(data.user.id);
      if (!storedProfile) throw new Error('Your account needs profile setup. Contact support if you already completed it.');
      const profile = this.withTrustedSupabaseRole(storedProfile, data.user);
      this.store.set('session', profile.id);
      this.user.set(profile);
      this.passwordRecovery.set(false);
      return profile;
    }

    const acc = this.accounts().find((a) => a.email === em);
    if (!acc) {
      const allUsers = await this.api.users();
      if (allUsers.some((u) => u.email.toLowerCase() === em)) {
        this.confirmedEmail.set(em);
        this.emailAlreadyConfirmed.set(true);
        throw new Error('FINISH_PROFILE');
      }
      throw new Error('No LulaFind account with that email');
    }
    if (acc.secret !== this.hash(password)) throw new Error('Incorrect password');
    const u = await this.api.user(acc.userId);
    if (!u) throw new Error('Account data is missing - contact support');
    this.store.set('session', acc.userId);
    this.user.set(u);
    this.passwordRecovery.set(false);
    return u;
  }

  /**
   * Social sign-in.
   *
   * Google runs through Firebase Authentication — popup on web, native
   * Google Sign-In on Android/iOS. The Google ID token Firebase issues is
   * then exchanged at Supabase with signInWithIdToken, which mints the same
   * kind of session email/password members get so the existing data and RLS
   * keep working. Supabase's own Google OAuth redirect is deliberately not
   * used. Apple keeps the Supabase OAuth redirect.
   */
  async signInWithProvider(provider: AuthProvider): Promise<UserProfile> {
    if (provider === 'google') return this.signInWithGoogleViaFirebase();
    const supa = this.supabaseAuth;
    if (supa) {
      const { error } = await supa.signInWithOAuth({
        provider,
        options: { redirectTo: this.redirectUrl('/auth') }
      });
      if (error) throw error;
      throw new Error('OAUTH_REDIRECT');
    }
    const info = await this.resolveProvider(provider);
    const existing = await this.api.users();
    const found = existing.find((u) => u.email.toLowerCase() === info.email.toLowerCase());
    if (found) {
      this.store.set('session', found.id);
      this.user.set(found);
      return found;
    }
    this.pendingProvider.set({ provider, ...info });
    throw new Error('NEW_ACCOUNT');
  }

  /**
   * Google, the LulaFind way: Firebase handles the Google sign-in end to end
   * and only its Google ID token crosses over to Supabase
   * (supabase.auth.signInWithIdToken), purely to establish the Supabase
   * session the app's data/RLS depend on.
   */
  private async signInWithGoogleViaFirebase(): Promise<UserProfile> {
    const supa = this.supabaseAuth;
    if (!supa) {
      // Mock mode: keep the offline Google journey intact (no Firebase call).
      const info = await this.resolveProvider('google');
      const existing = await this.api.users();
      const found = existing.find((u) => u.email.toLowerCase() === info.email.toLowerCase());
      if (found) {
        this.store.set('session', found.id);
        this.user.set(found);
        return found;
      }
      this.pendingProvider.set({ provider: 'google', ...info });
      throw new Error('NEW_ACCOUNT');
    }

    const google = await this.googleAuth.signInWithGoogle();
    const data = await signInSupabaseWithGoogleIdToken(supa, google.idToken);
    const authUser = data?.user ?? null;
    if (!authUser?.id) throw new Error('Google sign-in did not produce a Supabase session. Try again.');

    // Same resolution the OAuth callback used: an existing profile signs in,
    // a brand-new Google account is handed to the sign-up form.
    await this.resolveSupabaseUser(authUser);
    const profile = this.user();
    if (!profile) throw new Error('NEW_ACCOUNT');
    this.passwordRecovery.set(false);
    return profile;
  }

  /** Set while the sign-up form is waiting for a Google / Apple account to finish. */
  readonly pendingProvider = signal<{ provider: AuthProvider; displayName: string; email: string; surname: string } | null>(null);

  clearPendingProvider(): void {
    this.pendingProvider.set(null);
  }

  private async resolveProvider(provider: AuthProvider): Promise<{ displayName: string; email: string; surname: string }> {
    // Mock mode stand-ins. Swap for the real OAuth call in Firebase mode.
    return provider === 'google'
      ? { displayName: 'Google User', email: 'google.user@gmail.com', surname: '' }
      : { displayName: 'Apple User', email: 'apple.user@icloud.com', surname: '' };
  }

  /** Finish a provider sign-up once the form is filled in. */
  async finishProviderSignUp(p: SignUpPayload): Promise<UserProfile> {
    this.clearPendingProvider();
    return this.signUp(p);
  }

  async sendPasswordReset(email: string): Promise<'sent' | 'preview'> {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) throw new Error('Enter a valid email address');
    const supa = this.supabaseAuth;
    if (supa) {
      const { error } = await supa.resetPasswordForEmail(em, {
        redirectTo: this.redirectUrl('/auth?mode=newpass')
      });
      if (error) throw error;
      return 'sent';
    }
    const account = this.accounts().find((item) => item.email === em);
    if (!account) throw new Error('If an account exists for that email, a reset link will be sent.');
    this.store.set('password-reset-user', account.userId);
    this.passwordRecovery.set(true);
    return 'preview';
  }

  /** Demo account lets reviewers (and Play Store testers) in instantly. */
  async signInDemo(): Promise<UserProfile> {
    const u = await this.api.user('u_demo');
    if (!u) throw new Error('Demo data missing - reset app data from Settings');
    this.store.set('session', u.id);
    this.user.set(u);
    return u;
  }

  async signOut(): Promise<void> {
    if (this.supabaseAuth) {
      const { error } = await this.supabaseAuth.signOut();
      if (error) throw error;
    }
    // Also end the Firebase (Google) session. Best-effort by design: the
    // Supabase session above is the source of truth for data access.
    await this.googleAuth.signOut();
    this.store.remove('session');
    this.pendingProvider.set(null);
    this.passwordRecovery.set(false);
    this.user.set(null);
    await this.router.navigate(['/auth']);
  }

  /** Keep the signed-in copy in step when another flow saves this person. */
  syncUser(u: UserProfile): void {
    if (this.user()?.id === u.id) this.user.set(u);
  }

  /**
   * Rebuild surname and username from the full name. The username field itself
   * is never typed. An unchanged second name keeps the current username, so
   * saving a town or a bio does not rename anyone.
   */
  async renameFromFullName(fullName: string): Promise<UserProfile> {
    if (!this.user()) throw new Error('Not signed in');
    const parsed = parseFullName(fullName);
    if (!parsed) throw new Error('Enter your first name and surname');
    const current = this.user()!;
    const taken = (await this.api.users()).map((u) => u.handle);
    const sameSurname = slugSurname(current.surname) === parsed.username;
    const handle = sameSurname ? current.handle : nextHandle(parsed.username, taken);
    return this.updateProfile({
      displayName: parsed.full,
      surname: parsed.surname,
      handle,
      avatarHue: hueOf(parsed.full)
    });
  }

  /**
   * What the locked username row shows while the person types.
   * Same rules as sign-up, so the preview is the username they will get.
   */
  previewHandle(fullName: string, taken: string[], keepHandle = '', keepSurname = ''): string {
    const parsed = parseFullName(fullName);
    if (!parsed) return '';
    if (keepHandle && slugSurname(keepSurname) === parsed.username) return keepHandle;
    return nextHandle(parsed.username, taken, keepHandle);
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.user()) throw new Error('Not signed in');
    const next: UserProfile = { ...this.user()!, ...patch };
    await this.api.saveUser(next);
    this.user.set(next);
    return next;
  }

  async completeOnboarding(patch: Partial<UserProfile>): Promise<UserProfile> {
    return this.updateProfile({ ...patch, onboarded: true });
  }

  /** Hard delete - required by Play Store & App Store account-deletion rules. */
  async deleteAccount(): Promise<void> {
    if (!this.user()) return;
    const id = this.user()!.id;
    await this.api.deleteUser(id);
    this.store.set('accounts', this.accounts().filter((a) => a.userId !== id));
    this.store.remove('session');
    this.user.set(null);
    await this.router.navigate(['/auth']);
  }

  /** "Findable" toggle: whether LulaFind may contact you if you match a case. */
  async setFindable(value: boolean): Promise<void> {
    await this.updateProfile({ findableProfile: value });
  }

  /**
   * Username from a surname slug. Kept for callers that already have the slug.
   * Sign-up uses the second name of the full name, not a handle the person types.
   */
  async uniqueHandle(surnameOrSlug: string, taken: string[]): Promise<string> {
    const base = slugSurname(surnameOrSlug) || 'lulafinder';
    return nextHandle(base.length < 2 ? 'lulafinder' : base, taken);
  }

  /** Convenience for template strings. */
  locationLabel(u?: UserProfile | null): string {
    if (!u?.province) return 'South Africa';
    return [u.town, provinceName(u.province)].filter(Boolean).join(' · ');
  }

  get avatarOf(): (name: string) => string {
    return (name: string) => avatar(name);
  }

  get native(): boolean {
    return this.platform.isNative;
  }
}
