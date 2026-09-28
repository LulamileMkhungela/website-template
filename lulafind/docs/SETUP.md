# Backend setup and live check

Last updated: 26 September 2026. This file is the source of truth for what is connected and what is not. Where it disagrees with `README.md`, follow this file.

---

## How the two backends are split

| Backend | Used for | Not used for |
|---------|----------|-------------|
| **Supabase** | Email/password accounts, Google OAuth, email confirmation and password recovery; all app data and photos | — |
| **Firebase** | Not used by the current app flow. The project and its legacy email templates remain configured but are not the auth provider. | Firestore, Realtime Database, Cloud Storage, Analytics, account emails |

The app picks its data adapter at startup in `src/app/app.config.ts`:
1. If `environment.supabaseUrl` and `environment.supabaseKey` are set → **SupabaseApi** and the Supabase Auth client.
2. Else if `environment.dataMode === 'firebase'` → **FirebaseApi** for data only; this is not the configured authentication flow.
3. Otherwise → **MockApi** and local demo credentials.

Both `environment.ts` and `environment.prod.ts` set `dataMode: 'supabase'` and include the publishable Supabase key. Live email/password, Google OAuth and recovery therefore require Supabase Auth; the source code does not use Firebase Auth for those journeys.

---

## Configuration status (26 September 2026)

| Piece | What the repository confirms |
|-------|------------------------------|
| Supabase source configuration | `environment.ts` contains the project URL and publishable key; this does not prove a live request succeeds. |
| Records schema | `supabase/schema.sql` uses `(collection, id)` as the key, `owner_id uuid`, and `payload jsonb`. The hosted schema and policies have not been checked from this code session. |
| Story privacy migration | `supabase/story-privacy.sql` is the idempotent migration for an existing project. It backfills legacy reply/viewer projections into private rows, strips them from story payloads, and replaces the known RLS policies. It has not been run against the hosted database. |
| Auth source code | Supabase Auth is used when `SupabaseApi` is active: email/password, confirmation callback, password recovery, and Google OAuth callback/session restore. |
| Supabase providers and SMTP | Must be verified in the dashboard; the source code cannot enable providers or guarantee mail delivery. |
| Redirect URLs | Must be allowed in Supabase Auth and Google OAuth settings; see the list below. Preview domains may need the exact Arena origin. |
| Firebase project/templates | Legacy configuration only; the current auth flow does not call Firebase Auth or its email action page. |
| Live writes, OAuth consent, and email delivery | Not verified against the hosted project in this session. |
| Android/iOS OAuth callback | Native deep-link round-trip has not been exercised on a device. |

---

## `records` table schema and RLS

The Supabase adapter stores domain records in one flat table. The authoritative, repeatable SQL is [`supabase/schema.sql`](../supabase/schema.sql): it defines `id text`, `collection text`, `owner_id uuid`, `payload jsonb`, and `updated_at bigint`, with a composite primary key on `(collection, id)`. The adapter reads and writes `payload` (not `data`).

For a new project, run `supabase/schema.sql`. For the existing project, run `supabase/story-privacy.sql`; it replaces the known `lula read`/write policies, migrates old embedded story replies and viewers into separate RLS-protected records, removes those private projections from each story row, and installs the same audience checks used by the new-project schema. It also removes the old broad Spotlight-update and reports-read policies, replacing unrestricted membership writes with `lula_set_spotlight_membership()`.

The photos bucket is private. New uploads are stored as object paths, and the adapter obtains a one-hour signed URL only after RLS confirms the viewer can access the referencing post or story. This prevents a permanent public storage URL from bypassing story audiences (a signed link can still be shared while it remains valid). Full `users` records are readable only by their owner (or a trusted moderator); the `lula_user_profiles_public` view strips email/admin fields and returns exact check-in coordinates only during an opted-in, active live share. Town/province sharing is off until the person opts in; stats and Spotlight membership follow their visibility switches. In Supabase, assign `app_metadata.role` (`admin` or `moderator`) only through a trusted server/Admin API; RLS ignores client-editable profile flags for privileges. The app also orders Supabase records by the schema's `updated_at` column (not the nonexistent `created_at` column), so cloud reads no longer silently fall back to local demo data for that query error.

