# 7. Visibility model: one core for routing, visibility and permissions

**Status: Phase 1 and 1b Built locally** (migrations 0031 and 0032, `packages/visibility/core`, DEC-83; not deployed). The registry, the gate, `vis.sees_item`, `vis.can_see` and `vis.attach` exist; nothing reads them yet, so access is unchanged and [05-access-control.md](05-access-control.md) still describes what decides it. **Planned:** the oracle (Phase 2), swapping `sees_post` for `sees_item`, and links (the co-parent bridge, after the beta). Spec: `docs/product/SPEC-VISIBILITY-CORE.md`, TRACKER R77.

## Terms

- **Tenant**: one walled space of members. Hearth's family space (`spaces`).
- **Member** and **role**: a person in a tenant, with `owner`, `admin` or `member`. Hearth: `space_members` (`owner`, `adult` = admin, `viewer` = member).
- **Container**: a named set of members inside a tenant. Hearth's groups, households, events and Everyone (`circles`, membership derived into `circle_members`).
- **Item**: the one thing that has an audience. Hearth's post (`posts`).
- **Audience**: the containers an item is sent to (`post_audiences`), each with the time it was added.
- **Kind**: a type of row (photo, reply, date, name...). Every kind is registered with exactly one **reach** (below).
- **Link**: a two-key, opt-in container shared by two tenants (Planned; Hearth's co-parent bridge).

## Design principles

1. **One rule per reach, written once.** Six reaches cover all data. A new kind picks one; it never brings its own rule.
2. **Fungible kinds.** Adding a content kind is one registry call plus a table with an `item_id` column. No new policy code. A conformance test proves it with a throwaway kind (VIS-19).
3. **Default deny.** A table, view, function, bucket or edge function not in the registry fails CI, and has no app access.
4. **Hooks narrow, never widen.** A product may add a narrowing rule to a kind (Hearth's reply settings), which is ANDed with the reach's rule. Nothing a product writes can show a row to someone the item's audience excludes.
5. **Not found, not forbidden.** Every reach answers "no" the same way as "doesn't exist" (P0002 or an empty set).
6. **No product words in the core.** The core says tenant, member, container, item, kind, link. Hearth's words live in its adapter, so other studio apps can use it (below).

## The six reaches

| Reach | Who sees a row | Engine (Hearth today) |
|---|---|---|
| `item` | Author; tenant admins; live members of a live audience container past their cutoff; named members of a live link on the audience (Planned) | `private.sees_post` (0011) |
| `person` | People who share a tenant as admin, share a live container, or read the person's reply | `public.can_see_profile` (0012) |
| `container` | The container's members plus tenant admins; container names to admins only | 0015 chat rule, 0027 `circles_select` |
| `self` | The row's owner only | per-table `user_id = auth.uid()` |
| `admin` | Tenant admins (some rows owner only) | `is_space_manager`, `can(space, 'family_settings')` |
| `server` | No app user, ever | `private.*`, insert-only error reports |

## Schema sketch (generic core, `vis` schema)

Illustration only; not a migration. Hearth's existing tables stay; the core reads them through four adapter views.

```sql
-- Registry: one row per relation an app user can touch.
create table vis.kinds (
  kind          text primary key,               -- 'item', 'photo', 'reply', 'event', ...
  relation      regclass not null unique,       -- the table or view
  reach         text not null check (reach in ('item','person','container','self','admin','server')),
  item_column   name,                           -- for reach 'item': the column holding the item id
  owner_column  name,                           -- for reach 'self'
  narrow_fn     regprocedure,                   -- optional product hook, ANDed (principle 4)
  note          text not null                   -- why it is in this reach, for reviewers
);
create table vis.functions (fn regprocedure primary key, kind text references vis.kinds, note text not null);
create table vis.edge_functions (name text primary key, kind text references vis.kinds, note text not null);

-- Adapter contract: the product defines these four views over its own tables.
--   vis.item_v       (item_id, tenant_id, author_id, live boolean, live_at timestamptz)
--   vis.audience_v   (item_id, container_id, added_at)
--   vis.membership_v (user_id, container_id, tenant_id, sees_from timestamptz, live boolean)
--   vis.role_v       (user_id, tenant_id, role text)   -- 'owner' | 'admin' | 'member'

-- Links (Planned): a container two tenants share, opened only when the two named readers
-- (v1: the subject's two guardians, one per tenant) each agree for themselves. A tenant owner
-- who is not a named reader (for example a new partner who started the space) can't open it
-- (PRIV-VC-R6). A closed link is never reopened; opening again makes a new link, so past
-- items stay hidden (PRIV-VC-R7).
create table vis.links (
  id           uuid primary key,
  tenant_a     uuid not null, tenant_b uuid not null,
  subject_id   uuid not null,                     -- what the link is about (Hearth: a child both tenants already guard)
  agreed_a_by  uuid, agreed_a_at timestamptz,     -- must be the tenant_a reader, a guardian of subject_id
  agreed_b_by  uuid, agreed_b_at timestamptz,     -- must be the tenant_b reader, a guardian of subject_id
  closed_at    timestamptz                        -- either side closes it alone, at once; also set
                                                  -- automatically when a reader stops being a live member
                                                  -- of their tenant or a guardian of subject_id
);
create table vis.link_members (link_id uuid references vis.links, user_id uuid, tenant_id uuid,
  agreed_by_other_side_at timestamptz,            -- adding a person needs the other side's yes
  sees_from timestamptz not null,                 -- B3 readers see only items sent after they were added
  primary key (link_id, user_id));

-- The one item rule (today's sees_post, generalised; parity-tested before any swap).
-- Every clause below is today's sees_post (0011) except the last; none may be dropped
-- (PRIV-VC-R1: an earlier draft left out "still a member" and "published").
-- vis.sees_item(user, item) := item not deleted, tenant not deleted, and either
--   (A) user is a live member of item.tenant, and one of
--       author = user
--       item published and role_v(user, item.tenant) in ('owner','admin')
--       item published and exists audience container c (not deleted): membership_v(user, c)
--         and (sees_from is null or item.live_at >= sees_from)
--   (B) item published, past its take-back hold, and exists audience link l: l agreed by both
--       named readers, not closed, user in link_members with the other side's yes, user still a
--       live member of their own tenant and a guardian of l.subject_id, item.live_at >= sees_from
-- A link reader matches only (B): they are never an admin or container member of item.tenant.
-- Must be security definer, stable, set search_path = '', execute revoked from public and anon,
-- in a schema PostgREST doesn't expose. It reads base tables, never through RLS (no recursion).

-- The one dispatch. Server-side only: an app user never calls a function that takes a user id
-- (PRIV-VC-R3). App-facing wrappers (can_view_post today) pass auth.uid() themselves.
-- vis.can_see(user, kind, id) := case reach
--   'item'      -> vis.sees_item(user, <item id from item_column>) and coalesce(narrow_fn(user, id), false)
--                  -- a hook that returns null or errors means no (fail closed, PRIV-VC-R4)
--   'person'    -> product's person rule (Hearth: can_see_profile)
--   'container' -> membership_v or admin
--   'self'      -> owner_column = user
--   'admin'     -> role_v admin
--   'server'    -> false

-- Fungible: one call registers a kind, enables and forces RLS, and writes the select policy.
-- select vis.attach('public.post_events', 'event', item_column => 'post_id');
--   => revoke all on public.post_events from anon, authenticated; grant select (<needed columns>) to authenticated
--      create policy vis_select on public.post_events for select to authenticated
--        using (vis.sees_item((select auth.uid()), post_id) and <narrow_fn, if any>);
-- Hooks narrow only if they are the same policy's AND. Postgres ORs permissive policies, so a
-- second permissive select policy on the table would widen it. The gate allows exactly one
-- permissive select policy per item-reach table (the one attach wrote); any other must be
-- RESTRICTIVE (PRIV-VC-R4). Hooks must be STABLE with no writes.
```

RLS policies call the reach's rule directly (inlinable, fast). `vis.can_see` is what tests, the oracle, download signing, notices and export call, so they can't drift from RLS.

**What the gate must read to be enforceable (PRIV-VC-R2).** Not only `public` tables: every schema PostgREST exposes (`config.toml` `[api] schemas`, today `public` and `graphql_public`); every view (must be `security_invoker = true` or it bypasses RLS) and materialized view (none allowed in an exposed schema; they have no RLS); every function executable by `anon` or `authenticated`, not only row-returning ones (a void function can still write across tenants or answer "forbidden" where it should say "not found"), each `security definer` one with `search_path = ''` and execute revoked from `public` and `anon`; policies granted `TO public` as well as `TO authenticated`; table grants to `anon` (none) and `authenticated` (registered columns only); every table in the `supabase_realtime` publication, and no Realtime presence anywhere (presence is "who is online", an A2 leak); `storage.objects` policies per bucket; and each edge function's `verify_jwt` (false only with a registered reason, as `notify` has today).

## What was built differs from the sketch (Phase 1 and 1b)

- `vis.kinds` has one more column, `rule_fn`: for the person, container and admin reaches, the product's rule for that kind as `fn(user, id) -> boolean`. Hearth's are copies of today's RLS rules with the user as a parameter (`private.vis_sees_person`, `vis_sees_circle`, `vis_sees_space`, `vis_sees_invite`, `vis_sees_household`); VIS-7 proves each equals what RLS returns. No `rule_fn` means `can_see` says no.
- `item_column` may be null for an item kind no app user reads (`media_keys`); `can_see` says no for it.
- `can_see` answers only for rows with a uuid `id`. Rows without one (reactions, post_children, post_audiences, the membership tables) are answered by their table's one policy, and `can_see` says no. A rule or hook that errors makes `can_see` say no.
- Policies written by `vis.attach` call `vis.viewer_sees_item(item)`, which passes `auth.uid()` itself, so no app role can execute a function that takes a user id (PRIV-VC-R3). `attach` refuses a table that already has a permissive select policy and a hook that isn't stable `(uuid, uuid) -> boolean`.
- Hooks registered today: `private.vis_media_ok` (pending uploads only to their uploader) and `private.vis_comment_ok` (reply settings, through `private.reply_ok`). `children` uses the person rule, which says no for a child: default deny until the oracle adds a child rule.
- First product use of `vis.attach` (0034, Phase 4): `post_events` and `post_sayings` are fungible item kinds of the post with no new rule; VIS-8 checks both tables for every person in the seed-42 oracle.
- `vis.links` and `vis.link_members` are not built (bridge after the beta).
- 0032 also forces RLS on every public table (refusing to run if the owner doesn't bypass RLS) and revokes any table grant from `anon`.

## How Hearth's tables map (Phase 1 confirms each row: VIS-1)

| Reach | Hearth relations |
|---|---|
| `item` | `posts` (the item), `media_items`, `media_keys`, `post_children`, `comments` and `reactions` (narrow: `private.group_reply_ok`), `post_audiences` (narrow: author and parents; others see names via `post_viewers`), `post_events` and `post_sayings` (0034, through `vis.attach`: no rule, no hook; news is a `posts.kind` with no child table) |
| `person` | `profiles`, `children` (guardians, parents, or a tagged post), `child_guardians`, `family_dates` (0029, rule `private.vis_sees_family_date`: the person rule for a member's birthday, parents and the Everyone group for other dates; VIS-18) |
| `container` | `circles` (0027), `circle_members`, `circle_people`, `circle_links`, `chat_groups`, `chat_messages`, `chat_key_packages` (via `chat_claim`) |
| `self` | `push_tokens`, `notification_prefs`, `account_exports`, `chat_devices`, `post_views` |
| `admin` | `spaces` settings, `space_members` (members see who's in the family), `space_features`, `space_children`, `invites`, `invite_circles`, `comment_mode_log`, `households`, `household_members` |
| `server` | `client_errors` (insert only), `notification_outbox` (recipients must pass `sees_item` at send time), `storage_purge_queue`, every `private.*` table |

Edge functions: `sign-media` (item; signs nothing unless `can_see`), `notify` (server; rechecks each recipient). RPCs returning rows (`get_feed`, `get_timeline`, `search_posts`, `post_viewers`, `get_comments`, `reply_readers`, `export_my_data`, `chat_*`) are registered to the kind they return.

## Cross-tenant links: the co-parent bridge (Planned)

Today a split family is two tenants, and nothing crosses (05, "Terms"). A link is the only way across, and it is narrow by construction:
- **Two keys to open, one to close.** The two named readers, each a guardian of the subject child, agree for themselves (a tenant owner who isn't one can't). Either closes it alone, at once, for past items too. It also closes by itself when a reader leaves their tenant, is removed as the child's guardian, or deletes their account. Closing is never announced; a closed link is never reopened, only replaced by a new one that starts empty.
- **Named people only.** A link's readers are listed people (v1: the two parents). Relatives, and anyone added to a tenant later (a new partner), are never readers until the other side says yes to that person.
- **About one subject.** A link names a child; an item reaches the link only if the author puts the link in its audience. Nothing crosses by default.
- **No back-channel.** A link reader sees the item, its photos, its words and the author's name. Never the other tenant's containers, audience, members, replies or reactions; the reader's own replies go to the author only.
- **Re-sharing is a new item.** To show a bridged photo to their own relatives, the receiving parent makes a new item in their own tenant with their own audience; the sender sees nothing of it.

Rules every reader must follow once clause (B) exists (PRIV-VC-R5). Without them, widening `sees_post` would leak through readers that already call it:
- `post_viewers` today lists every member of the sender's tenant who passes `sees_post`. For a link reader it must return only the author and the reader, or it hands the other home's relatives' names to the ex.
- Feed and timeline counts (`private.feed_rows`: replies, hearts) are null for a link reader; they are engagement data about the other home.
- Child tags (`post_children`) on a bridged item show a link reader only `subject_id`; other children (for example half-siblings in the sender's home) stay hidden.
- Replies and hearts by a link reader are read by the author and the writer only. This overrides today's "parents read every reply", so the sender's new partner, if an adult in the sender's tenant, doesn't read them.
- The link reader's profile is visible to the author only (not to the sender's tenant), and the item names its sender by display name, never by tenant name (a family name can carry a new partner's surname).
- `search_posts` and `export_my_data` treat bridged items like any other `sees_item` read: a link reader's export holds the item and their own replies, never the audience.
- Notices: a link reader gets "new photo" notices only; the sender gets reply notices. No notice ever says a link was closed, a request refused, or an item opened. A link request is delivered by a code the requester hands over, never by looking a person up, so nobody can learn whether an ex has a Hearth account.
- "Seen by" (`seen_count`, tracker R62) must be dropped before any link ships, or an author learns whether the other parent opened their post.

## Family names: labels, not rules (Planned; Chase, Nov 24)

Families call the same person different things: Grandpa, Pawpaw, Granddad, Nana, Gram, Gran, Granny, Aunt Libby, Uncle Graham. The model keeps these as **free-text labels someone picks**, never a fixed list and never a rule:

- `person_labels(tenant_id, labeler_id, person_id, label text)`: what *this* person calls *that* person ("Pawpaw" to one grandchild, "Dad" to the parent). One row per labeler and person; the app falls back to the person's own display name. A family-wide default (`labeler_id` null, set by a parent) covers the common case so nobody has to type it twice.
- Suggestions only: the app offers common words (grandma, grandpa, nana, pawpaw, granny, gram, gran, aunt, uncle, cousin) and the person can type anything else.
- **Labels never decide who sees what.** Visibility stays with groups and the six reaches; a label is a Person-class kind (registered with `vis.attach`, following `can_see_profile`), so a label is only shown to someone who can already see that person. Your private label ("the ex") is readable only by you (self reach).
- Generic core words: the `vis` package sees only "a label on a member"; the kinship words live in Hearth's layer, so another app (a "village" of neighbours, a team) can use the same table for its own names.

This is the first step toward Chase's "light Village Operating System" idea: people, the names they use for each other, and the groups they share with, all behind one visibility core.

## What Hearth's server can see

Unchanged by this model: RLS limits what each member's app reads, not the service role or the edge functions (see [04-threat-model.md](04-threat-model.md)). A link adds no new server access.

## Reuse beyond Hearth

Following `packages/messenger` (DEC-42): the generic core is `packages/visibility/core` (`@holroyd/visibility`, Built: `supabase.sql`, copied verbatim into migration 0031): the `vis` schema template, the rule and dispatch functions, `vis.attach`, and a conformance test kit (unregistered relation fails; a throwaway kind needs no new policy; every reader agrees with `can_see`). Hearth's migrations instantiate it with its four adapter views and two hooks. Moving it to a studio-wide repo is Product Studio's call later, by intake.

## Limits

- **Gap (today):** nothing makes a new table register; safety relies on review. Phase 1 closes it.
- **Gap (by design):** tenant admins (parents) see every item in their tenant.
- **Planned risk:** text checks on function bodies (VIS-5) can miss an indirect call; the oracle (VIS-8) is the backstop.
- **Planned risk:** the generic core trusts the product's adapter views. A product whose `role_v` or `membership_v` is too loose widens every kind; the conformance kit tests the adapter against fixtures, but it can't judge a product's intent.
- **Gap (by design):** a closed link can't pull back copies already saved, screenshotted or re-shared by the other parent (04, "Out of scope").
- Privacy review findings: `docs/product/SPEC-VISIBILITY-CORE.md`, "Privacy review".

---
Last checked against code: 2026-11-24, migrations 0001 to 0029 and 0031 to 0034 on branch claude/project-thread-jtelk5 (0034 attaches post_events and post_sayings; 0029 life calendar registered, VIS-18; 0030 is the video-fixes branch, not merged).
