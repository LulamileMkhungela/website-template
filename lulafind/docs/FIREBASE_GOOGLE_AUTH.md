# Google sign-in: Firebase → Supabase (`signInWithIdToken`)

How LulaFind signs people in with Google, what is already wired in code, and
the exact steps that still need the Firebase/Supabase consoles.

## The flow (and what it deliberately avoids)

```
Google sign-in (Firebase Authentication Capacitor plugin)
  ├─ web:   Firebase JS SDK popup
  ├─ Android: native Google Sign-In (Firebase)
  └─ iOS:     native Google Sign-In (Firebase)
        │
        │  Google ID token (issued by Firebase)
        ▼
supabase.auth.signInWithIdToken({ provider: 'google', token })   ← the bridge
        │
        ▼
Supabase session → existing tables, storage, RLS keep working
```

- **Firebase is only the front door.** It performs the Google sign-in and
  issues the Google ID token. No LulaFind data lives in Firebase.
- **Supabase only verifies that token** (`signInWithIdToken`) to mint the same
  kind of session email/password members get. **Supabase's Google OAuth
  redirect is not used** for Google anymore.
- Email/password sign-in/sign-up/reset keeps running on Supabase exactly as
  before (`AuthService.signIn`, `signUp`, `sendPasswordReset`).
- Apple keeps the existing Supabase OAuth redirect path.

## Code map

| Piece | File |
| --- | --- |
| Shared Firebase web-app init (web only; native skips it) | `src/app/core/firebase/firebase-app.ts` |
| Plugin wrapper service (returns the Google ID token) | `src/app/core/services/google-auth.service.ts` |
| ID-token bridge to Supabase | `src/app/core/data/supabase-auth-bridge.ts` |
| Auth service (Google path + preserved email/password) | `src/app/core/services/auth.service.ts` |
| Plugin dependency + native wiring | `package.json`, `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`, `ios/App/CapApp-SPM/Package.swift` (from `npx cap sync`) |
| iOS URL scheme + `GIDClientID` | `ios/App/App/Info.plist` (values from `GoogleService-Info.plist`) |
| Android google-services wiring | `android/app/build.gradle` applies the `google-services` plugin when `android/app/google-services.json` exists |

Tests: `src/app/core/services/google-auth.service.spec.ts`,
`src/app/core/services/google-signin-flow.spec.ts`,
`src/app/core/data/supabase-auth-bridge.spec.ts`,
`src/app/core/firebase/firebase-app.spec.ts`.

## Still required — needs the Firebase console

### 1. Firebase Web app ID (both environment files)

`src/environments/environment.ts` **and** `environment.prod.ts` have:

```ts
firebase: {
  apiKey: '…', authDomain: 'lulafinds-app.firebaseapp.com',
  projectId: 'lulafinds-app', storageBucket: '', messagingSenderId: '359295927708',
  appId: '',   // ← blank
}
```

Get the real value — do not invent one:

1. Firebase console → ⚙️ **Project settings → General → Your apps**.
2. Under **SDK setup and configuration** on the **Web app** (choose/create the
   web app — a Firebase project can host several apps), copy **`appId`**
   (looks like `1:359295927708:web:abcdef123456`).
3. Paste it into **both** environment files. (If the web app does not exist
   yet, create it; its config should match the values already here.)

### 2. Android: OAuth client for native sign-in

`android/app/google-services.json` (kept **local only, git-ignored**) currently
has **no Android OAuth client** (`client_type: 1`), so native Google Sign-In
would fail with `DEVELOPER_ERROR` until fingerprints are registered:

1. Print your fingerprints:
   - debug: `cd lulafind/android && ./gradlew signingReport`
     (or `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`)
   - release/Play: use your upload key, **plus** the **Play App Signing**
     certificate from Play Console → Release → Setup → App signing.
2. Firebase console → Project settings → **Your apps → the Android app**
   (`com.lulafind.app`) → **Add fingerprint** for each SHA-1 **and** SHA-256
   (debug, release/upload, and Play App Signing).
3. Download the refreshed **`google-services.json`** and replace
   `lulafind/android/app/google-services.json`. It should now contain a
   `client_type: 1` OAuth client for `com.lulafind.app`.
4. `npx cap sync android`, then build (`cd android && ./gradlew assembleDebug`).
   *(Not yet verified in this environment — no JDK/Xcode here.)*

### 3. Supabase: accept Firebase's Google tokens

1. Supabase dashboard → **Authentication → Providers → Google** → enable.
2. In **Authorized Client IDs**, add the Firebase project's **Web** OAuth
   client ID — the `aud` Firebase puts in the token:
   `359295927708-tg8gmcpu2k1nndksmro7b17eiffa6a55.apps.googleusercontent.com`
   (visible as `client_type: 3` in `google-services.json`). Without this,
   `signInWithIdToken` is rejected; the app surfaces the fix in its error.

### 4. iOS: device test

`GoogleService-Info.plist` is in place and `Info.plist` carries the matching
reversed-client-ID URL scheme and `GIDClientID`. Remaining: open
`ios/App/App.xcodeproj` in Xcode, run on a device/simulator with a Google
account, and confirm the native Google sheet opens and returns. *(Needs
Xcode — not verifiable in this environment.)*

### 5. Web: authorized domains

For the popup path, add any non-localhost domain the web build runs on to
Firebase console → Authentication → Settings → **Authorized domains**.

## ⚠️ Security incident: service-account key is exposed

`uploads/lulafinds-app-firebase-adminsdk-fbsvc-cb7ffa9ade.json` in the public
`LulamileMkhungela/LulaFind` repository **is a Firebase Admin service-account
key, committed and public**. It grants full admin access to the Firebase
project (read/write all data, bypass security rules). It was deliberately
**not** copied into this repo and is git-ignored here
(`*firebase-adminsdk*`, `*service-account*`).

Act on it now:

1. Google Cloud Console → IAM & Admin → **Service Accounts**
   (project `lulafinds-app`) → find the `firebase-adminsdk-fbsvc-…` account.
2. Delete the exposed key (**Keys** tab → delete), or disable the whole
   service account if nothing uses it.
3. If a replacement is needed, generate a **new** key and never commit it
   (it lives outside git; keep it in a secret manager).
4. Consider purging git history (e.g. BFG) or making the repo private —
   rotation is the real fix; history rewrites are cleanup.

## Verify everything end-to-end

```bash
cd lulafind
npm install
npm test                 # vitest suite (includes the Google bridge flow)
npm run build            # production web build → www/
npx cap sync android && npx cap sync ios
```

Then on a device: tap **Continue with Google** → native Google sheet → the
app signs in and existing posts/chats (Supabase RLS) appear.
