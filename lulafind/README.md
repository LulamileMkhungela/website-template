# LulaFind

**The community search network. Bring them home.**

LulaFind is a South African-first mobile app (Android + iOS from one codebase) for
reporting missing people, for **KhumbulEkhaya** — people who left home and may not
want to come back — and for the community that helps find them. It reads and
behaves like Quora (dense content, upvote-driven ranking, comments) with the
missing-person workflows, consent model and surname communities layered on top.

The checked run steps are in [docs/RUN.md](docs/RUN.md). The live backend check is in [docs/SETUP.md](docs/SETUP.md). If this file disagrees with those two, follow those two. A production web build succeeded on 26 September 2026. Android Studio and Xcode were not launched in that check.

It is a **native app** — Capacitor produces real `.aab` / `.ipa` builds for the
Play Store and App Store. The web build is only there so you can preview it in a
browser before you open Android Studio or Xcode.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | **Ionic 9 + Angular 22** (standalone components, signals, zoneless change detection) | Native-feel mobile components, fastest render path Angular has, one codebase for both stores |
| Native shell | **Capacitor 8** | Real Android + iOS builds, first-class plugin access, targets Android 16 (API 36) as Play now requires |
| Data | **Supabase** `records` table for posts, chat, follows, stories, and profiles | Firebase is only the three account emails. No Firestore. |
| Auth | Google through Firebase (native Google Sign-In, popup on web), whose Google ID token is exchanged at Supabase with `signInWithIdToken`. Email keeps using Supabase. No Supabase OAuth redirect for Google. | Setup: [docs/FIREBASE_GOOGLE_AUTH.md](docs/FIREBASE_GOOGLE_AUTH.md) |
| Tests | **Vitest** | Run `npm test` on Node 22. A passing test is not a phone test. |
| Icons | Inline SVG registry | No icon font, no network request, identical on web/Android/iOS |

Production web bundle: **2.7 MB** total, code-split per route.

---

## Quick start

Node must be 22.22.3 or newer. Full steps for VS Code, Android Studio, and Xcode are in [docs/RUN.md](docs/RUN.md).

```bash
node -v            # must be v22.22.3 or newer
npm install
npm start          # http://localhost:4200
npm run build      # production build into www/
```

There is no demo account and no sample missing person. Create an account with email. No phone number.

---

## Features

### Feed (Quora-style)
- Cards with author, status chips, title, body preview, media grid, counters and
  an action bar: **Idea (upvote) / No idea (downvote) / Comment / Share / Save**
- **"Idea / No idea" replaces karma** — a plain label, no unexplained score. Where
  a number is needed it reads **"help points"**
- **Follow** sits right next to "LulaFind member *username*" on every card and
  profile header, Quora-style
- **Share opens your phone's own share sheet** (WhatsApp, Messages, X, copy link…)
  via `@capacitor/share`, with a browser fallback on web
- The media grid caps at four tiles and shows **"+2"** when there is more
- **Pull to refresh and auto-sync** keep the feed current — `DataService`
  re-pulls on app resume and every 60 s while you are on the feed
- Story rail (24-hour stories, tap-through viewer with progress bars and replies)
- Filter rail: **All · Missing people · Left home · Sightings · Stories**, plus
  **province picker**, sort (recent / most shared / near me / oldest) and status
  (still missing / all / found)
- Pull to refresh, infinite scroll, skeleton loading, hot-score ranking

### Writing a post — fewer steps
One screen, top to bottom, with no wizard:

1. **Choose a category first** (missing / left home / sighting / update / found).
   The fields for that category appear only after you pick one.
2. Province → town → the rest of the form
3. **Photos or a video, never both** — the app says which one to remove

Nothing is pre-selected: province, town and category all start empty. A **Close**
button cancels without losing your place, publishing shows a toast and drops you
straight onto the new post's page, and **you can edit a post afterwards**
(`DataService.updatePost`, shown only where `canEdit()` is true).

