# Runbook: start a family (START-ON-7)

How Chase turns "start a family" (migration 0024, DEC-55) on and off, deals with a family someone reports, and what
has to be true before it goes on. The switch `start_family_open` ships **off** and stays off until Chase says
"turn on start a family" (DEC-74). Spec: `docs/product/SPEC-START-FAMILY.md` section 8.

Every script below runs from `backend/`, needs only `SUPABASE_ACCESS_TOKEN` (an environment secret, never in chat or
git), goes through the Supabase Management API like `family-setup.sh`, and is a **dry run unless you add `--apply`**.
Output carries only the space id: no family, group or member name, no email. `--print-sql` shows the request
without sending it (no token needed).

## Turn it on

Only after the go-live checklist below is all ticked.

```
bash scripts/start-family-switch.sh status
bash scripts/start-family-switch.sh on --apply
```

Only `start_family_open` changes: no other flag, no family. The app reads `can_start_family()` when the no-family
screen opens, so the start button shows from then on (in builds that have a help email; see START-ON-2).

## Turn it off

```
bash scripts/start-family-switch.sh off --apply
```

New starts stop at once (`start_family` refuses with 42501, the button hides). Families already started stay as
they are: turning it off never removes anything.

## Someone reports a family: suspend it, and undo

Reports arrive at the help email through Help, "Something wrong?" → **Email Hearth**. The space id is in the
Supabase dashboard (Table Editor, `public.spaces`, or `private.started_families` for app-started ones).

```
bash scripts/suspend-family.sh --space <space id>            # dry run: says what would happen
bash scripts/suspend-family.sh --space <space id> --apply    # suspend
```

Suspending sets `spaces.deleted_at`. Every member, the owner included, then finds nothing (rule 2: not found) and
uploads to it are refused. Nothing else changes, so it can be undone:

```
bash scripts/suspend-family.sh --space <space id> --undo --apply
```

Undo brings it back unchanged. `purge_soft_deleted` can remove families suspended more than 30 days ago (members,
groups, posts, media rows), but it is **not scheduled** on the hosted project and nothing deletes the photos in B2
(threat model gap 3, SEC-R1). So a suspended family and its photos stay until Chase deletes them by hand. An unknown space id fails and changes nothing.

## Mark a family known (lift its cap)

App-started families are capped at 500 items or 2 GiB (`HF001`) until Chase knows who they are:

```
bash scripts/suspend-family.sh --space <space id> --known --apply
```

This sets `private.started_families.known_at`. It doesn't suspend anything. Families made by `family-setup.sh` were
never capped.

## Ban an account

Suspending a family doesn't stop its members signing in and starting another (each can start one, 3 a day). To
stop them: Supabase dashboard → **Authentication → Users** → find each account → **Ban user** (pick a long
duration). Ban the owner and every other parent in that family who took part (SEC-R2), as well as suspending it. Banning keeps their data until the family is purged or the account deleted.

## Go-live checklist (all before "on")

- [ ] **Help email set**: `EXPO_PUBLIC_HEARTH_HELP_EMAIL` in the EAS preview environment (one address Chase reads;
      never in the repo), then **republish the Expo preview** (`scripts/check-expo-go.sh`, then the EAS update in
      `app/`). Without it, Help has no "Something wrong?" and the start button stays hidden (START-ON-1, -2).
- [ ] Open Help in the republished preview: "Something wrong?" shows and **Email Hearth** opens a mail to that address.
- [ ] **PRIV-R5 legal review** (18+ line, terms; milestone 7).
- [ ] **BETA-START-9 cold test**: a parent who isn't Chase, no help, starts a family and invites one person in under
      5 minutes; logged in the Test Log.
- [ ] **Chase's words**: "turn on start a family" (logged as a DEC entry), then `start-family-switch.sh on --apply`.

Tests: `backend/tests/suspend_family_test.sql` (what the SQL does), `backend/tests/start_on_scripts_test.sh` (the
wrappers), `app/src/screens/__tests__/help.test.tsx` and `join.test.tsx` (the app side).
