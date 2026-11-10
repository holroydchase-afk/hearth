# Spec: Start a family

Owner: staff-pm. Nov 7, 2026. Status: **decided** (Chase, Nov 7: "Yes, build it now"; DEC-55, reverses DEC-3). Persona check: `docs/product/decisions/2026-11-07-start-a-family.md`.

## Decision in two lines
A signed-in parent with no family can start one in the app: name it, keep Everyone or add two sides, invite one person. Starting is open; **joining stays invite-only** (hashed, single-use, email-bound invites, unchanged).

## 1. What "invite-only" guards today (checked Nov 7)
- **Accounts are open.** `SupabaseApi.signIn` sends `shouldCreateUser: true`; `config.toml` has `enable_signup = true` (auth and auth.email). Anyone with an email gets an account and lands on the code entry.
- **Starting a family is already open on the server.** `create_household(text)` and `create_space(uuid, text)` are granted to `authenticated` (0001/0002; `create_space` redefined in 0011 at ~1179). Any account can call them with curl today. The guard was "no screen calls them".
- **Joining is the real guard.** Only `redeem_invite` adds someone to a family the person didn't create, and RLS hides every other family. A new family is private to its creator by construction until they invite.

So this screen opens no new server path. It changes the product promise (anyone can start) and the claim "Invite-only; nothing public" (MARKETING): it becomes "joining is invite-only".

## 2. Who may start one
- A signed-in account that **owns no family yet** (one family per account for the beta). Hidden for anyone already in a family.
- The creator becomes Owner (`owner`), the same as Chase in his family.
- No allowlist: an allowlist would need Chase, which defeats level 5. A server switch can close starting for everyone (START-8).