The migration has not been run against the hosted project from this session. After applying it, run `supabase/verify-rls.sql` in the SQL editor; it inserts rollback-only fixtures and asserts sanitized public profiles, owner-only full profiles, denied self-assigned privileges, public/follower/Spotlight visibility, story-photo signing, author-only insights, legacy post status, private follow approval, and denied cross-audience reply writes. Then smoke-test with two real accounts. `lula_post_visible()` treats legacy posts with a missing status as active, not SQL `NULL`/hidden.

---

## Redirect URLs (required for OAuth and recovery)

In Supabase → **Authentication → URL Configuration → Redirect URLs**, add:

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

Add the exact preview origin if the wildcard is rejected. Configure the Google provider in Supabase and use the callback URL shown in the dashboard in the Google OAuth client's authorized redirect URIs. Google consent happens on Google's site; the callback returns to LulaFind. Password-reset email redirects return to `/auth?mode=newpass`.

---

## Legacy Firebase settings

Firebase email templates and action pages are not called by the current auth service. Keep them separate from the Supabase confirmation/recovery flow. The app does not currently implement Firebase Auth or a native Firebase OAuth callback.

---

## What you still need to do before launch

| Step | Why |
|------|-----|
| Verify the remote `records` columns match `supabase/schema.sql` (`payload`, composite key, UUID owner) | The source was inspected; the hosted database was not queried in this session. |
| Run `supabase/story-privacy.sql` and then `supabase/verify-rls.sql` in the SQL editor | Migrates private story data and policies; the rollback-only check verifies audience, follow-request, reply/view, and legacy-status rules. |
| Confirm Supabase Email and Google providers are enabled and configure email delivery | Needed for confirmation, reset links, and OAuth. Settings and inbox delivery are not verified by a local build. |
| Add allowed redirect URLs for production and the exact preview origin | OAuth and recovery callbacks must return to `/auth`. |
| Replace `SUPPORT_EMAIL` in `src/app/core/config.ts` | Use a monitored business/support address before public launch. |
| Add a real privacy policy URL | Required by both the Play Store and App Store; the current Terms screen is a placeholder. |
| Configure FCM for push notifications | Requires the FCM server key and APNs configuration for iOS. |
| Test full auth recovery and OAuth round-trips with real accounts | Confirms provider settings, callbacks, and email delivery on actual domains/devices. |

---

## Feature check — from the source code

| Feature | Wired in source | Live on a real account |
|---------|----------------|----------------------|
| Create, edit, delete a post | `DataService.createPost`, `updatePost`, `deletePost` → `SupabaseApi.savePost`, `deletePost` | Not watched on a live account in this check |
| Create, join, edit, delete a Spotlight | Owner edits use `SupabaseApi.saveSpotlight`; joins/leaves use `lula_set_spotlight_membership()` to avoid broad row-update rights | Not watched |
| 24-hour stories — disappear after expiry | `expiresAt` set to `Date.now() + 86400000`; `SupabaseApi.stories()` filters at read time | Not watched for 24 hours |
| Follow / unfollow | `DataService.toggleFollow` → `SupabaseApi.follow`, `unfollow` | Not watched with two accounts |
| Private chat (three-gate: chatEnabled + upvote + mutual follow) | `ChatService.gate()` checks all three; `ChatService.ensureThread` creates the thread | Not watched with two accounts |
| Report a post | `ModerationService.report()` currently saves to the local device store; cloud report persistence is not wired | Local demo only |
| Contact us | `mailto:` link in Help and Settings → opens mail app | Link confirmed in source |
| Sign out | Clears `localStorage` session, sets `user` signal to null, navigates to `/auth` | Not watched on a device |
| Real-time updates | `SupabaseApi.init()` subscribes to `postgres_changes` on the `records` table | Not watched with a second device |
| Guest browse wall | Shows a sign-up prompt after the 4th post card for unauthenticated users | Confirmed in `home.component.ts` |
| Admin panel | `/admin` now guarded by `adminGuard` — only users with `isAdmin: true` can access it | Not watched with an admin account |

---

## What this check does not prove

- A Supabase write succeeded from a signed-in account (the table may not exist yet)
- An email arrived in an inbox
- Push notifications fire on a device
- A real Android or iOS build compiles and runs
- Supabase RLS policies are in place and correct