### Missing-person case file
Guided composer: description → subject (age, gender, height, build, hair, clothing,
distinguishing marks, medical, languages, vehicle) → last seen where/when + GPS +
case number + reward → photos/video + contact visibility → audience + chat +
anonymous. Cases about under-18s are published as `under_review` for moderator
sign-off (`DataService.create`, `src/app/core/services/data.service.ts:300`).

### KhumbulEkhaya
- "Are they being wanted?" — the community answers **yes / no**, and the counts
  tell the family whether this is a search or a conversation
- **The person in the post can claim it** ("this is me") and answer:
  *I am coming home* · *I am safe, not coming home* · *let us chat first*
- Claiming unlocks private chat with the poster without exposing the claimer publicly

### Private chat with a deliberate gate
Chat opens only when **all three** are true:
1. the poster enabled chat on that post,
2. you **upvoted** the post ("I have an idea"),
3. you **follow each other**.

The UI shows exactly which step is missing, and the poster can turn chat off per post.

### Inside a Spotlight
Every post tagged with that surname, in-community search, member count, admin
roles, and posting scoped to that community when the author chooses it.

### Get help, then a note — not a dispatch
LulaFind does not file a docket and does not message an NGO. **Help** lists numbers
checked against the organisation or a government page: SAPS 10111, ambulance 10177,
GBV Command Centre 0800 428 428, TEARS 0800 083 277 and `*134*7355#`, Childline 116
and 0800 055 555, Missing Children SA 072 647 7464, Pink Ladies WhatsApp
072 214 7439. Pink Drive is a cancer-screening NGO and is not a search partner.
Amber Alerts are issued by SAPS, not by this app. The poster can save a note that
they called. That note is not a police acknowledgement.

### Location, consent-first
- LulaFind **never** reads a person's location without that person's own consent
- A poster can run a **background check**: check whether the subject is registered,
  send a consent request, and see the status. If the subject declines, the app
  returns **nothing at all** — not a hint
- **Safety beacon**: the user themselves enables "I am safe" check-ins to people they choose
- Consent log on every case, with expiry dates, visible in Settings

### Reach & privacy per post
Audience: **everyone / followers only / one Spotlight surname**. Post
**anonymously** (LulaFind and SAPS still know who you are). Contact details can be
hidden to "verified only" or "only me" to blunt scam calls.

### Outcome loop
Once a case has traction the app asks the poster **"Did you get help?"** — answer
yes and the case closes as **FOUND** (or "whereabouts found"), search notifications
stop, and the success is visible to everyone who helped.

### Safety check-in
On your own profile: **"I am safe"** or **"I am in an unfamiliar place"**. The
status shows on your profile to people who follow you.

- **Optional live location share that lasts 1 hour** and stops itself
- When it ends, your followers are told so they can check on you
- You can set yourself **OK / safe** at any time to end it early
- **The status is optional** — never asked for, never required to use the app

### Moderation and admin
- **Anyone can report** a post, comment or **person**; the report lands in a
  review queue
- **Admin** (`Me → Admin`, only for the account owner) sees the queue, can
  **remove a post or comment**, **remove a person** (suspend + hide their
  content), and every action is logged
- Under-18 cases publish as `under_review` for sign-off
- Reports persist in `lulafind.moderation.reports`; **Settings → Reset demo data**
  clears the queue and restores the seeded dataset

### Safety & tips hub
Ten curated, shareable guides (`seedTips()`): there is **no 24-hour waiting
period** in South Africa · the first-72-hours checklist · never approach a
suspected sighting alone · scam calls in the first 24 hours · consent is what makes
location tracking legal · guardian consent for children · KhumbulEkhaya may mean
they do not want to come home · free support lines · what makes a poster work ·
share widely but never a home address.

