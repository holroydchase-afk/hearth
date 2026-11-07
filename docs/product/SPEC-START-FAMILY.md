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
| BETA-START-8 | auto | P0 | **Given** the server switch `start_family_open = false`, **When** anyone calls `start_family`, **Then** it is refused and the app hides the start button. |
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

Last checked: Nov 7, 2026 (staff-pm, against 0001, 0002, 0011, 0013, `SupabaseApi.ts`, `config.toml`).
