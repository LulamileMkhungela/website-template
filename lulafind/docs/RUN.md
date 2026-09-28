# Running LulaFind locally

Last updated: 26 September 2026.

This guide covers four environments: browser preview in VS Code, Android emulator or device via Android Studio, iPhone simulator or device via Xcode, and a production build check. Read it top to bottom the first time. After that, the one-line quick reference at the top of each section is enough.

---

## Prerequisites

Install these before opening any IDE.

| Tool | Minimum version | Where to get it |
|------|----------------|-----------------|
| **Node.js** | 22.14.0 (22.23.3 recommended) | https://nodejs.org — use the LTS installer |
| **npm** | Ships with Node 22 | — |
| **Git** | Any recent version | https://git-scm.com |
| **VS Code** | 1.90 or newer | https://code.visualstudio.com |
| **Android Studio** | Ladybug (2024.2) or newer | https://developer.android.com/studio |
| **Xcode** | 16 or newer (macOS only) | Mac App Store |
| **JDK** | 21 (use Android Studio's embedded JDK) | Bundled with Android Studio |

Check Node before anything else. Angular 22 will not start below 22.14.0:

```bash
node -v   # must print v22.14.0 or higher
npm -v    # any v10+
```

If `node -v` prints v20 or lower, install Node 22 and open a new terminal window before continuing.

---

## 1  VS Code — browser preview

**Quick start** (after the first-time setup below):

```bash
cd lulafind
npm start
# open http://localhost:4200
```

### First-time setup

1. **Open the `lulafind` folder** in VS Code — not the repo root, not a parent folder.  
   File → Open Folder → select `…/LulaFind/lulafind`.

2. Open the integrated terminal (`` Ctrl+` `` / `` Cmd+` ``).  
   The prompt must end in `lulafind`. If it says `LulaFind`, type `cd lulafind`.

3. Install dependencies:

```bash
npm install
```

   This takes 30–60 s on first run. It installs Angular, Ionic, Capacitor, and Supabase.

4. Start the dev server:

```bash
npm start
```

   Wait for the line:

   ```
   Application bundle generation complete.
   ```

5. Open **http://localhost:4200** in Chrome or Safari.

6. Create an account with an email address and a password. No phone number. Google sign-in also works if the Supabase Google provider is enabled (see `docs/SETUP.md`).

### What works in the browser

| ✅ Works | ❌ Does not work in-browser |
|---------|--------------------------|
| All screens and navigation | Camera (file picker used instead) |
| Create / read / update posts and Spotlights | Push notifications |
| Sign-up, sign-in, password reset | Native share sheet (clipboard fallback used) |
| 24-hour stories | Haptic feedback |
| Follow, unfollow, private chat | Status bar colour |
| Report, save, hide posts | Capacitor plugins that need a native runtime |
| Real-time feed updates via Supabase | |

### Recommended VS Code extensions

- **Angular Language Service** (`angular.ng-template`) — template intellisense
- **ESLint** (`dbaeumer.vscode-eslint`) — inline lint errors
- **Prettier** (`esbenp.prettier-vscode`) — auto-format on save

### Stop and restart

Stop the dev server with **Ctrl+C** in the terminal. Restart with `npm start`. You do not need to re-run `npm install` unless `package.json` changed.

---

## 2  One-time backend switches (Supabase)

The app runs on its own without touching these. Saving a new account, post, follow, or Spotlight to the live database requires them.

1. Go to **https://supabase.com/dashboard** → your project → **Authentication → Providers → Email**.
   - ✅ **Enable email provider**: ON
   - ✅ **Confirm email**: ON. New accounts finish setup from the confirmation link, which returns to `/auth`.
   - Configure the SMTP/email sender for the project so confirmation and password-recovery messages are delivered.

2. Go to **Authentication → URL Configuration → Redirect URLs**. Add each of these lines:

   ```
   http://localhost:4200/auth
   http://localhost:4200/**
   https://localhost/auth
   https://localhost/**
   capacitor://localhost/auth
   https://lulafind.co.za/auth
   https://lulafind.co.za/**
   https://**.e2b.app/**
   ```

   Add the exact Arena preview origin as well if your Supabase project rejects wildcard preview URLs. In **Authentication → Providers → Google**, enable Google and add the Supabase callback URL shown on that page to the Google OAuth client's authorised redirect URIs. Google opens its own account-consent screen, then returns to LulaFind at `/auth`; it does not send the user to Gmail.

3. The base `records` table SQL has already been run. Do not rerun the old `editor.sql` or the historical `wire-fix.sql`; their broad update/read policies have been removed from the current scripts. Run `supabase/story-privacy.sql` on the existing project to migrate embedded story replies/viewers, scrub those projections from story rows, and replace the known RLS policies. It is safe to re-run if the SQL editor reports an interrupted migration.

The publishable (anon) key is already in `src/environments/environment.ts`. Do not put the service-role secret, the database password, or any Firebase Admin key in the app source.

---

## 3  Android Studio

### What you need

- Android Studio **Ladybug (2024.2)** or newer
- Android SDK **Platform 36** (API 36)
- Android SDK Build-Tools (any version in the list)
- Android SDK Platform-Tools
- JDK 21 — use Android Studio's **embedded JDK** (File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK → `JAVA_HOME` or `Embedded JDK`)

### First-time setup

From the `lulafind` folder in a terminal that has **Node 22**:

```bash
node -v              # must be v22+
npm install
npm run build        # builds www/ — must finish with no errors
npm run setup:native # sets API 36, adds permissions, writes privacy manifest
npx cap sync android # copies www/ into the Android project
```

`npm run build` must succeed before `cap sync`. If the build fails, fix the errors first. `cap sync` with a broken `www/` puts broken JS onto the device.

### Open in Android Studio

1. Android Studio → **File → Open**
2. Select the `android` folder **inside** `lulafind` (not the repo root).
3. Wait for **Gradle sync** to complete. This downloads Android libraries on first run — you need an internet connection and it can take 5–10 minutes.
4. If Gradle offers to install SDK 36, click **OK**.
5. If it asks for a JDK, point it at Android Studio's embedded JDK 21.

### Create an emulator

1. **Device Manager** (right-hand panel or Tools → Device Manager) → **Create Device**
2. Choose a **Pixel 8** (or any Pixel with the Play Store icon)
3. System image: select **API 36** (Vanilla Ice Cream). Click **Download** if it is greyed out.
4. Finish and **Close**.

### Run

1. Select the emulator in the device dropdown at the top of Android Studio.
2. Press the green **Run** button (▶).

The first launch compiles the Gradle project and takes 3–5 minutes. Subsequent runs are faster.

### Run on a real Android phone

1. On the phone: **Settings → About phone** → tap **Build number** seven times to enable Developer options.
2. **Settings → Developer options** → enable **USB debugging**.
3. Connect the phone with a USB cable. Accept the **Allow USB debugging** prompt on the phone.
4. The phone appears in the device dropdown. Select it and press Run.

### After you change the app

Any TypeScript or template change must be rebuilt and synced before it appears on the device:

```bash
npm run build
npx cap sync android
```

Then press Run in Android Studio (you do not need to recreate the project).

### Install SDK components if Gradle fails

Android Studio → **SDK Manager** (Tools → SDK Manager) → **SDK Platforms** tab:
- ✅ Android 16.0 (API 36)

**SDK Tools** tab:
- ✅ Android SDK Build-Tools
- ✅ Android SDK Platform-Tools
- ✅ Android Emulator

Click **Apply**.

### Key file locations (Android)

| File | Purpose |
|------|---------|
| `android/app/build.gradle` | `compileSdkVersion`, `targetSdkVersion`, `minSdkVersion` (set by `setup:native`) |
| `android/app/google-services.json` | Firebase project for push notifications |
| `android/app/src/main/AndroidManifest.xml` | Permissions: internet, camera, location, notifications |
| `android/variables.gradle` | SDK version variables shared across modules |

---

## 4  Xcode (macOS only)

Xcode only runs on a Mac. There is no `.xcworkspace` and no `pod install` — Capacitor 8 uses Swift Package Manager exclusively.

### What you need

- **Xcode 16** or newer (Mac App Store)
- An **Apple ID** (free tier is enough for the simulator; a paid Apple Developer account is required for a real iPhone)
- Simulator runtime: download from **Xcode → Settings → Platforms** if missing

### First-time setup

From the `lulafind` folder in a terminal with **Node 22** on the Mac:

```bash
node -v
npm install
npm run build
npm run setup:native
npx cap sync ios
```

### Open in Xcode

1. Open `ios/App/App.xcodeproj`.  
   Double-click the file in Finder, or Xcode → **File → Open** → select it.  
   **Do not** open `App.xcworkspace` — it does not exist for a CocoaPods-free project.

2. Wait for **Swift Package Manager** to resolve packages. On first open Xcode downloads Capacitor. If it stalls: **File → Packages → Resolve Package Versions**.

3. In the project navigator select the **App** target.

4. **Signing & Capabilities** → **Team**:
   - Simulator: your personal Apple ID is enough (free).
   - Real iPhone: requires a free or paid Apple Developer account. Create one at https://developer.apple.com.

5. The **Bundle Identifier** must stay `com.lulafind.app`. Do not change it.

### Run on the simulator

1. Select an **iPhone 16** simulator in the scheme menu (top bar).
2. Press **Run** (⌘R).

If no simulator appears in the list: Xcode → **Settings → Platforms** → download an iOS 18 runtime.

### Run on a real iPhone

1. Connect the iPhone with a USB cable.
2. Select it in the scheme menu.
3. Press Run.
4. On the iPhone: **Settings → General → VPN & Device Management** → tap your developer certificate → **Trust**.
5. Press Run again if it stopped at the trust step.

### After you change the app

```bash
npm run build
npx cap sync ios
```

Then press Run in Xcode.

### Key file locations (iOS)

| File | Purpose |
|------|---------|
| `ios/App/App/Info.plist` | Privacy usage descriptions for camera, location, photos |
| `ios/App/App/PrivacyInfo.xcprivacy` | Apple privacy manifest (no tracking declared) |
| `ios/App/App/AppDelegate.swift` | App entry point — do not modify |

---

## 5  Production build check

Run this before committing a release:

```bash
npm run build
```

Output goes to `www/`. The build must finish with:

```
Application bundle generation complete.
```

and **zero errors**. Warnings about unused exports or bundle size are acceptable. Any `ERROR` line is a blocking issue.

To preview the production bundle locally:

```bash
npm run preview
# open http://localhost:4000
```

`npm run preview` uses `server.mjs` — a plain static file server for the `www/` folder. It does not have hot-reload.

---

## 6  Tests

```bash
npm test
```

75 unit tests run with Vitest. A passing test suite is not a guarantee that the app works on a phone — it proves the data layer, services, and component rendering are correct.

---

## 7  Troubleshooting

### `ng` is not recognised / Angular CLI version mismatch

```bash
node -v   # fix this first if it is below v22.14.0
npm install
npx ng version
```

### `cap sync` copies nothing / www/ is empty

Run `npm run build` first. `cap sync` copies whatever is in `www/` — if the build failed, sync is useless.

### Gradle sync fails with "SDK not found"

Open Android Studio's SDK Manager and install Android SDK Platform 36 and Build-Tools.

### Swift Package resolution stalls in Xcode

File → Packages → Resolve Package Versions. If it still stalls, close Xcode, delete `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`, and reopen.

### App opens but the feed is empty

The Supabase `records` table exists but has no rows yet. Create an account and post something — there is no pre-loaded sample data in the live database.

### Google sign-in returns an error after redirect

The redirect URL is missing from Supabase → Authentication → URL Configuration. Add `http://localhost:4200/**` for local testing, and `https://lulafind.co.za/**` for production.

### Push notifications do not arrive

FCM requires a real device (not an emulator) and the `google-services.json` in `android/app/` must match your Firebase project. APNs on iOS requires a paid Apple Developer account and a valid push certificate. Both are out of scope for local development.

---

## 8  What a local run does not prove

- That an email arrived in an inbox (the Firebase template page exists; delivery was not watched)
- That push notifications fire on a device (FCM/APNs setup required)
- That the app passes Play Store or App Store review (store build requires signed keystores and a real privacy policy URL)
- That all Supabase RLS policies are correct (test on the live project with a real account)