### Auth — email first, no phone number
A modern sign-in / sign-up screen. **Email is the default.** Google, Apple and the
demo account follow the same flow. There is no phone-number sign-up and no LinkedIn.

- Sign-up asks only: name, surname, email, password, **18 or older**, terms
- The **username is generated for you** from the full name (`nomvula.zondi`), and
  bumped if it is taken (`nomvula.zondi1`) — you can change it later in Edit profile
- **Province and town are never pre-filled.** The user picks them on the next
  screen, and cannot continue without choosing a province
- Every validation point is called out **inline, in plain English**
- The sign-up screen carries the 18+ statement and the notice that **false
  information can lead to arrest**
- The support inbox is one line at the bottom: `mkhungela.l@gmail.com` — Lulamile
  at LulaFind (change it in one place: `src/app/core/config.ts`)

### Snapchat-style onboarding
One question per screen with a progress bar: avatar, alerts, **province (GPS only
suggests — nothing is picked for you)**, privacy, and a plain-language consent
explainer.

### Spotlight — surname communities
Anyone can create a Spotlight for a surname (e.g. **Ndlela**). Creating one
checks the surname **per province** — if `Ndlela / KZN` already exists you get told
so and offered the existing one instead.

- **Joining needs no approval.** One tap and you are a member: you can post,
  comment and see everything
- Browse by an **A–Z dropdown** — "All letters" plus each letter
- The composer's Spotlight dropdown lists **only the Spotlights you belong to**
- A post card shows "Open the Spotlight" **only when that author's surname is
  actually on a Spotlight**

---

## Data layer

`src/app/core/data/api.ts` defines `LulaApi`. Two implementations ship:

- **`MockApi`** (default) — seeded South African dataset + localStorage persistence.
  14 users, 13 cases, 14 comments, 4 Spotlights, 6 stories, 10 tips, an existing
  chat thread and notifications, so every screen has real content on first launch.
- **`FirebaseApi`** — Cloud Firestore + Firebase Auth, imported lazily so the
  bundle stays small until you configure it.

Switch with one line:

```ts
// src/environments/environment.ts
export const environment = {
  dataMode: 'firebase',           // was 'mock'
  firebase: { apiKey: '…', authDomain: '…', projectId: '…', /* … */ }
};
```

Firestore rules and the indexes you need: [`docs/FIRESTORE_RULES.md`](docs/FIRESTORE_RULES.md).

**Everything you need to plug in later is listed in
[`docs/SETUP.md`](docs/SETUP.md)** — Firebase config, Google and Apple client IDs,
push keys, your domain, policy URLs and the store listings. Nothing in that list is
needed to run the app.

---

## Building the mobile apps

Step-by-step for VS Code, Android Studio, and Xcode: [`docs/RUN.md`](docs/RUN.md).

`android/` and `ios/` are already in this repo. Open `android/` in Android Studio, or `ios/App/App.xcodeproj` in Xcode. After `npm install` and `npm run build`, run:

```bash
npm run setup:native    # permissions, API 36, Apple privacy manifest
npx cap sync
```

Then Run inside the IDE. `npx cap add android` or `npx cap add ios` is only needed if that folder is missing. The setup script is safe to run twice.

`node scripts/native-setup.mjs check` reports what is present.

---

## Store compliance notes (checked against current policy)

| Requirement | Status in this project |
| --- | --- |
| **Target Android 16 / API 36** (mandatory for new apps and updates from 31 Aug 2026) | `scripts/native-setup.mjs android` sets `compileSdkVersion = 36`, `targetSdkVersion = 36`, `minSdkVersion = 24` |
| **Data Safety form must match real behaviour** | Only the permissions the app actually uses are declared (internet, coarse+fine location, camera, media read, notifications, vibrate). Location is consent-first and never read in the background silently |
| **Account deletion in-app** | Settings → *Delete my account and data* (type DELETE to confirm) |
| **18+ gating** | Stated on sign-up and again on the composer banner; terms require it |
| **Privacy policy URL** | Placeholder in Settings — replace with your hosted document before submission |
| **iOS privacy manifest** | `native/ios/PrivacyInfo.xcprivacy` is copied into the Xcode app target by `npm run setup:native`. It is already in `ios/App/App/`. Tracking is off. |
| **Guardian consent for minors** | Composer requires authorisation confirmation; under-18 cases enter `under_review` |
| **Camera optional** | `<uses-feature android:name="android.hardware.camera" android:required="false" />` |

