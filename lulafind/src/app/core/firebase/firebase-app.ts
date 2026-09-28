import { Capacitor } from '@capacitor/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, browserPopupRedirectResolver, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { environment } from '../../../environments/environment';

/**
 * Shared Firebase web-app initialization for LulaFind.
 *
 * Firebase is the front door for Google sign-in only — it is not the
 * database. The same web-app config drives all platforms:
 *
 * - Web: an `Auth` instance is created here with the popup resolver so the
 *   `@capacitor-firebase/authentication` web fallback (which calls
 *   `getAuth()` internally) finds a ready instance.
 * - Android/iOS: no JS `Auth` is created. The plugin owns authentication on
 *   the native Firebase SDKs (`skipNativeAuth: false`, its default).
 *
 * The config lives in `src/environments/environment.ts` and
 * `src/environments/environment.prod.ts`. The `appId` there must be the real
 * Firebase **Web app** ID from Firebase console → Project settings →
 * General → Your apps — never an invented value.
 */

export const firebaseWebConfig: Record<string, string> = ((environment as { firebase?: Record<string, string> }).firebase ?? {});

/** Keys that must be filled before any Firebase call can work. */
const REQUIRED_WEB_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

/** Returns the config keys that are still blank, e.g. `['appId']`. */
export function missingFirebaseWebConfigKeys(config: Record<string, string> = firebaseWebConfig): string[] {
  return REQUIRED_WEB_CONFIG_KEYS.filter((key) => !String(config?.[key] ?? '').trim());
}

let app: FirebaseApp | null = null;

/** The single Firebase web app instance (created lazily, reused after). */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp({ ...firebaseWebConfig });
  }
  return app;
}

let webAuth: Auth | null = null;

/**
 * The Firebase JS `Auth` instance for web. Returns `null` on native platforms
 * where the Capacitor plugin talks to the native Firebase SDKs instead.
 */
export function getFirebaseWebAuth(): Auth | null {
  if (Capacitor.isNativePlatform()) return null;
  if (!webAuth) {
    webAuth = initializeAuth(getFirebaseApp(), {
      persistence: indexedDBLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver
    });
  }
  return webAuth;
}

/**
 * Called once at bootstrap. Never throws: a blank or partial config must not
 * break app start-up — the app runs, and Google sign-in explains what is
 * missing when it is used.
 */
export function initFirebaseWeb(): void {
  try {
    const missing = missingFirebaseWebConfigKeys();
    if (missing.length) {
      console.warn(
        `[LulaFind] Firebase web config is incomplete, Google sign-in stays disabled until it is filled in. Missing: ${missing.join(', ')}. ` +
        'Get the values (including the real Web app ID) from Firebase console → Project settings → General → Your apps.'
      );
      return;
    }
    getFirebaseApp();
    getFirebaseWebAuth();
  } catch (e) {
    console.warn('[LulaFind] Firebase could not be initialised:', e);
  }
}
