import { Injectable, InjectionToken, inject } from '@angular/core';
import { FirebaseAuthentication, SignInResult, User } from '@capacitor-firebase/authentication';
import { missingFirebaseWebConfigKeys } from '../firebase/firebase-app';

/**
 * The Capacitor plugin behind a token so tests (and future wrappers) can
 * stand it in without module mocking.
 */
export const FIREBASE_AUTH_PLUGIN = new InjectionToken<typeof FirebaseAuthentication>('FIREBASE_AUTH_PLUGIN', {
  providedIn: 'root',
  factory: () => FirebaseAuthentication
});

/** What AuthService needs from a completed Google sign-in: the ID token. */
export interface GoogleIdTokenSignIn {
  /** The Google ID token issued by Firebase — exchanged at Supabase with signInWithIdToken. */
  idToken: string;
  email: string;
  displayName: string;
  /** Firebase uid of the signed-in Google account. */
  providerUserId: string;
}

/**
 * Google sign-in on top of the Firebase Authentication Capacitor plugin.
 *
 * - Web: the plugin drives a Firebase JS SDK popup (the web auth instance
 *   comes from `firebase-app.ts`).
 * - Android/iOS: the plugin calls the native Google Sign-In flow, so there is
 *   no browser redirect anywhere in the journey.
 *
 * The only thing AuthService consumes is the resulting Google ID token, which
 * `supabase-auth-bridge.ts` swaps for a Supabase session. Firebase holds no
 * LulaFind data.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly plugin = inject(FIREBASE_AUTH_PLUGIN);


  /** Runs the Google sign-in and returns the Firebase-issued Google ID token. */
  async signInWithGoogle(): Promise<GoogleIdTokenSignIn> {
    const missing = this.configMissing();
    if (missing.length) {
      throw new Error(
        `Google sign-in is not configured yet (missing Firebase ${missing.join(', ')}). ` +
        'Fill in src/environments/environment.ts from Firebase console → Project settings → General.'
      );
    }

    let result: SignInResult;
    try {
      result = await this.plugin.signInWithGoogle();
    } catch (e) {
      throw this.humanPluginError(e);
    }

    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error('GOOGLE_NO_ID_TOKEN');

    const user = result.user;
    return {
      idToken,
      email: user?.email ?? '',
      displayName: user?.displayName ?? '',
      providerUserId: user?.uid ?? ''
    };
  }

  /** The Firebase-side user, if a Google session is open. */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { user } = await this.plugin.getCurrentUser();
      return user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Ends the Firebase (Google) session. Best-effort on purpose: the Supabase
   * session is the source of truth for data, so sign-out must never fail
   * because Firebase already forgot this device.
   */
  async signOut(): Promise<void> {
    try {
      await this.plugin.signOut();
    } catch {
      /* nothing to sign out of */
    }
  }

  /** The blank-config guard; spied on in tests to simulate a filled-in environment. */
  protected configMissing(): string[] {
    return missingFirebaseWebConfigKeys();
  }

  /** Turns native plugin failures into messages a person can act on. */
  private humanPluginError(e: unknown): Error {
    const raw = e instanceof Error ? e.message : String(e ?? '');
    if (/cancell?ed|dismiss|popup[-_ ]closed|closed[-_ ]by[-_ ]user|popup[-_ ]request/i.test(raw)) return new Error('GOOGLE_CANCELED');
    if (/(^|\s)10(\s|$)|DEVELOPER_ERROR|oauth_client/i.test(raw)) {
      return new Error(
        'Google sign-in is rejected on this device. The app\'s SHA-1/SHA-256 fingerprint is probably not registered on the Firebase Android app yet — see docs/FIREBASE_GOOGLE_AUTH.md.'
      );
    }
    if (/network/i.test(raw)) return new Error('Google sign-in needs a network connection. Check your data or Wi-Fi and try again.');
    return new Error(raw || 'Google sign-in could not start.');
  }
}