---

## Competitor analysis behind the feature set

| Competitor | Their strength | Their gap | What LulaFind does |
| --- | --- | --- | --- |
| **Namola** (700k+ downloads) | Real SOS dispatch, GPS family tracking, Safety Score grid, neighbourhood watch, R0/R29/R59 tiers | Not built for missing-person cases: no case file, no poster, no community voting, no surname communities, paid tiers gate tracking | Free case file + poster + community voting; location is consent-first and case-scoped, not subscription-gated |
| **Missing People: Safety Network** | Missing people + hijacked vehicles + lost pets, sightings, watchlist, live map, AMBER push, human moderation of child cases, support hub | One-way reporting. No conversation layer, no way for the missing person to respond, no community ranking, no surname grouping | Two-way: the person in the post can answer, upvotes unlock private chat, Spotlights group by surname |
| **My SAPS** | Official: anonymous tip-offs, station finder, wanted/missing lists, FCS contacts, Amber Alerts SAPS issues | Official-only, no community case file | LulaFind does not file the docket. It links My SAPS and shows the SAPS 55(A) steps |
| **Facebook/Instagram AMBER Alerts** | Enormous reach, geo-targeted, SAPS-partnered | Children only, rare, no case management, no closure loop, no consent model | LulaFind handles every case type and closes the loop with "did you get help?" |
| **WhatsApp/CPF groups** | Instant, trusted, hyper-local | Unsearchable, no structure, rumours spread, families get five different phone numbers | Structured case file, one contact number, searchable, moderation and reporting built in |
| **Quora** (the UI reference) | Best-in-class content density, upvote ranking, credibility signals | Not a safety tool | Same interaction model, applied to search |
| **MISPER** | Traffic-light search zones, checklists, verified sightings, search parties | UK only, party capped at 9, no social feed, the family must set the search up first | The card says where to look first with no form. UK research is labelled as a guide, not a South African police score. A ground search is optional and not capped at 9 |
| **Life360** | Places, arrival alerts, SOS, crash detection | Location often wrong, crash alerts that do not fire, history and places paywalled, hard to cancel | No fake crash detector. A check-in clears in one tap. The case file is not behind a paywall |
| **GRIT** (was Kwanele) | Panic to 5 contacts, encrypted evidence vault, mapped support, 11 languages. Zuzi chat is not a counsellor | A public social feed would expose a survivor. inFORMed is still in development | Get help is not posted. Leave clears it from Back. A private note stays on the phone. LulaFind does not copy the panic or claim a vault |
| **Missing People: Safety Network** | SA cases for people, vehicles, and pets, plus sightings and a watchlist | Live map, public reward, and it is not the police | No map and no public reward amount. The flyer leaves one mark off so a caller has to know it |
| **PawBoost** | Free lost-pet flyer, local alerts | Paid boost, and alerts that open the wrong animal | The flyer is free. No boost |
| **Tracker, Netstar, Cartrack** | A device in the car, then a recovery team | Useless if the car has no device | The vehicle case says LulaFind cannot track it, and points the owner to their own tracker app |

**Where LulaFind goes further than all of them:** the subject of a post can
answer it; private chat is gated by demonstrated intent (upvote) *and* a mutual
connection; location requires explicit, expiring, auditable consent; a case is
never forwarded to SAPS or an NGO; and surname Spotlights give families a permanent home for their cases.
A tap on "I'm looking" tells that one family, not the whole province. The home
count is open posts in this feed, not a made-up safety score.

