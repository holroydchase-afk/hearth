# Spec: one visibility core, the co-parent bridge, and one Share composer

Status: **Phases 1 and 1b built locally** (Nov 24, 2026; Chase "Ok agreed to all", DEC-83; migrations 0031 and 0032, `packages/visibility/core`; not deployed). Phase 2 built locally on top (Nov 24; VIS-8, 10, 11, 12 green, VIS-9 green except `delete_post`'s promised repeat no-op; migration 0033); bridge after the beta. TRACKER R77. Persona check: `decisions/2026-11-24-visibility-core.md`. Data model: `docs/architecture/07-visibility-model.md` (its names win: `vis.kinds`, `vis.can_see`, `vis.sees_item`, `vis.attach`).

**Simple for the user, sophisticated underneath.** One core decides who sees every row of every kind. Families never see it; they pick names on a postcard. The headline feature it unlocks is the **co-parent bridge**: two homes sharing their child's photos and dates on purpose, with each side's relatives kept apart.

## In one minute

Chase asked (Nov 24): "I feel like there should be an advanced central core that sits between the poster and the family and decides who can see it ... I should be able to add a feature, then you say ok this is data and we have a sophisticated visibility and permissions system so there isn't a way for data to ever leak unless user error but eventually we catch that." Then: "maybe we have some feature that bridge the gap with divorced parents", "Make sure this fungible" and "Like can be used for other apps".

**The answer: Hearth mostly has this already, for posts.** One database rule, `private.sees_post`, decides who sees a post, its photos, its replies, its notices and its download links (`docs/architecture/05-access-control.md`). What's missing is the part that makes it automatic for the **next** feature. Today a new table or RPC is safe only if the engineer remembers to wire it to the right rule. That memory gap is why "who sees this?" keeps coming back to you.

What changes:
1. **Every kind of thing gets registered once.** A list in the database names each kind (post, photo, reply, announcement, date, name, chat, group) and the one rule that decides who sees it. Anything not on the list is seen by nobody (default deny).
2. **CI fails when a feature skips the list.** A test reads every table, view, RPC and edge function in the database and fails the build if one isn't registered or doesn't use its rule. A new feature can't ship with a "who sees this?" hole.
3. **One oracle checks every reader.** Generated families; every person asks for every item through every path (feed, timeline, search, download, notices, export, chat). Each answer must match the rule. This is R51, folded in.
4. **User error is caught twice.** Before: the To: names, nothing pre-picked (DEC-73/79), and a confirm when you **widen** a post after sending. After: a 2-minute "Take back" before any notice goes out, plus a nightly check of the live data.
5. **Fungible, and reusable.** Every content kind (photo, video, news, date, kinds not invented yet) is one registry row plus a table pointing at a post. Zero new visibility rules; a test proves it with a throwaway kind. The core has no Hearth words in it, so other studio apps can use it (`@holroyd/visibility`, like `@holroyd/messenger`).
6. **The co-parent bridge** (anchor feature, phased): two family spaces open a narrow, two-key link about one child. Only the two named parents read across it. Nobody is ever asked "who sees this?"; a parent picks the other home (for example "Dad's home") on To: like any group.
7. **One Share composer.** The postcard stays the only way in. Photos come first, with Event, News (a big announcement, words only) and Saying ("kids say the darndest things") beside it. Each is one post with one audience, picked the same way, and the list stays open: a new kind needs no new rule.

**What you won't be asked again:** "who should see X?" for any new content. New content attaches to a post and gets that post's audience, or it attaches to a person and follows who can see that person. Only a brand-new kind of reach (for example "everyone except Gigi") comes back to you, and that is a product call, not a plumbing question.

## Research: how large social networks do it (short)

1. **Audience is chosen per post, stored with the post, and checked when anyone reads.** Standard social feeds put an audience selector on every post and let the author change it later; the audience belongs to the post, not to the photos inside it ([archived help page, 2013](https://webarchive.library.unt.edu/web/20130523203305/http://www.facebook.com/help/120939471321735)). Large networks run the privacy check on each object at read time, after search or ranking picks candidates, so a cached or indexed copy can't leak ([patent: privacy checks after indexing](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9330183)). Hearth already does this: one predicate, run by Postgres RLS at read time.
2. **One authorization service, one data model, for every product.** The best-known published design stores "object#relation@user" tuples, defines per-type rules once ("viewer includes editor"), and every product asks the same service "can U see O?" ([paper summary and copy](https://authzed.com/zanzibar), [overview](https://en.wikipedia.org/wiki/Google_Zanzibar)). The lesson for Hearth is the **registry of kinds with one rule each**, not the distributed machinery. Postgres RLS is our check service.
3. **A post is one object with attachments; replies inherit the audience.** The open social web standard models a Note with attachments and addressing (to/cc), and says a reply keeps the parent's addressing ([W3C primer on replies](https://www.w3.org/wiki/ActivityPub/Primer/Changing_audience_in_replies), [vocabulary](https://w3.org/TR/activitystreams-vocabulary)). Hearth already does this: photos and replies hang off a post.
4. **The classic user error is a sticky default.** Selectors that remember the last audience led to accidental over-sharing; one large network later added a check-up and changed new users' default to a narrower audience ([2014 announcement](https://about.fb.com/news/2014/05/making-it-easier-to-share-with-who-you-want/)). Hearth's rule that nothing is pre-picked (DEC-73/79) is the stronger version. Changing many past posts at once is also error-prone; custom audiences resist bulk changes ([archived help, 2016](https://web-wp.archive.org/web/20160601070649/https:/www.facebook.com/help/325807937506242?ref=6pack)). Hearth has no bulk audience change and won't add one.

**Recommendation:** keep per-post audiences and read-time RLS (we're already on the right model). Add the two things big systems have and we don't: a **registry of kinds** and a **coverage gate** that refuses unregistered data.

## The core design

### C1. Six reach classes (three hold family content)

Every row any app user can read belongs to exactly one **reach class**:

| Class | Rule (the one function) | Kinds today | New kinds that fit |
|---|---|---|---|
| **Post** (has an audience) | `private.sees_post` | post, photo/video (`media_items`, `media_keys`), child tag (`post_children`), reply and reaction (plus `private.group_reply_ok`), notice | announcement, shared date, anything attached to a post |
| **Person** | `public.can_see_profile` | name, profile | life-calendar dates (0029 branch), a person's photo |
| **Group** | group membership + parents (0015, 0027) | group (relatives see only Everyone and their events), chat | group cover, group event details |
| **Self** | owner of the row only | push tokens, notice settings, exports, chat devices and key packages | |
| **Parents** | `is_space_manager` | invites, comment-mode log, family features | |
| **Server** | no app access at all | `private.*`, error reports (insert only), purge queue | |

Self, Parents and Server are plumbing. (Generic names in 07: item, person, container, self, admin, server.) A new feature picks a row. If it's content, it picks **Post** by default: anything shared is a post or hangs off one.

### C2. The registry

Three tables in the `vis` schema (07): `vis.kinds(kind, relation, reach, item_column, owner_column, rule_fn, narrow_fn, note)`, one row per table or view; `vis.functions(fn, kind, note)` for security definer functions (kind null = allowlisted with a reason); `vis.edge_functions(name, kind, note)`. Example rows: `post | public.posts | item | item_column id`, `media_item | public.media_items | item | item_column post_id | narrow private.vis_media_ok`, `profile | public.profiles | person | rule private.vis_sees_person`.

One function reads it: `vis.can_see(user, kind, id) → boolean`. It looks up the kind, finds the item through `item_column` (item reach) or calls the kind's rule, then ANDs any hook. RLS policies keep calling the rule directly (fast, and the planner can inline it); `can_see` is what tests, the oracle, `sign-media`, `notify` and export call, so they can't drift from RLS.

How existing rules fold in: nothing is rewritten. `sees_post`, `group_reply_ok`, `can_see_profile`, `can_see_circle`, `can_send_to` and `feature_on` stay as they are. The registry **names** them and the tests prove every reader uses them.

### C3. Default deny and the coverage gate (the part that ends the question)

A CI test, `backend/tests/vis_registry_test.sql`, reads the live catalog after all migrations:
- every table in `public` and every storage bucket is in the registry, or the build fails with "`<table>` has no reach class: add a vis_registry row" (the registry is `vis.kinds`);
- every registered table has RLS on and forced, and no policy for `authenticated` is `using (true)`;
- every policy on a Post-class table calls its class's rule (checked from `pg_policies`);
- every `security definer` function in `public` that returns rows is registered, and its body calls its rule (text check, with a short allowlist that names a reason);
- every edge function folder is listed (checked by a shell step, `backend/tests/vis_gate_test.sh`, that lists `backend/supabase/functions/`), and any `verify_jwt = false` names a reason;
- the same checks cover every schema PostgREST exposes (not only `public`), every view (must be `security_invoker`), materialized views (none exposed), all functions `authenticated` can execute (not only row-returning ones), policies `TO public`, column grants, the Realtime publication (no presence) and `storage.objects` policies (PRIV-VC-R2; full list in 07);
- each Post-class table has exactly one permissive select policy; any other is restrictive, so nothing can OR a wider rule in (PRIV-VC-R4).

So a feature can still be built wrong, but it **can't merge** wrong.

### C4. The oracle (R51, folded in)

`backend/tests/vis_oracle/`: a seeded generator builds families (two households, overlapping groups, events, removed members, demoted parents, a co-parent in the other space, share-history cutoffs, deleted posts). For every person × every item × every read path it compares the answer to `vis.can_see`. Read paths: table selects, `get_feed`, `get_timeline`, `search_posts`, `post_viewers`, `get_comments`, `reply_readers`, `sign-media`, the notice outbox, `export_my_data`, chat. A wrong "yes" is P0; a wrong "no" is P1. Fixed seed on every PR, a random seed nightly, results matrix dated in `backend/tests/results/`.

The app's Fake backend runs the same fixtures, so the demo can't show what the real server wouldn't.

### C5. Fungible kinds (design principle)

A content kind is **data, not a rule**. Adding one is: a table with a `post_id` column, plus one call, `vis.attach('<table>', '<kind>', item_column => 'post_id')`, which registers it, forces RLS and writes the one select policy. No new visibility function, no hand-written policy, no question for Chase. Products may add a **narrowing** hook (Hearth's reply settings); hooks are ANDed, so they can never widen past the post's audience. Full model and SQL sketch: `docs/architecture/07-visibility-model.md`.

### C6. A reusable module, Hearth as a thin layer

Following `packages/messenger` (DEC-42), the core is proposed as `packages/visibility` (`@holroyd/visibility`): a generic `vis` schema template (tenants, members, roles, containers, items, kinds, links), the rule and dispatch functions, `vis.attach`, and the conformance kit (VIS-1, VIS-2, VIS-19, VIS-8's harness). No Hearth words inside. Hearth's migrations instantiate it with four adapter views over `posts`, `post_audiences`, `circle_members` and `space_members`, and two hooks (`group_reply_ok`, `can_see_profile`). `sees_post` stays the engine until the oracle shows `vis.sees_item` agrees on every pair; then `sees_post` becomes a one-line wrapper. Moving the package to a studio-wide repo is Product Studio's call later (an intake).

## The co-parent bridge (anchor feature)

**Why.** Divorced parents today juggle two albums, texts and screenshots, and every share is a small negotiation. Hearth's split is already structural (two family spaces that never touch). The bridge is the one deliberate door between them.

**What a parent sees.** Nothing new to learn. When both homes have opened the bridge, To: shows one more choice under the heading "Other home": one tile with the other parent's face and the words "<their name>'s home" (for example "Dad's home"), so it reads aloud the same way the other side sees it (GUX-VC-R6). Pick it, or don't. The other parent sees that post in their Feed, marked "From Mom's home". That's it.

Words at each bridge moment (GUX-VC-R6, R7; parents only, relatives on either side never see any of these):
- **Who can see it, on a bridged post:** the author's line reads "Only you and Dad can see this" (plus, by name, any other parent in the author's own family, because parents see every post; 05 Limits). The other parent's line reads "Only you and Mom can see this. Your family can't."
- **Replying on a bridged post:** the reply box says, above the field, "Only Mom will read this." (same pattern as REPLY-6/7).
- **Closing:** More → "Stop sharing with Dad's home" → dialog "Stop sharing with Dad's home? He won't see anything you sent there, old posts too." Buttons "Yes, stop sharing" (danger) and "Keep sharing". After: "Stopped. Dad can't see those posts anymore."
- **Setting it up:** not designed yet (GUX-VC-R8). Rule for it: no code to type; an invite-style link the parent sends by text, and the other parent's yes screen names exactly who reads across ("Only you and Mom. Not your family, not hers.").

**What the core guarantees** (07, "Cross-tenant links"): two keys to open, turned by the two parents themselves (both already guardians of that child), never by a family's owner on their behalf; either side closes it alone and at once, silently, and it closes by itself if a parent leaves their family, stops being the child's guardian or deletes their account; only named people read across (v1: the two parents); a new partner or any relative on either side is never a reader unless the other side says yes to that person; nothing crosses unless the author picks it; the reader never sees the other home's groups, members, audience, replies or reactions; their replies go to the author only; re-sharing to their own relatives makes a new post in their own space.

**Phases** (after the beta; Hearth's own family split is among the grandparents, not the parents, so there is no beta tester for this):
- **B1 (v1, small):** two parents, one child, photos and news only, pick "Other home" per post. Close the bridge from More.
- **B2:** shared dates (school, doctor, pick-ups) on the bridge, with "Add to my calendar".
- **B3:** each parent may name one more reader on their own side (a grandparent), only with the other parent's yes.
- **Not planned:** automatic sharing by face or by child tag (A3, and it removes the deliberate choice).

## Catching user error

Before sending (the To: step is unchanged from DEC-73/79):
- Nothing is pre-picked, ever. To: shows people by name; a parent sees group names, relatives never do (0027).
- Before Send, the button names who gets it: "Send to Gammy, Pawpaw and 3 more" ("more", matching SHARE-ST-15's To: line; GUX-VC-R4). Same list as `post_viewers`. The button's words wrap to 2 lines at the largest text; they are never cut off.

After sending:
- **Widen asks, narrow doesn't.** Changing a post's audience to add people shows a dialog: "Gigi and 4 more will now see this. Send to them too?", a "See all 5 names" row that lists them, and two buttons, "Yes, send to them" and "Don't add them" (GUX-VC-R3: a bare Yes/No can't be read aloud over the phone, G3). The server refuses a widening `set_post_audience` without a confirm flag, so no screen can skip it. Narrowing is instant.
- **Take back.** For 2 minutes after Send, the sent confirmation and the post's own card in Feed show the line "Only you can see this for now. Sending in 2 minutes." and a "Take back" button (tinted capsule, 48pt, 17pt+ words; no ticking countdown, A1) (GUX-VC-R2). Tapping it needs no second confirm (it is the undo), shows "Taken back. Nobody saw it.", and reopens the postcard with the same photos and words when the phone still has them, To: empty, so the usual fix (a different To:) is one tap away; if the phone no longer has them, the empty postcard opens with the same line. After the 2 minutes the line becomes the normal "who can see this" names line. On bad signal the 2 minutes start when the post reaches Hearth, and the upload queue's own words show until then. During those 2 minutes only the sender can see the post (a hold time on the post that `sees_post` checks for everyone but the author), so nobody's feed, download link or offline copy has it yet, and notices wait too (the notice cron already runs each minute). Taking back deletes the post before anyone has seen it or been told (PRIV-VC-R8). Holding notices alone wasn't enough: a relative with the app open would see the post and could get a 10-minute download link that "Take back" can't recall. The hold doesn't change the share date used for share-history cutoffs. Parents in the family also wait out the hold. Widening an audience after the hold shows the new people at once (the confirm is the guard there).
- **Nightly check of live data** (no captions or media read): no audience row points at another family's group, no published post lacks an audience, no notice went to someone who can't see the post, no relative can read a group's name. Any hit emails Chase a count, never content.

Not doing: guessing "this looks like the wrong audience" from photo contents (that would mean analysing photos, against A3 and "no AI on media").

## One Share composer

The postcard (DEC-73, DEC-79, SHARE-ST-1..18) stays the one way in. Every kind is **one post** with **one audience**:

| Kind | What's on the card | Stored as |
|---|---|---|
| Photos and videos | Today's card | `posts.kind = 'photos'` + `media_items` (video stays behind `feature_on`) |
| News | Large words, no photo ("Share news") | `posts.kind = 'news'`, caption required, no media |
| Event | What's happening, when, optional place ("Add an event") | `posts.kind = 'event'` + `post_events` row (child of the post, Post class) |
| A saying | A quote card, "kids say the darndest things" style: the words, who said it, their age then ("Add a saying") | `posts.kind = 'saying'` + `post_sayings` row (child of the post, Post class) |

**Open-ended by design (Chase, Nov 24: "flexible for other types - events, announcements, a sayings card").** A new kind is one `posts.kind` value plus, if it needs fields, one child table attached with `vis.attach` (VIS-19): no new visibility rule, no new To: step. The Share start (thread "Redo the Share screen") owns the picker UI; this section is the contract it builds on.

Kind names on screen (thread "Redo the Share screen", Nov 24): **Photos, Event, News, Saying**. Spoken labels: "Add photos", "Add an event", "Share news", "Add a saying". **No helper lines** (Chase: let the design carry it; supersedes GUX-VC-R1's helper lines). The photo postcard stays first; Event, News and Saying sit in a row under it. **Parents only (owner/adult) until the grandparent test passes;** anyone else sees today's card with no change. Text sizes follow the phone's standard (17 body, 22 title). The Share thread owns the exact look; this spec owns kinds, fields and audience.
- Fields: **Event:** "What's happening", "What day" (was "When"; renamed by GUX-SK-R1; the phone's own date picker), "Where (optional)". **News:** one big field, "Your news". **Saying:** "What they said", "Who said it", "Age" (optional, their age then).
- Picking a kind swaps the photo spot for that kind's fields; the note and To: stay. To: comes after the content, nothing pre-picked. A "Start over" button returns to the empty postcard, asking first if anything is typed (GUX-VC-R5).

To: works the same for all three, after the content, nothing pre-picked. Feed shows news as a large-type card (22pt title size), sayings as a quote card, and events as an event card with "Add to my calendar" (opens the phone's own add-event screen, so no calendar permission prompt; GUX-VC-R9); both use the same "who can see this" line, people's names for relatives, never group titles.

Events and life-calendar dates are different things: an event ("Gammy's 80th, Mar 3, at the church") is a post and follows its audience. A life-calendar date (a birthday) belongs to a person and follows `can_see_profile`. Both are registered; neither raises a new question.

### Notices (GUX-VC-R11, P1, TRACKER R89)

Today every new post is announced as "shared new photos" (`notify/index.ts`, `summary()`). Each kind needs its own words before `post_kinds` is on. Rules, same as the photo notice: the person's name as this recipient sees it (`actor_names`, joined by `joinNames`), never a group title; **no words from the post**: no news text, no event title, day, time or place, no saying, no child's name or age (the privacy note at the top of `notify/index.ts`; nothing in the logs). Calm and guilt-free (A1, A2): no "don't miss", no "big", no countdown, no "you haven't seen". Push title stays `From <names> on Hearth` (BETA-NOTIFY-7). Email subject is `<line> on Hearth`; the email body is `<line>.` then the existing "Open Hearth to see/read it" line (20px).

One kind, one or more posts from the same people (`<who>` = `joinNames(actor_names)`):

| Kind | Line (push body starts with it, email subject and first line use it) | Push body ends | Email "Open Hearth…" verb |
|---|---|---|---|
| Photos | `<who> shared new photos` (unchanged) | `. Tap to see them.` | see them |
| News, 1 post | `<who> shared some news` | `. Tap to read it.` | read it |
| News, 2+ posts | `<who> shared some news` (news has no plural; same line) | `. Tap to read it.` | read it |
| Event, 1 post | `<who> added an event` | `. Tap to see it.` | see it |
| Event, 2+ posts | `<who> added <n> events` | `. Tap to see them.` | see them |
| Saying, 1 post | `<who> shared a saying` | `. Tap to read it.` | read it |
| Saying, 2+ posts | `<who> shared <n> sayings` | `. Tap to see them.` | see them |
| Bulk import | unchanged (BETA-BULK-6) | unchanged | unchanged |

Examples: push "From Mom on Hearth" / "Mom added an event. Tap to see it."; email subject "Mom shared some news on Hearth", body "Mom shared some news." then "Open Hearth on your phone to read it."

**Several kinds in one batch:** one line, kinds in the fixed order photos, news, events, sayings, joined like names (", " and " and "): `<who> shared ` + parts, where the parts are `new photos`, `some news`, `an event` / `<n> events`, `a saying` / `<n> sayings`. Push body ends `. Tap to see them.`; email says "see them". Examples: "Mom shared new photos and an event", "Mom and Chase shared new photos, some news and 2 sayings". Subject: "Mom shared new photos and an event on Hearth".

**Replies (same table, so a reply on news isn't called a photo):** `<who> replied to your photos` / `your news` / `your event` / `your saying`; replies across kinds: `<who> replied to your posts`. Posts and replies together: `New posts and replies from <who>` (was "New photos and replies", kept when every post is photos). Push body ends `. Tap to see.` as today.

Length: the longest mixed line with 3+ names ("Mom, Chase and 3 others shared new photos, some news, 2 events and 2 sayings. Tap to see them.", 95 characters) fits the lock screen's two lines on both phones; names keep `headerSafe`'s 40-character cap in the email. The batch needs per-kind post counts from `claim_notification_batches` (counts only, no text).

Confirm with a relative (next UAT): does "shared some news" worry an older reader into expecting bad news (A1)? Fallback if it does: "<who> wrote to the family".

| ID | Type | Given / When / Then |
|---|---|---|
| NOTIFY-K-1 | auto | Given a batch of one news, one event or one saying post, When push and email are built, Then the line, push ending and email verb match the table exactly, and the news text, event title, day, place, saying, child's name and age appear nowhere in title, body, subject, text or html (GUX-VC-R11) |
| NOTIFY-K-2 | auto | Given 2 events or 2 sayings, Then "added 2 events" / "shared 2 sayings" and "Tap to see them." |
| NOTIFY-K-3 | auto | Given photos, news, 2 events and a saying in one batch, Then one line in the fixed order: "shared new photos, some news, 2 events and a saying" |
| NOTIFY-K-4 | auto | Given replies only, on news, an event, a saying, or mixed kinds, Then "replied to your news / your event / your saying / your posts" |
| NOTIFY-K-5 | auto | Given only photo posts (bulk or not), Then today's strings are unchanged (no regression) |

## Phases and acceptance criteria

Build order: 1 and 1b together, then 2, 3, 4; 5 when the 0029 branch merges; 6 (bridge) after the beta.

Each phase is a small PR: qa-tdd red first, then engineer. Migrations are 0031 and up (0029 is the life calendar, 0030 the video fixes on PR #135).

**Phase 1: registry and gate (no behavior change, about 3 sessions)**

| ID | Type | Given / When / Then |
|---|---|---|
| VIS-1 | auto | Given all migrations, When `vis_registry_test` runs, Then every `public` table and storage bucket has exactly one registry row, else it fails naming the table |
| VIS-2 | auto | Given a scratch migration that adds a table without a registry row, When the suite runs, Then VIS-1 fails (the gate is proven to bite) |
| VIS-3 | auto | Given every registered table, When the catalog is read, Then RLS is enabled and forced and no `authenticated` policy is `using (true)` |
| VIS-4 | auto | Given every Post-class table, When `pg_policies` is read, Then each select policy calls `private.sees_post` (directly or via `reply_ok`) |
| VIS-5 | auto | Given every `security definer` row-returning function in `public`, When its body is read, Then it is registered and calls its rule, or sits on the allowlist with a reason |
| VIS-6 | auto | Given `backend/supabase/functions/`, When CI lists it, Then every folder is in the registry |
| VIS-7 | auto | Given the fixture family, When `vis.can_see(u, kind, id)` runs for every user and row, Then it equals the class rule for each |

**Phase 2: oracle across readers (R51, about 3 sessions)**

| ID | Type | Given / When / Then |
|---|---|---|
| VIS-8 | auto | Given a generated family (fixed seed), When every person reads every item through every listed path, Then every answer equals `can_see`; a mismatch prints user, kind, path |
| VIS-9 | auto | Given a post the caller can't see, When asked for through any path, Then the answer is the same as for a post that doesn't exist (P0002 or empty) |
| VIS-10 | auto | Given a published post, When notices are written to the outbox, Then every recipient passes `can_see` at send time, not only at write time |
| VIS-11 | auto | Given the same fixtures, When the app's Fake backend answers, Then it agrees with the oracle |
| VIS-12 | auto | Given the nightly job, When it runs a random seed, Then a dated matrix lands in `backend/tests/results/` |

**Phase 3: catching user error (about 2 sessions)**

| ID | Type | Given / When / Then |
|---|---|---|
| VIS-13 | auto | Given a sent post, When `set_post_audience` adds anyone without the confirm flag, Then it fails `42501 confirm_widen`; narrowing needs no flag |
| VIS-14 | manual | Given Mom widens a post on a real phone, When she taps the new group, Then she sees the new people by name and "Send to them too?" before it changes |
| VIS-15 | auto | Given a post sent under 2 minutes ago, When the notice cron runs, Then no notice goes out; after "Take back" none ever does and the post is gone |
| VIS-16 | auto | Given seeded bad live-shaped data, When the nightly check runs, Then it reports each invariant breach by count only, with no caption, name or URL |
| VIS-17 | auto | Given any To: choice, When the Send button renders, Then it names the same people as `post_viewers` would |
| VIS-25 | auto | Given a post inside its 2-minute hold, When anyone but the author reads it through any path, sign-media included, Then "not found" (PRIV-VC-R8) |

**Phase 4: one composer (about 3 sessions, after grandparent-ux on shots)**

| ID | Type | Given / When / Then |
|---|---|---|
| SHARE-U-1 | auto | Given the empty postcard, When it renders for a parent (owner/adult), Then "Add photos" is the big target and Event, News and Saying sit below it as two stacked full-width rows with their helper lines, each 48pt+, 17pt+, words inside at the largest text (GUX-VC-R1) |
| SHARE-U-2 | auto | Given anyone who is not a parent (can post or not), When Share opens, Then neither Event, News nor Saying is on the page (GUX-VC-R1) |
| SHARE-U-8 | auto | Given news or date picked, When the card renders, Then To:'s hint and the tap hint name that kind's step ("after your words", "after the date"), never "after your photos", and "Start over" returns to the empty postcard, asking first if anything is typed (GUX-VC-R5) |
| SHARE-U-9 | auto | Given a post inside its hold, When its card renders for the author, Then it shows "Only you can see this for now. Sending in 2 minutes." and "Take back"; tapping it shows "Taken back. Nobody saw it." with no second confirm (GUX-VC-R2) |
| SHARE-U-10 | auto | Given a widening change, When the dialog shows, Then its buttons read "Yes, send to them" and "Don't add them" and "See all N names" lists every new person (GUX-VC-R3) |
| SHARE-U-3 | auto | Given any kind, When To: opens, Then nothing is pre-picked and the flow equals SHARE-ST's |
| SHARE-U-4 | auto | Given a news post with words and no media, When published, Then the server accepts it, it has an audience, and VIS-8 covers it |
| SHARE-U-5 | auto | Given an event post, When a person outside its audience reads the feed, calendar or search, Then they get nothing (registry kind `event`, Post class) |
| SHARE-U-6 | auto | Given a news or date post, When anyone in its audience opens Feed, Then they see a large-type card with the "who can see this" names line |
| SHARE-U-7 | manual | Given Mom on her own phone, When she shares a photo, news and a date, Then each takes under 60 s with no help |
| SHARE-U-17 | auto | Given Event, News or Saying picked, When the card renders, Then "Pick who gets it" is enabled only once the kind's required fields hold words (Event: What's happening + When; News: Your news; Saying: What they said + Who said it); the optional ones may stay blank |
| SHARE-U-18 | auto | Given a filled kind card, When "Pick who gets it" is tapped, Then the same who-gets-it picker as photos opens with nothing pre-picked, even with a saved last audience (SHARE-U-3, DEC-73/79) |
| SHARE-U-19 | auto | Given a kind card with a group picked, When Send is tapped, Then exactly one post of that kind is made through createPost with the fields as details and the picked groups, published with no media, and Share returns to the empty postcard; a double tap or a Send again after a failure reuses one client id, so no second post |
| SHARE-U-20 | auto | Given a sent news, event or saying post, When a member of its audience opens Feed, Then they see a large-type card for its kind (news words; event what, when, where; saying quote, who, age) with the "who can see this" names line and no photo frame (SHARE-U-6); a person outside the audience sees nothing |
| SHARE-U-21 | auto | Given the Saying card, When it renders, before sending, Then it shows "Everyone you send this to will see who said it." where screen readers reach it (PRIV-VC-D1; words to grandparent-ux) |
| SHARE-U-22 | auto | Given the server refuses a kind post (42501 post_kinds_off, or 23514 a bad field), When Send fails, Then a plain notice says the words were kept and every word stays in the card (A1); branch on error.code |
| SHARE-U-23 | auto | Given a kind card with the picker open, When it renders, Then every new tap target is labelled and 48pt+ and every text 17pt+ through the named text styles (no raw fontSize) |

**Phase 1b: fungible and reusable** (with Phase 1, about 2 sessions)

| ID | Type | Given / When / Then |
|---|---|---|
| VIS-18 | auto | Given the 0029 life-calendar table, When it is attached as a Person-class kind, Then the oracle covers it with no new rule |
| VIS-19 | auto | Given a throwaway kind (`vis_test_note`, a table with `post_id`), When a test calls only `vis.attach`, Then every user's access equals the post's audience, with no policy or function written for it |
| VIS-20 | auto | Given a product narrowing hook that returns true for everyone, When it is attached to a kind, Then nobody outside the post's audience gains access (hooks only narrow) |
| VIS-21 | auto | Given the generic `vis` template, When grepped, Then it contains no Hearth words (family, circle, post, Gammy, Hearth) |
| VIS-23 | auto | Given a narrowing hook that returns null or raises, When it is attached, Then nobody sees the rows (fail closed); and Given a second permissive select policy added to a Post-class table, Then the gate fails (PRIV-VC-R4) |
| VIS-24 | auto | Given an `authenticated` session, When it calls any function that takes a user id (`sees_post`, `sees_item`, `can_see`) through the API, Then it is refused (PRIV-VC-R3) |
| VIS-22 | auto | Given the oracle fixtures, When `vis.sees_item` and `private.sees_post` are compared for every user and post, Then they agree on every pair (gate for the swap) |

**Phase 6: co-parent bridge B1** (after the beta, only on Chase's go; about 4 sessions)

| ID | Type | Given / When / Then |
|---|---|---|
| BR-1 | auto | Given two family spaces, When only one owner agrees, Then the link is not live and nothing crosses |
| BR-2 | auto | Given a live link, When Mom's post does not name "Other home", Then the other parent can't see it ("not found") |
| BR-3 | auto | Given a post sent to the link, When anyone in either space other than the two named parents asks, Then "not found"; a new adult added to either space later also gets "not found" |
| BR-4 | auto | Given a bridged post, When the other parent reads it, Then they get no group names, audience, member list, replies or reactions from the sender's space |
| BR-5 | auto | Given either parent closes the link, When the other parent asks for any bridged post, Then "not found" at once, past posts included |
| BR-6 | auto | Given the other parent replies on a bridged post, When anyone but the author asks, Then they can't read it |
| BR-8 | auto | Given a bridged post, When the other parent calls `post_viewers`, the feed counts or reads `post_children`, Then they get only the author and themselves, no counts, and only the linked child's tag (PRIV-VC-R5) |
| BR-9 | auto | Given a tenant owner who is not a guardian of the child, When they try to agree to a link, Then it fails "not found"; and Given a parent removed as guardian or from their family, Then the link is closed (PRIV-VC-R6) |
| BR-10 | auto | Given a closed link, When either side opens a new one, Then no item sent to the old link is visible through it (PRIV-VC-R7) |
| BR-11 | auto | Given an ex with no relationship on Hearth, When they enter a wrong or someone else's link code, Then the answer is the same "not found" whether or not the person or family exists, and codes are rate limited like invites |
| BR-7 | manual | Given two parents on real phones, When one sends a photo to "Other home", Then the other sees it with no help and neither side's relatives do |

**Phase 5: life calendar plugs in** (Built Nov 24 in 0032: kind `family_date`, Person class; `backend/tests/vis_calendar_test.sql`): VIS-18 above.

Success signal: VIS-1..12 and VIS-19..22 green on CI for two weeks, and no new feature PR asks Chase "who sees this?". Stop condition: if Phase 1's catalog checks give noisy false failures after 2 sessions, keep VIS-1, VIS-3 and the oracle, and drop the body text checks (VIS-5).

## Out of scope (not now)

- Per-person exclusions ("everyone except Gigi"): a new kind of reach; groups cover it today.
- Changing that parents see every post in their family (by design, 05 Limits).
- Pinning news to the top of Feed; polls; RSVPs on dates; repeating dates.
- End-to-end encrypted posts (the server still reads captions; 04 threat model).
- An outside authorization service: Postgres RLS is the check service; another vendor would break A3's short vendor list for no gain.
- Bulk audience change for past posts.
- Bridge: automatic sharing by face or child tag; more than two homes; a bridge before the beta.
- Creating the `packages/visibility` files or a studio-wide repo now (design only; extraction is a Product Studio intake).

## Design review (grandparent-ux, Nov 24, 2026)

Read from the spec, DEC-73/79, SHARE-ST-10..18 and DS-1..15; nothing measured on a screen yet (no build). Verdict: **Needs changes** for Phase 4; Phases 1 to 2 have no screens.

Fixed in this spec:
- **GUX-VC-R1 (P1):** "parents only" lived only in the persona check; SHARE-U-1 said "someone who can post". Now parents only, stacked rows with helper lines (DS-3, DS-9), SHARE-U-1/2.
- **GUX-VC-R2 (P1, A1):** "Take back" had no words saying the post is held. Added the held line, no countdown, the done line, and reopen-with-same-photos; SHARE-U-9.
- **GUX-VC-R3 (P1, G3):** widen dialog had no button words. "Yes, send to them" / "Don't add them", "See all N names"; SHARE-U-10.
- **GUX-VC-R4 (P2):** "3 others" vs To:'s "2 more". Now "more" everywhere.
- **GUX-VC-R5 (P1):** To: said "after your photos" on news and dates; no way back. Kind-specific hints, "Start over"; SHARE-U-8.
- **GUX-VC-R6 (P2):** sender saw "Other home", receiver "Mom's home". Tile now "Dad's home"; who-can-see words for both sides.

Open:
- **GUX-VC-R7 (P1, with PRIV-VC-R10):** recommend a bridged post can't also go to a relatives' group (To: greys the groups out with "Dad's home posts go only to Dad"). Needs Chase.
- **GUX-VC-R8 (P1, before B1):** bridge setup and the receiving parent's yes screen are undesigned; also whether a re-share to the receiver's family tells the author. Confirm with a co-parent.
- **GUX-VC-R9 (P2):** "Add to my calendar" on Android/web and in email; and news/date posts on the frame (skip words-only posts, or a large-type picture). Decide in Phase 4.
- **GUX-VC-R10 (P2, confirm with a relative):** is "News" (spoken "Share news") the word a parent would use (vs "Share news")? Add to the next UAT session.

## Privacy review (privacy-security, Nov 24, 2026)

Fixed in this spec and 07 (each needs its test when built):
- **PRIV-VC-R1 (P0, ASVS V8.2 / parity):** 07's `sees_item` dropped "still a member of the family" and "published", so a removed author or a parent would see drafts. Rewritten clause for clause from 0011; VIS-22 holds it.
- **PRIV-VC-R2 (P1, ASVS V8.1, deny by default):** the gate read only `public` tables and row-returning functions. Widened to exposed schemas, views, all executable functions, `TO public` policies, grants, Realtime and storage (C3, 07).
- **PRIV-VC-R3 (P0, ASVS V8.2):** `can_see(user, …)` would answer for any user id if exposed. Server-only; VIS-24.
- **PRIV-VC-R4 (P1, ASVS V8.1, VIS-20):** hooks failed open (`coalesce(…, true)`), and a second permissive policy ORs wider. Fail closed, one permissive policy; VIS-23.
- **PRIV-VC-R5 (P0, threat 1, LINDDUN linkability):** clause (B) widens `sees_post`, so today's `post_viewers`, feed counts and child tags would hand the other home's relatives' names, engagement counts and half-siblings to the ex. Rules in 07; BR-8.
- **PRIV-VC-R6 (P1, threat 1/9):** links opened by "tenant owners"; a new partner who started the space could open one. Now the two guardians themselves; auto-close on leaving or custody change; BR-9.
- **PRIV-VC-R7 (P1, threat 4):** reopening a closed link restored past posts. A new link starts empty; BR-10.
- **PRIV-VC-R8 (P1, threat 4, A1):** Take back held notices but not the post: relatives could see it and get a 10-minute signed link. Post held from everyone but the author; VIS-25.

Open (before Phase 6; none block Phases 1 to 4):
- **PRIV-VC-R9 (P1, A2):** R62 (drop `seen_count`) must ship before any bridge, or an author learns whether the ex opened a post.
- **PRIV-VC-R10 (P1, A1, needs Chase plus grandparent-ux):** on a bridged post, do the sender's own relatives' "who can see this" names include the other parent? Showing it tells them about the bridge; hiding it makes the list wrong for them. Recommendation: name "the kids' dad/mom" to the author and parents only, and don't let a post go to the bridge and a relatives' group at once.
- **PRIV-VC-R11 (P2, LINDDUN detectability):** a "not found" from RLS vs a missing row can differ in timing; accepted, same as today (04 Out of scope).
- **PRIV-VC-R12 (P2, threat 9):** the bridge needs a STRIDE/LINDDUN threat model and an abuse path (a parent under a protective order) before B1; legal review is milestone 7, needs Chase.

## Open questions for Chase (only the ones that change your goal)

1. **Go on Phases 1, 1b and 2 now, before the beta?** Recommendation: yes (no screen changes; they replace R51 and make every later feature safe by default). Phase 3 after R62. It's the honest version of "data can't leak".
2. **Add Event, News and Saying to the postcard?** This reopens DEC-79's "one way in". Recommendation: yes, parents only until the grandparent test, because most grandparents can't post anyway.
3. **Co-parent bridge after the beta, and bring back a co-parent persona first?** Recommendation: yes to both. Nobody in the WV beta is a split parent pair, so B1 has no tester before Nov 22; the model and the BR tests are designed now so nothing built before then blocks it.
4. **2-minute "Take back" delays every notice by up to 2 minutes.** Recommendation: yes; a grandparent won't notice 2 minutes, and a wrong send is the worst error we have.

---
Last checked against code: 2026-11-24, migrations 0001 to 0029, 0031 and 0032 (0029 life calendar registered, VIS-18; 0030 is the video-fixes branch, not merged).