## 3. Screens (three, plus the entry)
0. **Entry**, on the no-family screen after sign-in (`JoinScreen`'s signed-in state): the code entry stays first and biggest. Below it, a smaller button **"I'm a parent: start a family"**. Not on the signed-out landing (sign in first, then choose).
1. **"Did someone send you a code?"**: one line ("If a relative invited you, use their code instead"), buttons **Use a code** and **Start a new family**. Stops a grandparent who lost her code (LG).
2. **Name your family**: one text field ("Our kids", 1 to 60 characters), **Next**.
3. **Who's in it**: **Just Everyone** (default) or **Two sides** with two editable names ("Dad's side", "Mom's side"). No households, events or links.
4. **Invite your first person**: the existing invite card from Groups, prefilled with Everyone, name and email, role Parent or Relative. **Skip for now** lands on Photos, whose empty state points to Groups to invite.

*(privacy-security, Nov 7, PRIV-R5)* Screen 2 adds one line under the field: "Hearth is for parents and guardians 18 or older." (`grandparent-ux` owns the wording.)

Words follow rule 3 (group, Photos, verb labels, 17 pt, 48 pt targets). `grandparent-ux` reviews the words; `ux-reviewer` reviews it for the public demo.

## 4. What the setup creates (0011/0013 shape)
One new RPC, `start_family(p_name text, p_sides text[])`, security definer, **one transaction**:
- `households` row (creator as admin), `spaces` row, creator as `owner` in `space_members`.
- Everyone (`kind = 'everyone'`) with the creator in it, and `notification_prefs` for them (what `create_space` does now).
- If `p_sides` has two names: two `kind = 'group'` circles via `create_level` (Private comments, 0013 default), no members, no links.
- Refuses (`errcode` checked by the app, rule 7) when the caller already owns a family, the name is blank or over 60, sides is not 0 or 2 names, or the switch is off.

Not created: households, events, the Test house, invites. The app's first invite (screen 4) goes through `create_invite` as today.

## 5. Acceptance criteria
| ID | Type | Pri | Given / When / Then |
|---|---|---|---|
| BETA-START-1 | auto | P0 | **Given** a signed-in account with no family, **When** it calls `start_family('Our kids', '{}')`, **Then** one space, one household and one Everyone exist, the caller is Owner and in Everyone, and nobody else can read any of it (RLS test as a second account returns not found). |
| BETA-START-2 | auto | P0 | **Given** the no-family screen, **When** it renders, **Then** the code entry comes first, "I'm a parent: start a family" sits below it, and tapping it shows "Did someone send you a code?" with Use a code and Start a new family before anything is created. |
| BETA-START-3 | auto | P0 | **Given** a started family, **When** its owner invites one email to Everyone and that person redeems the code, **Then** they see only that family's posts shared to them; a third account with no invite sees none (reuses BETA-JOIN-3 and BETA-AUD-3 checks on the new family). |
| BETA-START-4 | auto | P1 | **Given** Two sides with "Dad's side" and "Mom's side", **When** the family is started, **Then** both exist as `group` circles with Private comments and no members, and Everyone is still first in the share sheet. |
| BETA-START-5 | auto | P0 | **Given** an account that already owns a family, **When** it calls `start_family` again or opens the no-family screen, **Then** the call is refused with a coded error and no start button is shown. |
| BETA-START-6 | auto | P1 | **Given** a failure partway (bad side name), **When** `start_family` runs, **Then** nothing is left behind (no orphan household or space). |
| BETA-START-7 | auto | P1 | **Given** an account whose only family is one it started with no other members and no posts, **When** it redeems an invite, **Then** it lands on the invited family and the empty one is retired. |
| BETA-START-8 | auto | P0 | **Given** the server switch `start_family_open = false`, **When** anyone calls `start_family`, **Then** it is refused and the app hides the start button. *(privacy-security, Nov 7, PRIV-R2:)* The switch is a row in `private.feature_flags` (no app grant), read inside `start_family`; the app asks a security-definer `can_start_family()` that returns only a boolean (false when the switch is off or the caller is already in a family). Turning it off never touches existing families. |
| BETA-START-10 | auto | P0 | *(privacy-security, Nov 7, PRIV-R1)* **Given** 0024 is applied, **When** an `authenticated` account calls `create_household` or `create_space` directly, **Then** it gets permission denied (execute revoked from `public`, `anon`, `authenticated`), so the switch and the one-family rule can't be skipped with curl; `family-setup-api.sql` and `family-setup.sql` still pass (they call `start_family` or run the old functions before switching role). |
| BETA-START-11 | auto | P1 | *(privacy-security, Nov 7, PRIV-R3)* **Given** one account, **When** it calls `start_family` more than 3 times in 24 hours (including after BETA-START-7 retires a family), **Then** it is refused with a coded error, using `private.rate_limit_events`. |
| BETA-START-12 | auto | P1 | *(privacy-security, Nov 7, PRIV-R4)* **Given** a family started through `start_family` that Chase hasn't marked known, **When** its members upload more than 500 photos or 2 GB in total, **Then** `prepare_media_upload` refuses with a coded error and the app shows a calm "Your family is full for now" message; Chase's family is exempt. |
| BETA-START-13 | auto | P1 | *(privacy-security, Nov 7, PRIV-R6)* **Given** any `start_family` refusal or failure, **When** it is raised or reported through `report_client_error`, **Then** the message and the logs contain no family name, side name, email or user id (test greps the raised message and the error row). |
| BETA-START-9 | manual | P0 | **Given** a parent who has never seen Hearth (not Chase), the app installed and no help, **When** they sign in, start a family and invite one person, **Then** they finish in under 5 minutes and the invitee sees their first post (level 5 evidence; logged in the Test Log). |

## 6. Cut (not now)
- Households, events, links and the full `family-setup.sh` shape in the app (Groups already makes groups later).
- Start from the signed-out landing; a family directory, search or public link of any kind.
- More than one family per account; switching families.
- Transferring ownership, deleting a family, a second owner.
- An allowlist or waitlist for who may start (needs Chase; the kill switch covers abuse).
- Billing, storage caps per family (watch B2 cost by hand; TRACKER row if a stranger family appears).

## 7. Reviews needed before build
- **architect**: migration 0024 (`start_family`, the switch, retiring an empty family in `redeem_invite`); whether `create_household`/`create_space` grants should be revoked from `authenticated` so `start_family` is the only path.
- **privacy-security**: open starting means strangers can store data on Hearth's B2 and Supabase: abuse, cost and kids'-data exposure (no age gate, COPPA framing); the kill switch; the claims register change; `docs/architecture/` threat model section and "Last checked" (rule 6).
- **positioning**: MARKETING claim "Invite-only; nothing public" becomes "Joining is invite-only; nothing public".

Privacy review: privacy-security, Nov 7, 2026 (PRIV-R1..R8; edits marked). Deploy also needs: an abuse contact in Help, a service-role `suspend_family` runbook in `docs/eng/`, `docs/architecture/04` and `05` updated with "Last checked", and the MARKETING claim row changed (rule 6).

Last checked: Nov 7, 2026 (staff-pm, against 0001, 0002, 0011, 0013, `SupabaseApi.ts`, `config.toml`).

## Build design (architect, Nov 7)
Verdict: OK. Rung: same stack (Postgres RPCs + RLS, one migration). No new vendor, dependency or table outside `private`. Undo: flip `start_family_open` off; 0024 is additive except the revoke and three redefined functions.

### Migration `0024_start_family.sql`
**New table** `private.started_families (space_id uuid pk → spaces on delete cascade, started_by uuid → profiles on delete cascade, client_id uuid, started_at timestamptz default now(), known_at timestamptz)`, unique `(started_by, client_id)`. No grants (private schema). It marks which families came from the app: **a family not in this table is never capped**, so Chase's family (made by `family-setup*.sql`) is exempt with no name or id in the repo. Chase marks a stranger family known by space id through the service role (`update private.started_families set known_at = now() where space_id = '…'`, in the `suspend_family` runbook).

**Flag row:** `insert into private.feature_flags values ('start_family_open', false)`. Ships off; the deploy turns it on once Help has the abuse contact. `feature_capability()` has no entry for it, so `my_features()` never lists it.

| Function | Kind | Does |
|---|---|---|
| `public.start_family(p_client_id uuid, p_name text, p_sides text[] default '{}') returns uuid` | definer, `authenticated` only | Advisory lock on `hearth.start:<uid>`. Same `p_client_id` from the same caller returns the first space id (API.md idempotency; adds `p_client_id` to the spec's signature). Then, in order: not signed in `42501`; switch off `42501`; already in any live family `23505`; 3 starts in 24 h `54000`; name blank or over 60 after trim `23514`; sides not 0 or 2 `23514`. Creates via `create_household` + `create_space` (definer still holds execute), then `create_level(space, 'group', side)` for each side (duplicate or bad name raises `23514`, whole call rolls back: START-6). Inserts `started_families` and one `rate_limit_events` row (`key 'start:<uid>'`, `action 'start_family'`). Every message is a fixed string: no name, side, email or id (START-13). |
| `public.can_start_family() returns boolean` | definer, stable, `authenticated` | `uid` set, flag on, not in a live family, under 3 starts in 24 h. Boolean only. |
| `private.family_cap_check(p_space uuid, p_bytes bigint)` | definer | No-op unless the space is in `started_families` with `known_at is null`. Locks that row `for update`, then refuses with **`HF001`** "family_full" when `count(media_items) >= 500` or `sum(byte_size + thumb_byte_size) + p_bytes > 2 GiB`. |
| `public.tg_media_before_insert()` | redefined (0020 copy) | Calls `family_cap_check(v_space, new.byte_size + new.thumb_byte_size)` for every insert, so `prepare_media_upload` and direct inserts get the same refusal. |
| `public.space_upload_quota(uuid)` | redefined (0020 copy) | Adds `family_full boolean` so the app can show "Your family is full for now" before picking photos. |
| `public.redeem_invite(text)` | redefined (0013 copy) | START-7: after the invite is valid and before the insert, if the caller is the only member of a family they started (in `started_families`), with no posts at all (drafts included) and other than the invite's family, set its `spaces.deleted_at = now()`. The existing purge removes it later. Rate events stay, so retiring doesn't reset the 3/day limit. |
| `private.rl_fail`, `public.purge_client_errors` | redefined (0012 copies) | Their 1-hour purge skips `action = 'start_family'`. Those rows are purged after 24 h instead; otherwise the limit would forget starts after an hour. |

**Grants:** `revoke execute on function public.create_household(text), public.create_space(uuid, text) from public, anon, authenticated; grant … to service_role` (START-10). Grant `start_family`, `can_start_family` to `authenticated` only.

**Scripts:** in `family-setup-api.sql`, set `request.jwt.claim.sub` first, run `create_space(create_household(…))` **before** `set_config('role', 'authenticated')`, then switch role for the rest. Make the same move in `family-setup.sql`, creating the space before `set role authenticated`. Neither calls `start_family`: that would put Chase's family under the cap.

### Error codes (rule 7)
`23505` means already in a family. The app reloads `mySpaces`. `54000` means too many starts; with action `start` the message is "You've started 3 families today. Try again tomorrow." `HF001` is new: the app adds `'FAMILY_FULL'` to `ApiErrorCode` and maps it in `toApiError`. It is not retryable, so the upload queue stops on it. Never branch on HTTP status: PostgREST returns `HF001` as 400.

### Contract
`API.md`: a new "Start a family (0024)" table covering `start_family`, `can_start_family` and the `family_full` field of `space_upload_quota`, plus the `HF001` row in the error table. `HearthApi` gets `canStartFamily(): Promise<boolean>` and `startFamily(a: { clientId: string; name: string; sides: [] | [string, string] }): Promise<string>`. SupabaseApi uses `rpc(...)`. FakeBackend adds a `startFamilyOpen` switch, started-family records, a 3-in-24 h counter, and caps that tests can set.

### Test homes
- `backend/tests/start_family_test.sql` (new; add to the `run.sh` loop) covers START-1, 4, 5, 6, 7, 8, 10, 11, 12 and 13. START-13 greps `SQLERRM` and the `client_errors` row.
- `backend/tests/setup_api_test.sh` and `setup_test.sql` must still pass (START-10). In `video_cap_test.sql`, line 30 calls `create_space` as Alex: move that call to admin with `jwt.claim.sub` set.
- `app/src/api/contract/contract.test.ts` (Fake + Supabase harness) covers START-1, 3, 5, 8, 11 and the `HF001` code. `app/src/api/__tests__/SupabaseApi.test.ts` covers the `HF001`→`FAMILY_FULL` mapping. `app/src/errors/__tests__/messages.test.ts` covers the full and too-many-starts words.
- `app/src/screens/__tests__/join.test.tsx` covers START-2, 5 and 8 (button order, hidden when `canStartFamily` is false). The new `app/src/screens/__tests__/startFamily.test.tsx` covers the three screens and Two sides (START-4 UI).

Rule 6: the same PR updates `docs/architecture/` 04 and 05 (new private table, cap, revoke) and their "Last checked".
