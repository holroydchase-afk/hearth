# Run your own Hearth

This guide is for a developer who wants their own copy of Hearth, on their own accounts, for their own family. It is the "Developer edition" step 3 in `docs/product/TRACKER.md`. Hearth is AGPL-3.0-or-later (`LICENSE`): if you run a changed copy for other people, you must offer them your source.

Hearth is a proof of concept. Read "Known gaps" at the end before you put a real family on it.

## 0. Try it with no accounts at all

The demo runs the whole app against an in-browser fake backend with a made-up family. Nothing leaves the browser.

```bash
cd app && npm ci
npm run export:web:demo && node scripts/serve-dist.js dist-demo 8090   # then open http://127.0.0.1:8090
```

The test suites need no accounts either:

```bash
cd backend && bash tests/run.sh          # SQL suites on a local Postgres 16 (needs a superuser)
cd app && npm test && npm run typecheck  # Jest, against the fake backend
bash test-all.sh                         # everything, as CI runs it
```

## 1. Accounts you need

| Account | What for | Pick |
|---|---|---|
| Supabase | Postgres with row-level security, sign-in, edge functions | **East US (N. Virginia)** if you want data in the US. The free tier pauses after a week idle; use Pro before real family photos |
| Backblaze B2 | The encrypted photo files | **US East at signup**: the region can't be changed later. One **private** bucket and an application key scoped to it (read and write) |
| Resend (optional) | Email notices about new photos | Without it, Hearth sends no emails; push still works |
| Expo (optional) | Running the app in Expo Go on a phone, or a store build | Free for Expo Go |

## 2. Settings you change (they point at the original author's project today)

| Where | What | Change to |
|---|---|---|
| `SUPABASE_PROJECT_REF` (environment) | `deploy.sh`, `smoke-check.sh` and `family-setup.sh` default to the original project | your project's ref. **Always set it**, or the scripts aim at someone else's project and fail on the token |
| `app/.env.local` (copy `app/.env.example`) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | your project's URL and anon key. Both are public by design: they ship inside the app, and RLS does the guarding |
| `app/src/api/links.ts` | `JOIN_LINK_BASE`, the web address the app recognizes as an invite link | your own web build's `/join/` address (step 5) |
| Database row `private.secrets` → `invite_link_base` | the link `create_invite` hands out, set by migration 0014 to the author's web build | the same `/join/` address, after the first deploy (step 5) |
| `app/app.json` | `owner`, `extra.eas.projectId`, `updates.url`, `ios.bundleIdentifier`, `android.package` | your Expo account, your EAS project, your own identifiers. Only needed for Expo Go links or store builds |
| `backend/supabase/functions/.env` (copy `.env.example`) | B2, `MEDIA_KEK`, `ALLOWED_ORIGINS`, Resend | see step 3 |

## 3. Function secrets

```bash
cd backend
cp supabase/functions/.env.example supabase/functions/.env   # git-ignored; never commit it
openssl rand -base64 32                                      # paste as MEDIA_KEK
```

Fill in `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY` and your B2 endpoint and region. Set `ALLOWED_ORIGINS` to your web build's origin (comma-separated). Set `RESEND_API_KEY` and `RESEND_FROM` if you use Resend. Leave out every `SUPABASE_*` name: Supabase injects those itself, and `deploy.sh` refuses a file that has them.

**Back up `MEDIA_KEK` offline.** Every photo's key is wrapped with it (`docs/architecture/03-encryption-and-keys.md`). If you lose it, you lose every photo.

Add a CORS rule to the B2 bucket that allows `GET, PUT, HEAD` from the same web origin. Native apps don't need it.

## 4. Deploy the backend (one command)

Make a Supabase personal access token (Account → Access Tokens). Keep it in your shell or CI secrets, never in git or a chat.

```bash
cd backend
export SUPABASE_PROJECT_REF=<your-ref> SUPABASE_ACCESS_TOKEN=<token>
bash scripts/deploy.sh --dry-run   # prints every step, changes nothing, needs no token
bash scripts/deploy.sh
bash scripts/smoke-check.sh        # read-only: migrations, RLS on every table, cron jobs, functions, secret names
```

`deploy.sh` does five things, all through the Supabase Management API, so you need no database password:
1. It applies every migration in `supabase/migrations/`, each in one transaction, and skips the ones already applied. It never loads seed data.
2. It sets the function secrets from your `.env`, plus a fresh cron secret.
3. It deploys the `sign-media` and `notify` edge functions.
4. It schedules `notify` every minute and the error-report purge nightly. Both use pg_cron, and the cron secret is kept in Vault.
5. It sets the sign-in email to a 6-digit code instead of a link.

Re-run it after you pull new migrations. It only applies what is new.

`smoke-check.sh` also checks that invite links start with `https://` and end in `/join/`. Migration 0014 sets them to the author's web build, which passes that check, so change it for your host in step 5.

## 5. The app

```bash
cd app && npm ci
cp .env.example .env.local          # then fill in your URL and anon key
npx expo start                      # scan with Expo Go (iPhone or Android)
npx expo export --platform web      # a static web build in dist/, for any static host
```

Point `JOIN_LINK_BASE` and `ALLOWED_ORIGINS` at wherever you host the web build. Then set the invite link the database hands out, once, in the Supabase SQL editor:

```sql
update private.secrets set value = 'https://your-host.example/join/' where name = 'invite_link_base';
```
 Before you call a build ready, open it on a real phone, or run `bash scripts/check-expo-go.sh` from the repo root (`docs/eng/LESSONS.md`).

## 6. Your family

There is no "create a family" screen yet. Sign in once in the app with your email, then run:

```bash
cd backend
bash scripts/family-setup.sh --chase-email you@example.com --space-name 'Our kids' --print-sql   # look first
bash scripts/family-setup.sh --chase-email you@example.com --space-name 'Our kids' [--mom-email co-parent@example.com]
```

The `--chase-email` flag means "the owner's email": it is named after the author. The script works as you, through the app's own RPCs and RLS, so it can't do anything you couldn't. It makes the family, the Everyone group, one group per side, the houses under them and two sample events. Then it prints invite codes. It is safe to re-run until someone else joins. Rename any group in the app afterwards (Groups).

## Known gaps (read before real photos)

- **Deletion is only half built.** Deleting a post or an account marks it and destroys the post's keys, so the photos can't be read. But the worker that removes the files from B2, builds export zips and removes sign-in rows isn't written. The nightly `purge_soft_deleted` job isn't scheduled by `deploy.sh` either (`backend/README.md`, "Scheduled jobs").
- **Push notices on iPhone** need a paid Apple developer account and a real build. In Expo Go, notices are email only.
- **The names are the author's.** Some script flags and sample groups (`--chase-email`, "Mom's side") are named after the author's family. They are only labels.
- **There's no outside security review yet.** The threat model and its open items are in `docs/architecture/04-threat-model.md`.

## Where to read next

- `docs/architecture/`: how data is stored, moved, encrypted and shared, written for technical readers.
- `docs/eng/API.md`: the app-to-backend contract. Change the contract tests before you change it.
- `CLAUDE.md`: the rules every change here follows, including test-first and the privacy invariants.

Last checked against code: 2026-11-01, main 45e72c7 (migrations 0001-0021; `deploy.sh --dry-run` and `family-setup.sh --print-sql` run with a made-up project ref).