---

## Project layout

```
src/
  app/
    core/
      config.ts              # support inbox, support name, base URL - edit these first
      models/types.ts        # the whole domain model
      data/
        local-db.ts          # in-memory + localStorage store, filtering, scoring
        api.ts               # LulaApi contract + MockApi adapter + DI token
        firebase-api.ts      # Firestore implementation (lazy-loaded)
        seed.ts              # seeded dataset + offline SVG imagery
      services/              # auth, data, chat, escalation, location, media,
                             # moderation, platform, safety, settings
      theme/                 # design tokens, inline SVG icon registry
      guards/                # route guards
    shared/
      components/            # icon, avatar, post-card, story-rail, filter-bar, empty
      ionic.ts               # single barrel for the Ionic components used
    pages/
      tabs/                  # home, spotlight, create, chats, me
      auth/ onboarding/      # Snapchat-style flows
      post/                  # detail + guided composer
      story/ user/ spotlight/ chat/ search/
      notifications/ tips/ settings/ terms/ admin/
      safety/                # consent centre, escalation, location check
  environments/              # dataMode switch + Firebase config
docs/SETUP.md                # the URLs and keys you plug in later
docs/FIRESTORE_RULES.md      # security rules + indexes
scripts/native-setup.mjs     # Android/iOS permissions, API 36 targets, usage strings
server.mjs                   # static server for the production build
```

---

## Testing

```bash
npm test
```

75 tests in two files. `src/app/core/lulafind.spec.ts` (58) runs against the real
services — no mocks of the logic under test. `src/app/core/components.spec.ts`
(17) mounts the real components and asserts on what they render:

- **LocalDb** — seeding, type/province/status filters, followers-only audience
  enforcement, hot-score sorting, case-number search
- **DataService** — upvote toggle, up↔down switching, comment counters and poster
  notifications
- **ChatService** — each of the three gate rules in isolation, chat-off absolute,
  KhumbulEkhaya claim bypass, thread + message persistence
- **EscalationService** — refuses to record a contact note without the poster's
  confirmation, does not invent a reference, and does not offer a fake Amber Alert
  or Pink Drive. Outcome nudge targeting is unchanged
- **KhumbulEkhaya** — claim, subject answer, "are they being wanted?" tally, close as found
- **LocationService** — returns **nothing** without consent, returns a point with
  consent, province mapping, distance maths, revoke
- **Spotlight** — create, duplicate rejection, join
- **Accounts** — signup with unique handle and no phone field, duplicate email,
  weak password, demo session, self-follow prevention
- **Store consistency** — every reader returns a fresh copy, so callers cannot
  corrupt the store and signals cannot miss an update
- **Components** — the admin queue lists people and narrows as you type; the
  Spotlight tab and the in-community search both narrow as you type; the filter
  bar shows all nine provinces; a post card renders
  Follow and the "+2" overflow badge; the sign-up screen has Google / Apple / Demo
  and **no LinkedIn**; the Spotlight A–Z dropdown filters; the duplicate-surname
  check is province-scoped; the composer starts with nothing pre-selected; the
  story composer offers everyone / followers / Spotlight; the profile hides
  private fields; the terms screen carries the 18+ and arrest notices

---

## Notes and honest gaps

- **No dispatch.** Help numbers are real links. A note on a case means the poster
  said they called. It is not a SAPS or NGO acknowledgement.
- **Push notifications** are wired through `@capacitor/push-notifications` config
  but need an FCM project + APNs certificate to deliver.
- **Images** in the demo are generated SVG placeholders so the app works fully
  offline; real uploads go through `MediaService` (Capacitor Camera on device,
  file picker on web) and should be sent to Firebase Storage.
- The privacy policy / terms screens are placeholders — both stores require a
  reachable privacy policy.
