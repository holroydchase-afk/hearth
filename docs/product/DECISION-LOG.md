# Hearth decision log

Every decision that shaped Hearth, with the reason and what we chose it over, in one place. Started Oct 19, 2026 at Chase's ask, rebuilt from the repo, PR history and project memory.

**What it's for.** Telling Hearth's story: paste this file (or one section) into Claude and ask "tell the story of how Hearth's stack came together" or "why did we pick Supabase?". Each entry stands alone so it can be quoted.

**How to add one.** When Chase makes a call, or a thread makes one he approves, add an entry in the same PR, newest at the bottom of its section, with the next free `DEC-n`. Keep each line short. Mark any reason nobody wrote down at the time as *(inferred)*. Don't rewrite an old entry when a decision changes: add a new one that says "Replaces DEC-n" and set the old one's status to "Replaced by DEC-n", so the story keeps its turns.

**Not here.** The full persona checks stay in `docs/product/decisions/` (an entry links to its file). Questions still waiting on Chase live in `TRACKER.md` "Decisions waiting on Chase" (D1–D12); an answered one moves here. Vendor prices and sources are in `docs/eng/research.md`.

Status: **Built** (in `main`), **Decided** (agreed, not built yet), **Replaced** (superseded by a later entry).

---

## Product direction

### DEC-1 · Proof of concept first, milestones by person
- **When / status:** Oct 16, 2026 · Decided
- **Chose:** a proof of concept, a birthday present Chase builds for himself and for job experience. Milestones go by person: Chase, then his wife, then the most tech-savvy relative, then everyone else by savviness, then Android, maybe a smart frame, then decide on costs.
- **Over:** a startup-style plan (Ring 0–3 gates, funding, pricing).
- **Because:** the problems are Chase's own family's; proving it works for them comes before any business question. Funding, pricing, self-hosted auth, pentest and legal wait for milestone 7.
- **Source:** `docs/product/ANCHORS.md` "Milestones"

### DEC-2 · Four anchors every feature is checked against
- **When / status:** A1–A3 Oct 16, A4 Oct 18 · Decided
- **Chose:** A1 Anxiety-less, A2 Guilt-free, A3 Stays on US soil, A4 White-paper ready.
- **Because:** split families need to trust who sees what (A1), and neither side should be able to tell whether the other is engaging (A2). A3 because parents worry about kids' photos leaving the US. A4 because the audience is privacy-minded tech people who will check claims against the code.
- **Source:** `docs/product/ANCHORS.md` "Anchors"

### DEC-3 · Invite-only, no public sign-up or "start a family" in the app
- **When / status:** Oct 16 · Built · "Start a family" part superseded Nov 7 by DEC-55 (joining stays invite-only)
- **Chose:** you join only with an invite code; families are set up by script for now.
- **Over:** an in-app "Start a family" screen (deferred to milestone 7).
- **Because:** keeps Hearth exclusive to people the family trusts (A1), and there is only one family to set up during the proof of concept.
- **Source:** `HANDOFF.md` Oct 16 morning (staff-pm call)

### DEC-4 · Milestone 1 runs fully in Expo Go; push moves to milestone 2
- **When / status:** Oct 17 · Built
- **Chose:** run milestone 1 in the free Expo Go app, with email notices.
- **Over:** paying $99 for the Apple Developer account up front to get push notifications.
- **Because:** Expo Go can't receive push from our server, but everything else works in it. That takes the $99 and Apple's approval wait off the milestone 1 path.
- **Source:** PR #15, `docs/product/MILESTONE-1.md`

### DEC-5 · One to-do list: the tracker
- **When / status:** Oct 17 · Built
- **Chose:** `docs/product/TRACKER.md` is the single list of what's next; every thread updates it in the same PR.
- **Over:** to-dos spread across HANDOFF, REMAINING and thread replies.
- **Because:** Chase follows from his phone between other things; one list means nothing gets lost between threads.
- **Source:** PR #16

### DEC-6 · Persona check before any product decision is final (TDPM)
- **When / status:** Oct 19 · Built
- **Chose:** every product decision gets one Green/Red row per persona, and every Red needs a mitigation or Chase's override. CI enforces it.
- **Because:** test-driven product management, the same idea as writing the failing test first. It catches the grandparent or Android relative a decision would leave behind before it's built.
- **Source:** PR #24, `docs/product/PERSONA-CHECK.md`, `scripts/check-persona-checks.sh`

### DEC-7 · Open source under AGPL-3.0, public after milestone 1 and a final name
- **When / status:** Oct 19 · Decided (PR #26)
- **Chose:** AGPL-3.0, keeping dual licensing possible.
- **Over:** MIT, and a personal or family-only license.
- **Because:** MIT lets someone ship a closed clone; a family-only license isn't real open source. AGPL suits a self-hostable, privacy-first product for dev and product folks, with a hosted plan to pay for it.
- **Source:** PR #26, `docs/product/decisions/2026-10-19-license-agpl.md`

### DEC-27 · Native look: Apple's guidelines on iPhone, Material 3 on Android
- **When / status:** Oct 19 · Built (PR #30; Chase picked "All now")
- **Chose:** follow Apple's Human Interface Guidelines on iPhone and Material Design 3 on Android (system fonts, components, icons, sheets), with Hearth's stricter rules winning where they differ: 17 pt text, 48 pt tap targets, words under every icon, no gesture-only actions.
- **Over:** a custom Hearth look on both phones.
- **Because:** Chase: "go 100% apple UI/UX … that should make it intuitive out of the gate without us guessing." Familiar system screens are easier to explain over the phone, Dynamic Type and screen readers work for free, and the guidelines are guardrails we don't have to invent. Same features, photos and words on both phones; only the look differs.
- **Source:** `docs/product/DESIGN-SYSTEM.md`, `docs/product/decisions/2026-10-19-native-design-system.md`, TRACKER D14

## Stack

### DEC-8 · Expo (React Native, TypeScript) for iPhone, Android and web
- **When / status:** Oct 15 · Built
- **Chose:** one Expo codebase for iPhone, Android and a web viewer, TypeScript strict.
- **Over:** native Swift and Kotlin apps. Flutter was never compared on paper.
- **Because:** one codebase covers the iPhone parents, the Android grandpas and a browser link for relatives who won't install anything. EAS's free tier covers early builds, Expo Push is free, and over-the-air updates reach Chase's phone without a store build. *(Inferred:* TypeScript in the app, the tests and the Supabase functions means one language for a solo builder, and Expo Go let milestone 1 skip the $99 Apple account, DEC-4.)
- **Trade-off:** Expo Go supports only the newest SDK, which drops older iPhones (DEC-22). HEIC and video transcoding need a dev build later.
- **Source:** `docs/eng/research.md` §0, `docs/product/PLAN.md`

### DEC-9 · Supabase (Postgres, Auth, Edge Functions) in East US
- **When / status:** Oct 15 · Built
- **Chose:** Supabase for the database, sign-in and server functions.
- **Because:** access rules live in Postgres row-level security, so "a post you can't see doesn't exist for you" is enforced by the database, not app code. It was the only vendor with an explicit contract clause against training AI on customer data. Free tier for the beta, Pro ($25/mo) before real launch.
- **Trade-off:** Supabase stores logs and telemetry outside the US and contracts through a Singapore entity, so the honest promise is "stored in the US", not "never leaves the US" (DEC-10). Closing that means self-hosted Postgres later.
- **Source:** `docs/eng/research.md` §0 and §4, `docs/architecture/01-system-overview.md`

### DEC-10 · Promise "stored in the US", not "never leaves the US"
- **When / status:** Oct 15 · Decided
- **Chose:** claim only what's true today: database and photos stored in US regions.
- **Because:** Supabase's logs, support access and push delivery through Apple and Google cross borders. The white-paper readers will check.
- **Source:** `docs/product/PLAN.md`, `docs/architecture/01-system-overview.md` "Residency", `docs/product/MARKETING.md` claims register

### DEC-11 · Backblaze B2 (US East) for photos
- **When / status:** Oct 15 · Built (keys pending, tracker step 6)
- **Chose:** Backblaze B2 in US East, behind an S3-compatible layer.
- **Over:** Cloudflare R2 (kept as the fallback, `us` jurisdiction) and Supabase Storage.
- **Because:** B2 storage costs about half of R2's, and family viewing stays inside B2's free download allowance. The region is fixed at account creation, so a US account stays in the US by construction. Supabase Storage charges $0.09/GB to download and caches through a global CDN outside the region.
- **Trade-off:** B2's terms let it use files to "improve" its service, so photos are encrypted before they reach it (DEC-14).
- **Source:** `docs/eng/research.md` §0, §1, §4

### DEC-12 · Resend for email, Expo Push for push
- **When / status:** Oct 15 · Built (Resend live for sign-in codes Oct 18)
- **Chose:** Resend's free tier for sign-in codes and notices; Expo Push for push notices (milestone 2).
- **Over:** Amazon SES (cheaper past about 3,000 emails a month; move then).
- **Because:** Resend is free at family size, simple, and keeps account data in the US. Expo Push is free and holds content only in memory. Notices carry names and counts only, never photos, captions or comments.
- **Source:** `docs/eng/research.md` §0 and §3

### DEC-13 · Deploy through Supabase's Management API, with one token
- **When / status:** Oct 16 · Built
- **Chose:** `deploy.sh` applies migrations, cron jobs and functions through the Management API, needing only `SUPABASE_ACCESS_TOKEN`.
- **Over:** `supabase db push`, `psql` and Docker, which need a database password.
- **Because:** Claude's cloud sessions have no Docker, and a single scoped token is safer to keep in the environment than a database password.
- **Source:** PR #1, PR #2, `HANDOFF.md` Oct 16 afternoon

## Privacy and security

### DEC-14 · Encrypt photos on the phone; server holds the keys (for now)
- **When / status:** Oct 15 · Built
- **Chose:** each photo is encrypted on the phone with its own AES-256-GCM key; the server wraps those keys under one master key (`MEDIA_KEK`). Deleting a post deletes its keys.
- **Over:** plain storage (the vendor could read photos), and full end-to-end encryption for v1.
- **Because:** the storage vendor only ever holds ciphertext, the strongest guarantee available without making key loss a family's problem. End-to-end is the later family vault (DEC-16).
- **Trade-off:** Hearth's server can unlock every photo. We never call this "end-to-end".
- **Source:** `docs/architecture/03-encryption-and-keys.md`

### DEC-15 · Strip location and camera data on the phone, configurable, default strip
- **When / status:** strip Oct 15; policy value Oct 19 · Built
- **Chose:** a media policy with `location: strip | keep | extract`, default `strip`; colour profile kept; 2048 px JPEG for milestone 1.
- **Because:** a kid's photo shouldn't reveal where they live (A1). Chase asked for configurable infrastructure so location features can come later without rework. Colour profile kept so photos look as they did on the iPhone. 2048 px loads on one bar of LTE; full size is one value later.
- **Source:** `docs/product/SPEC-MEDIA.md` D2, D6, D7; `docs/product/decisions/2026-10-19-media-*.md`

### DEC-16 · Family vault (end-to-end encryption) later, as a higher tier
- **When / status:** Oct 17 · Decided, after the beta
- **Chose:** an opt-in end-to-end encrypted vault as a later, paid tier, rolled out slowly.
- **Because:** real end-to-end makes key loss permanent and blocks server features like search; families should choose it knowingly. Smaller steps (per-family keys, a "what Hearth can see" page) come first.
- **Source:** PR #14, `TRACKER.md` "Privacy path"

### DEC-17 · No third-party analytics, crash or ad SDKs
- **When / status:** Oct 16 · Built
- **Chose:** our own error-report table with fixed fields only, kept 30 days.
- **Over:** Sentry, Crashlytics or any analytics SDK.
- **Because:** no media or metadata goes to any analytics service (CLAUDE.md rule 2), and the claim "no trackers" has to be checkable in the code.
- **Source:** migration 0006, `docs/architecture/01-system-overview.md`

### DEC-18 · AI off by default, every feature behind an off-switch
- **When / status:** Oct 17 and Oct 18 · Decided; "over a paid AI tier" replaced by DEC-37
- **Chose:** each AI feature is a family add-on a parent turns on, with a Hearth-wide kill switch and per-role permission. Any in-picture analysis runs on the phone only. Nothing on family media is ever used for training.
- **Over:** AI on for everyone, or a paid AI tier. *(The paid-tier part is replaced by DEC-37, Oct 23.)*
- **Because:** "no AI on our kids' photos" is a reason families pick Hearth. Small quiet helpers (bulk-upload audience suggestions, duplicates) are welcome only if they can be switched off and never act without asking.
- **Source:** `docs/product/AI-FEATURES.md`, `/mnt/project-files/plans/v1-groups-plan.md`

### DEC-31 · AI positioning: on-device only, opt-in (option B)
- **When / status:** Oct 19 · Decided; build waits on Chase's go (`AI-FEATURES.md` "Build plan")
- **Chose:** the public promise moves from "no face scanning, tagging or ML of any kind" (CF-10) to "AI is off until your family turns it on. Then it runs only on your phones, and your photos never train anyone else's AI."
- **Over:** A, no ML anywhere (loses duplicates, best shot, people suggestions); C, server-side AI under a no-training contract (breaks Never build #3 and the simple story).
- **Because:** Chase's top AI asks (people → group suggestions, duplicates) need in-picture analysis, and on-device keeps the photo on the phone (A3). The wording leaves room for a personal model that learns only on a family's own phones (AI-8), which Chase wants kept possible.
- **Trade-off:** "No AI at all" was easier for a tech reader to check, so a CI allowlist for ML libraries (AI-P0.1) comes first. Face features still need privacy-security and a legal read (Illinois BIPA) before they're built.
- **Source:** `docs/product/decisions/2026-10-19-ai-on-device-opt-in.md`, TRACKER D6

### DEC-37 · Free, open base; AI is a paid subscription
- **When / status:** Oct 23 · Decided; the gate is built in AI-P0.2. Replaces DEC-18's "over a paid AI tier"
- **Chose:** Chase: "I want the base to be free and open and the ai to be paid." Every AI feature, built or planned, checks a separate AI subscription for the family, apart from the storage plan (CF-26) and the vault. Defaults Claude picked, open to Chase: the no-model photo helpers stay free, and AI code stays open source (AGPL). The subscription is sold on Hearth's hosted service, and self-hosters run it free.
- **Over:** AI free inside the family plan; AI code in a closed module (open core).
- **Because:** the base (posting, groups, the co-parent link, grandparents) is the wedge and must spread without a paywall. AI is the clearest extra a parent will pay for. Keeping the AI code open keeps the AGPL and developer-edition story simple and lets a tech reader check the on-device promise.
- **Trade-off:** on-device AI costs Hearth almost nothing to run, so the price buys convenience, updates and model downloads, not compute. A self-hoster gets AI free. Apple and Google require their in-app purchase for this subscription.
- **Source:** `docs/product/decisions/2026-10-23-ai-paid-tier.md`, `AI-FEATURES.md` AI-R8 and AI-P0.2

## Sharing and the people model

### DEC-19 · Plain groups, no required family shape
- **When / status:** Oct 18 · Decided (building)
- **Chose:** a group is a plain list of people; anyone can be in several groups. Events copy people in from groups once.
- **Replaces:** the Oct 17 fixed shape (Everyone, sides, households, events; migration 0011).
- **Because:** real split families don't fit one hierarchy (Mom's sister belongs in two houses). Plain groups cover every case with less to explain.
- **Source:** `/mnt/project-files/plans/v1-groups-plan.md`, PR #22

### DEC-20 · Who reads a comment: three settings per group
- **When / status:** Oct 16 → Oct 17 → Oct 18 · Decided (building)
- **Chose:** each group is **Private** (parents, the poster and the writer read it), **Shared on this group's posts**, or **Always shared**. Readers are fixed when the comment is written, and the comment box names them.
- **Replaces:** everyone on the post reads every comment (Oct 15), then parents-only by default (Oct 16, migration 0009), then by household (Oct 17).
- **Because:** the story's core worry: one grandparent's comment shouldn't land in front of the other side of the family (A2). Two "shared" values so a birthday group's chatter doesn't spill onto Everyone posts.
- **Source:** `/mnt/project-files/plans/v1-groups-plan.md`, `docs/product/SPEC-GROUPS.md` §6

### DEC-21 · Hearts, comments and per-photo reactions; drop "Seen by"
- **When / status:** Oct 19 · Decided (proposed resolution awaits Chase's OK)
- **Chose:** per-photo heart, comment and a fixed set of emoji; remove "Seen by N of M".
- **Because:** a returned heart proves the photo arrived without counting who didn't look (A2). Emoji sit behind a worded "More" button so the heart stays one tap.
- **Source:** `docs/product/decisions/2026-10-19-reactions-drop-seen-by.md`

### DEC-26 · Built-in messenger, end-to-end encrypted with MLS
- **When / status:** Oct 19 · Built (PR #29; hosted deploy and on-phone check pending)
- **Chose:** group and event chat inside Hearth, encrypted end to end with MLS (RFC 9420, the IETF group-chat standard), using the pure-TypeScript ts-mls library on Hearth's own noble crypto so it runs in Expo Go.
- **Over:** linking out to Signal (every relative would need to install Signal), and Signal's open library, libsignal, on our own servers.
- **Because:** Chase wanted a built-in messenger ("maybe we use Signal"). Signal's network has no API for other apps. MLS is built for groups, removing someone is cheap, and the same group keys can later protect the family vault (DEC-16). A chat belongs to one group or event, so nobody can message someone they can't see, and there are no read receipts, typing dots or last-seen (A2).
- **Trade-off:** it widens milestone 1 against the Oct 17 focus; Chase chose that knowingly and it sits behind a Messages button. An outside audit and safety numbers are still open.
- **Source:** `docs/product/decisions/2026-10-19-messenger-mls.md`, `docs/product/SPEC-MESSENGER.md`, `docs/architecture/06-messenger.md`, TRACKER D13

## Engineering practice

### DEC-22 · Expo SDK 57, and versions only from the vendor's live page
- **When / status:** Oct 18 · Built
- **Chose:** SDK 57, plus a CI check that our SDK matches what App Store Expo Go runs.
- **Because:** SDK 54, picked from memory, wouldn't open in Expo Go on Chase's iPhone. Rule since: look versions up live, and a build is ready only once a phone opened it.
- **Trade-off:** SDK 56+ needs iOS 16.4, so iPhone 7, 6s and SE (1st gen) can't run Hearth.
- **Source:** `docs/eng/LESSONS.md` Oct 18, PR #24

### DEC-23 · Test first, with the ticket ID in the test's name
- **When / status:** Oct 15 · Built
- **Chose:** a failing test first, then the fix; the full suite runs 3 times before anything is called done.
- **Because:** privacy bugs (a relative seeing the other household's posts) must be caught by a test, not by a grandparent. On day 2 it found 10 prototype bugs and 7 backend holes.
- **Source:** `CLAUDE.md` rule 1, `docs/product/PLAN.md` "Day 2"

### DEC-24 · The app talks to one contract with a real and a fake backend
- **When / status:** Oct 15 · Built
- **Chose:** a `HearthApi` interface with a Supabase and a Fake implementation; the backend exposes a small set of Postgres functions (RPCs) instead of raw table access.
- **Because:** screens can be tested fast without a server, and contract tests prove both sides agree. RPCs keep every access check in the database.
- **Source:** `docs/eng/API.md`, `app/src/api/`

### DEC-25 · Claude merges only on Chase's word, with merge commits
- **When / status:** Oct 17 · Built
- **Chose:** a PR merges only when Chase says so and CI is green; no rebases or force-pushes.
- **Because:** Chase is the only human reviewer, and merge commits keep every thread's branch valid.
- **Source:** `docs/eng/MERGING.md`

### DEC-28 · Freeze lifted; a review-driven sequence to milestone 2
- **When / status:** Oct 21 · Decided
- **Chose:** the Oct 19 build freeze ends now that the app is on Chase's phone. The staff PM, UI/UX, engineering and security lanes reviewed the app from the code, and one ranked list (`TRACKER.md` "Sequence to milestone 2") replaces ad-hoc picks. A recurring 2:15am run works it night after night.
- **Over:** building the next feature from the ideas log.
- **Because:** Chase's bar is "a world class, very fast, very stable product". Measuring and ranking first keeps the work on what Mom (M2) will feel.
- **Source:** `docs/product/reviews/2026-10-21-app-review.md`

### DEC-29 · Speed architecture A1 to A4; no-model photo helpers specced now
- **When / status:** Oct 21 · Approved (A2 built Oct 21)
- **Chose:** A1 native encryption in the app's own build, JavaScript in Expo Go; A2 parallel sending and preparing the next post during upload; A3 Photos kept on the phone (encrypted files, keys in the keychain); A4 resumable video uploads. Spec AI-2 duplicates and AI-4 screenshot and blurry-photo filtering, with no model.
- **Over:** staying all-JavaScript and serial until a native build exists.
- **Because:** measured: JavaScript encryption takes about 370 ms per photo with no JIT (Hermes's situation), and serial requests waste round trips on weak signal. Expo Go can't load native modules, so A1 ships behind a switch.
- **Source:** `docs/product/decisions/2026-10-21-speed-architecture.md`, `docs/eng/PERFORMANCE.md`

### DEC-30 · Drop R6 (hide the reply box behind a button), keep it in mind
- **When / status:** Oct 21 · Decided by Chase ("yes we can drop R6, but keep it in mind")
- **Chose:** keep the reply box and its "who will read this" line on every card.
- **Over:** a "Write something back" button that opens the box and asks the server for readers only then (RV-P3, RV-U4).
- **Because:** the button adds a tap for the least tech-savvy relative (LG Red), REPLY-11 needs the readers line whenever the box shows, and list windowing already caps the extra server calls at about 10 cards. Revisit if phone timings show the calls hurt.
- **Source:** `docs/product/reviews/2026-10-21-app-review.md` (RV-P3, RV-U4), TRACKER R6

### DEC-32 · M1 "green 3× on hosted" means CI's 3 green runs plus a read-only hosted smoke check (D1)
- **When / status:** Oct 23 · Decided by Chase (power hour)
- **Chose:** count CI's three green runs on a real Supabase stack, plus `smoke-check.sh` read-only against hosted.
- **Over:** wiping hosted and running the full suites there (needs `SUPABASE_DB_URL`).
- **Because:** no extra secret, nothing wiped, and the same suites already run on a real stack in CI.
- **Source:** TRACKER D1

### DEC-33 · Refresh the staff-pm agent after milestone 1 (D2)
- **When / status:** Oct 23 · Decided by Chase (power hour); work waits on M1
- **Chose:** a reviewed PR that updates staff-pm for the milestones, "groups" wording, a not-doing list and the files it owns, once milestone 1 is behind us.
- **Over:** refreshing it now, mid-milestone.
- **Source:** TRACKER D2

### DEC-34 · Thanksgiving (Nov 26) stays a soft target for milestones 3 and 4 (D5)
- **When / status:** Oct 23 · Decided by Chase (power hour)
- **Chose:** keep it as a planning target, not a gate.
- **Because:** Hearth is a proof of concept first; dates guide the order of work, they don't force shortcuts.
- **Source:** TRACKER D5

### DEC-35 · The family vault answers the "personal server" question, for now (D7)
- **When / status:** Oct 23 · Decided by Chase ("I don't think we will go with personal server but maybe. I like family vault for now.")
- **Chose:** the family vault (end-to-end encrypted, a later, higher tier; DEC-16) is the plan for a family that wants its own locked store.
- **Over:** a separate personal server per family, run in the US. Not ruled out: Chase said "maybe", so it stays in the ideas log.
- **Source:** TRACKER D7, `docs/product/ANCHORS.md` ideas log

### DEC-36 · Notices name the sender for the beta; "hide names" later (D9)
- **When / status:** Oct 23 · Decided by Chase (power hour)
- **Chose:** keep "From Chase on Hearth" (BETA-NOTIFY-7) in push and email; add a "hide names" setting after the beta.
- **Over:** notices that say nothing about who sent them.
- **Because:** a known name is what makes a grandparent trust and open the notice (LG, GG). Notices never carry captions, photos or the audience.
- **Source:** `docs/product/decisions/2026-10-23-notice-sender-names.md`, TRACKER D9

### DEC-38 · Love, Haha, Like and Comment as icons with no words (REACT-7)
- **When / status:** Oct 25 · Decided by Chase (thread "Moments feed redesign")
- **Chose:** four icon-only buttons on each moment (❤️ 😂 👍 💬), one reaction per person, counts per kind.
- **Over:** one worded Love button and a worded Comment button (MOMENT-3), which DS-3 and rule 3 asked for.
- **Because:** Chase wants the row to look like the photo apps relatives already use. Screen readers still hear each name; the LG and FA Reds are his override.
- **Source:** `docs/product/decisions/2026-10-25-reactions.md`, PR for migration 0017

### DEC-39 · Post titles and captions: one set of words per post, editable, encrypted later (CAP-D1..D4)
- **When / status:** Oct 28 · Decided by Chase ("picks ok"); not built yet (freezes lifted Oct 28)
- **Chose:** an optional title and caption for the whole set (CAP-D1); the sender can change them after posting (CAP-D2); the words stay plaintext until the family vault (CAP-D3); the Title box shows, marked optional (CAP-D4).
- **Over:** a caption per photo; delete and repost (BETA-SPEC); encrypting the words now; a hidden "Add a title" button.
- **Because:** per-photo boxes turn a 48-photo send into 48 questions for LG; reposting loses comments; encrypting now blocks caption search; a labeled box is easier to skip than a button to find.
- **Source:** `docs/product/SPEC-CAPTIONS.md`, `docs/product/decisions/2026-10-27-post-titles-captions.md`, TRACKER R21

### DEC-40 · Bleeding-edge pick: home-screen photo frame first; plan the family vault next (FRAME-*)
- **When / status:** Oct 29 · Decided by Chase ("Start with 1"; then "I also want a plan for 2"); specced, not built
- **Chose:** (1) a home-screen photo frame widget, plus a send-progress Live Activity for posters, after milestone 2's real build; (2) a day-by-day plan for the family vault on MLS (`PLAN-FAMILY-VAULT.md`), timing still per DEC-16.
- **Over:** an on-device AI audience guard (paid tier; blocked on the face-scanning claim), and starting the vault build now.
- **Because:** the frame is the cheapest of the three, and grandparents see it with zero taps (STORY problem 3). The vault is the long-term moat and reuses the messenger's MLS.
- **Source:** `docs/product/SPEC-PHOTO-FRAME.md`, `docs/product/decisions/2026-10-29-photo-frame.md`, `docs/product/PLAN-FAMILY-VAULT.md`, TRACKER R23, R24

### DEC-41 · Photos refresh on their own; sort uses the system icon (UI-26)
- **When / status:** Oct 26 · Decided by Chase (thread "Review latest build UI")
- **Chose:** no "Check for new photos" button (auto-refresh on open and return, plus pull-down); "By date" with the system sort icon beside Messages in one row.
- **Over:** a worded refresh button and two header rows (R11).
- **Because:** Chase didn't understand the refresh button and wants common system icons where they're universal. The first photo comes a row sooner.
- **Source:** `docs/product/decisions/2026-10-26-photos-refresh-sort.md`

### DEC-42 · The messenger becomes a shared AGPL library (STU-DEC-1)
- **When / status:** Oct 26 · Decided by Chase (Product Studio STU-DEC-1, license on Oct 26; built the same day on his word)
- **Chose:** move the MLS engine and ciphersuite into `packages/messenger` (`@holroyd/messenger`), with three plug points (Relay, Roster, Store) and a Supabase relay template. It's licensed AGPL-3.0-or-later, copyright Chase, with its own LICENSE file and SPDX headers. Hearth uses it through a thin adapter. Crew Clock is the second user.
- **Over:** a standalone messenger product (it would need push, multiple devices, safety numbers and an outside audit first); Apache-2.0 (Product Studio's first draft); waiting until after the beta.
- **Because:** Chase wants one messenger across his products. A library with one home costs little now and keeps Hearth's behavior unchanged; the AGPL keeps every product that uses it open.
- **Source:** pm-tools `DECISIONS.md` STU-DEC-1, `packages/messenger/README.md`

### DEC-43 · Words pass on titles, changing words, Messages and Share (WORDS-1..4)
- **When / status:** Oct 29 · Night shift, under "Decisions to review" (Chase to confirm)
- **Chose:** grandparent-ux's four word fixes: the caption hint names "the groups you pick", a refused edit says the old words are kept, "Not even Hearth can read it" in Messages, and the group count moves onto the names line. Persona check `decisions/2026-10-29-words-pass.md`.
- **Over:** keeping "(Grandma will see this)" (untrue for one-side posts), the generic "You can't do that here.", and "Name · 3 people" titles that wrap at large text.
- **Because:** every "who sees it" line must be true (A1), and a refusal must not make the least-savvy grandparent think they broke something.
- **Source:** `docs/product/decisions/2026-10-29-words-pass.md`

### DEC-44 · Hearth's files say AGPL-3.0-or-later (LIC-1..3)
- **When / status:** Oct 31 · Claude's default on Chase's "also do the AGPL work"; Chase can switch to -only before the first outside contribution
- **Chose:** `SPDX-License-Identifier: AGPL-3.0-or-later` plus Chase's copyright on every source file, and in `app/package.json`, matching the messenger library (DEC-42). Persona check `decisions/2026-10-31-license-or-later.md`.
- **Over:** AGPL-3.0-only (would differ from the library in the same repo) and no per-file headers (the license only in the root file).
- **Because:** one license string everywhere is clearer for tech readers and tools; -or-later is the FSF's recommended form; Chase still owns all the code, so dual licensing stays possible (DEC-7).
- **Source:** `docs/product/decisions/2026-10-31-license-or-later.md`

### DEC-45 · The demo uses the studio demo bar; Grandma's view moves into its drawer (DEMO-BAR)
- **When / status:** Oct 31 · Chase's call for every studio demo ("one standard", pm-tools DEMO-BANNER.md), filed to Hearth as intake #82; the Hearth-specific placement is Claude's default
- **Chose:** the slim Demo bar with a push-down Details drawer, drawn in Hearth's own kit at Hearth's 17 pt and 48 px floors; the "See it as Grandma Jo" switch sits first in the drawer, with one tip line on the phone's Photos pointing to it.
- **Over:** keeping the three-chip bar (ux-reviewer 5/10, its own look per demo) and keeping the Grandma chip on the collapsed bar (breaks the standard's one-row layout at 390 px).
- **Because:** the same bar on every demo reads as one studio; the drawer keeps the app in view; the tip keeps Hearth's key feature findable on a phone. Demo build only, so relatives never see it and no persona check applies.
- **Source:** intake #82, `docs/reviews/2026-10-31-demo-bar.md`

### DEC-46 · The family's owner turns the photo helpers off and on from Me (HELP-R6)
- **When / status:** Oct 31 · Night shift, under "Decisions to review" (Chase to confirm)
- **Chose:** a "Photo helpers" card on Me, owner only, with two family-wide switches in grandparent-ux's words. No migration: the owner already had write access to `space_features` (0013). Persona check `decisions/2026-10-31-photo-helpers-switch.md`.
- **Over:** leaving it as a database row (Chase can't change it from his phone), and a per-person switch (more to explain; the spec's control model is family-wide, DEC-18).
- **Because:** the helpers set photos aside, so the person who set the family up must be able to stop that in one tap (A1, A2).
- **Source:** `docs/product/decisions/2026-10-31-photo-helpers-switch.md`

### DEC-47 · Light or dark screen, one warm palette, Atkinson Hyperlegible (DS-10..12)
- **When / status:** Nov 1 · Asked for by Chase ("We need a dark and light mode", "fix the color scheme across the board")
- **Chose:** a "Light or dark screen" choice (Same as my phone by default) on Help and Me, and one warm palette on every phone with 7:1 body text, solid gray waiting buttons, and the card color for the reply box and demo bar. Font: Atkinson Hyperlegible Next in Regular, Medium and SemiBold only (Chase picked it from three on his phone). Persona check `decisions/2026-11-01-light-dark-colors.md`.
- **Over:** following the phone only (no way to pick); each phone's own system colors (cold grays, pure black, see-through disabled buttons); Apple's rounded font or the phone's own font.
- **Because:** Chase found the old colors rough on his own iPhone; one warm palette reads as Hearth, not as a settings screen, and older eyes get more contrast. Atkinson was made for low-vision readers, and dropping Bold answers his "too bold".
- **Source:** `docs/product/decisions/2026-11-01-light-dark-colors.md`

### DEC-48 · Threads merge their own non-live PRs on green
- **When / status:** Nov 2 · Chase's call on a decision card ("Yes, studio rule"), from intake #91
- **Chose:** docs, tests, CI and agent-file PRs merge on green without asking, by the thread that owns them, oldest first, with merge commits. Anything touching the app, the live demo (`app/**`, `packages/**`, the Pages workflow) or the backend still waits for Chase. See `docs/eng/MERGING.md`.
- **Over:** every merge on Chase's word (green PRs piled up waiting on him) and merging everything on green (the live demo and app would change without him seeing it).
- **Because:** Chase's time goes to calls only he can make; process PRs can't hurt a relative or the public demo. Process rule, no user sees it, so no persona check.
- **Source:** intake #91, studio-agents `docs/studio-standard.md`

### DEC-49 · Every post names who can see it; only parents see group names (WHO-1..9)
- **When / status:** Nov 4 · Asked for by Chase ("I don't really want anyone to know they are in a group… do not have the title of the group visible to anyone but the parents/admins, because gparents dads side is offputting")
- **Chose:** a muted line on every card, for everyone but the sender, naming the people who can see it ("You, Alex, Chase and 2 others can see this"), and the full list under More. The sender keeps "Sent to" with the group's name. Server: `post_viewers` (migration 0022), built on `sees_post`. Persona check `decisions/2026-11-04-who-can-see-by-name.md`.
- **Over:** "Shared with you" only (a grandparent couldn't tell who else sees her photos or her replies' audience); showing the group's name to everyone ("Grandparents – Dad's side" reads as a label on the person); a banner or pop-up (one more thing to dismiss, A1).
- **Because:** knowing who else is looking is what makes sharing feel safe (A1), and names are how a family thinks about it; group names are the parents' filing system, not something relatives need.
- **Source:** `docs/product/decisions/2026-11-04-who-can-see-by-name.md`

### DEC-50 · Three colors to pick from, faces for who can see it, the phone's own emoji (COLOR-1..4, WHO-10, REACT-11)
- **When / status:** Nov 5 · Asked for by Chase ("I'd like all three color options"; "a contact circle component or chips... a discreet icon"; "the standard not 3d emojis not line icons")
- **Chose:** Ember (default), Sage and Plum, light and dark, under "Colors" on Help or Me; small initial circles under the photo that open a sheet of name chips; the phone's own emoji with chat-style count chips.
- **Over:** one fixed palette; the names sentence under every date; REACT-10's line icons.
- **Because:** Chase didn't like the blue and liked all three; the circles keep DEC-49's names but quieter; a grandparent's keyboard emoji are the ones she already knows.
- **Source:** `docs/product/decisions/2026-11-05-colors-faces-emoji.md`

### DEC-51 · Add 🎉 Hooray as a fourth reaction (REACT-12)
- **When / status:** Nov 5 · Chase: "add" (🎉 alongside ❤️ 😂 👍, not replacing one)
- **Chose:** a fourth button and count chip, migration 0023 widening the server's list.
- **Over:** replacing ❤️; an open emoji picker.
- **Because:** a cheer fits birthdays and firsts; a closed list keeps the reply rules and HARD-12 simple.
- **Source:** `docs/product/decisions/2026-11-05-hooray-reaction.md`

### DEC-52 · Compact Photos toolbar, Hearth's tab bar on iPhone, quieter reaction and who-can-see (LIVE-1..4)
- **When / status:** Nov 5 · Chase in a live review on his iPhone ("Messages should be a single icon so should filters"; "Yes" to toning down the picked ❤️ and labeling the circles)
- **Chose:** icon buttons with a word under each, in a toolbar above the title; Hearth's own tab bar on iPhone because the glass bar overlapped 17 pt words; a soft fill for my reaction; "Can see" before the circles.
- **Over:** icon-only buttons; shrinking tab words to iOS's 10 pt; the half-width pills.
- **Because:** the actions are everyday ones and the pills pushed photos down; DS-2 and DS-3 keep every word readable.
- **Source:** `docs/product/decisions/2026-11-05-live-review-header-tabs.md`

### DEC-53 · Picture replies and a GIF shelf in comments (GIF-1..4)
- **When / status:** Nov 6 · Chase picked "Picture reply + GIF shelf" on the decision card (from his Nov 5 ask: "memes and gifs in the comments... slack meets instagram")
- **Chose:** a picture or GIF from your own phone on any comment, plus a bundled shelf of reaction GIFs; pictures follow the reply rule. Built after the Nov 22 beta.
- **Over:** GIPHY search now; parking it until after the beta.
- **Because:** the fun of Slack and Instagram replies without sending searches or views to an outside service (A1, A3); it reuses the photo pipeline.
- **Source:** `docs/product/decisions/2026-11-06-gifs-in-comments.md`

### DEC-54 · Fix the Apple design guidelines gaps (HIG-1..12)
- **When / status:** Nov 6 · Chase, after the sweep (doc https://claude.ai/artifact/3N1G5jF4ezeQ2Gtf2jFwZU): "handle all the p1s, handle 1,6,8,4,etc"
- **Chose:** ask for notices after the first photo with a Hearth card; zoom; capped tab words; warm launch screen; iPad in every direction; Increase Contrast, Reduce Motion, VoiceOver sender, swipe-down sheets, bigger icons, haptics.
- **Over:** waiting until the App Store build; words under the emoji (Chase picked "Keep emoji only" on the Nov 6 card; REACT-7 stands).
- **Because:** each was a gap against Apple's own rules that an older user or a reviewer would hit first; the cold notice prompt can't be undone from far away.
- **Source:** `docs/product/decisions/2026-11-06-apple-guidelines-fixes.md`

### DEC-55 · A "Start a family" screen before the beta; joining stays invite-only (BETA-START-1..9)
- **When / status:** Nov 7 · Chase picked "Yes, build it now" on the decision card · Specced, not built
- **Chose:** a signed-in parent with no family names one, keeps Everyone or adds two sides, and invites one person, through one `start_family` RPC; one family per account; a server switch can close it.
- **Over:** DEC-3's Not now (milestone 7, only Chase starts a family by script); an allowlist only Chase could fill.
- **Because:** level 5 of the recruiter-readiness bar needs someone other than Chase to start and use Hearth unaided. Sign-up and the create RPCs were already open; joining, the real guard, is unchanged.
- **Source:** `docs/product/decisions/2026-11-07-start-a-family.md`, `docs/product/SPEC-START-FAMILY.md`

### DEC-56 · Plain-word photo search before go-live (SEARCH-1..14)
- **When / status:** Nov 10 · Chase listed "Search" as go-live item 9 · Built locally (migration 0025), not pushed (GitHub hold)
- **Chose:** a Search screen that matches typed words against a post's title, caption and sender's name, plus "From" a person and "Taken in" a year, inside the timeline's own visibility rule. No AI, nothing typed is stored.
- **Over:** the Oct 17 "no search box in the beta" call (Pick a year and From [person] only); AI or face search, which belongs on the paid tier (DEC-37) and would send media to a model.
- **Because:** Chase wants it for go-live; captions are plaintext columns, so it is cheap and stays in Postgres in the US. Encrypting captions later would end it (TRACKER).
- **Source:** `docs/product/decisions/2026-11-10-photo-search.md`, `docs/product/SPEC-SEARCH.md`

### DEC-57 · Text message codes are the default sign-in, behind a switch, for M4 (BETA-SMS-1..17)
- **When / status:** Nov 10 · Chase put SMS sign-in on his go-live list (item 8) and asked for it to be built now; first asked Oct 18 ("I want texts to be the primary and default way folks receive their OTP.") · Specced, not built; ships off until a provider and US carrier registration exist
- **Chose:** mobile number first with "Use email instead"; US numbers only; the same 6-number code screen; phone and email stay separate accounts in this pass; phone-only accounts get push, not email notices; an app flag keeps today's email-only screens until Chase has a provider. Stop date: carrier registration not approved by Nov 18 means the beta runs on email.
- **Over:** D11's "keep email for milestones 1 and 2" (now superseded for M4); email as the only sign-in; linking phone and email on one account (deferred).
- **Because:** a WV grandparent finds a text faster than an email in a junk folder (A1, G2); the switch means no relative ever sees a half-working text sign-in.
- **Source:** `docs/product/decisions/2026-11-10-sms-sign-in.md`, `docs/product/SPEC-SMS-SIGN-IN.md`; the provider pick is the architect's (spec §6)

### DEC-58 · Hearth opens on "New for you" (OPEN-1..12)
- **When / status:** Nov 11 · Chase picked C from four sketches ("Go with C and all your recommendations")
- **Chose:** a New for you card on Photos (a collage of what came in since your last visit, one "See the new photos" button) that walks the new posts one at a time; a Wall button for the photo wall; the posts list stays underneath.
- **Over:** the photo wall as the front door (tiles hide who sent and who can see; small faces); one photo at a time as the front door (slow for parents); Photos as it was.
- **Because:** the gallery feel on open without losing names, who can see, Hooray or comments; one button for the oldest relatives.
- **Source:** `docs/product/decisions/2026-11-11-opening-screen.md`

### DEC-59 · Redesign: black and white, one family accent, Gallery first, tabs Gallery/Share/Feed/More (RD-1..33)
- **When / status:** Nov 14-15 · Chase: "Follow Apple to the T, black and white and an accent"; picked look B with Search and By date top right; "I don't want giant buttons anywhere except when it's intentional like a big delete"; "Go with the 4 new chip on the pic"; "Make the color a variable that can be set in the admin"; "Go Claude go" · Specced; phase 1 app-only in three PRs (1a look, 1b getting around, 1c Gallery), phase 2 after the beta
- **Chose:** the phone's own font (Regular and Semibold; Bold only for the large title), white and true black, outline icons, one accent token (Ember `#B23A1E` / `#FF8A65`) used only on the main tap word, the picked tab and the new-message dot; a "Good morning, <name>" large title that collapses on scroll; Search and By date as the only top-right items; Gallery (the month grid) as the start screen with New for you photo tiles and a solid "N new" chip plus "Tap a photo to start"; tabs Gallery, Share (middle), Feed, More; More as a full-screen menu; no large filled buttons except Delete, Leave, first-run setup and Post; the family's owner picks the color (phase 1 on the owner's phone only via `prefs.color`; phase 2 a `spaces.accent` column for everyone).
- **Over:** look A (all Apple blue; See 4 new doesn't stand out), look C (no color; the picked tab and dot are hard to spot), the other three New for you options (header link, capsule, photo plus row), a fixed Ember with no picker (the mockup's advice), Tailwind, keeping the warm look.
- **Overrides:** DS-3 detail (the toolbar row above the title goes; top right holds only Search and By date), DS-7 (tabs Gallery, Share, Feed, More; Photos, Me and Help leave the tab bar; Feed is Chase's word), DS-9 (no one filled main button per screen; deliberate ones only), DS-11 (white and true black, not warm off-white and charcoal; accent no longer on every link and icon), DS-12 (system font replaces Atkinson Hyperlegible Next, DEC-47), DS-13 (corners 12 rows and photos, 14 dialogs, square grid; no cards in cards), COLOR-1 and DEC-50 (no per-person Ember/Sage/Plum picker; owner-only Family color: Ember, Forest, Plum), DEC-58 parts: OPEN-2 (a number is now shown, "4 new"), OPEN-3 and OPEN-4 (collage and "See the new photos" button become a photo row and chip), OPEN-9 (All photos button: Gallery is the wall), Photos as the opening tab. OPEN-1, -5, -7, -8, -10, -11 stand.
- **Because:** Chase found the warm look, heavy icons and buttons above the title "rough" and "dated" on his iPhone; black and white with one colored word keeps the easiest rule to teach over the phone ("tap the orange word") while looking like Apple's own apps.
- **Source:** `docs/product/decisions/2026-11-15-redesign.md`, `docs/product/SPEC-REDESIGN.md`

### DEC-60 · The post card names who can see it, not initials circles (GUX-R6)
- **When / status:** Nov 16 · Chase picked "Names" on the GUX-R6 decision card · Failing tests written (redesignPolish GUX-R6, who.test WHO-10/LIVE-4, firstMin FIRSTMIN-2)
- **Chose:** Chase Nov 16: names, not initials circles. The card says "Alex, Chase and 2 more can see this." in people's names (never a group's title, DEC-49); tapping it still opens everyone.
- **Over:** WHO-10 / LIVE-4 (Nov 5) initials circles with "+1" and a "Can see" label.
- **Because:** grandparent-ux GUX-R6: two "G" faces told Grandma Jo nothing; names read at a glance.
- **Source:** `app/src/screens/__tests__/redesignPolish.test.tsx`

### DEC-61 · No "Tap a photo to start" and no demo Try-this steps (RD-20)
- **When / status:** Nov 16 · Chase: "get rid of the tap a photo to start and the steps below. that is messy." · Failing tests written
- **Chose:** New for you keeps only the sender line; See all and the tiles are the way in. The demo's numbered steps leave Gallery and Feed; Details keeps "See it as Grandma Jo".
- **Over:** DEC-59's "Tap a photo to start" line; FIRSTMIN-3's three numbered steps (PR #113).
- **Because:** less text above the photos; the way in is already visible.
- **Source:** `docs/product/SPEC-REDESIGN.md` RD-20

### DEC-62 · The public demo uses Chase's own photos (DEMO-PHOTO-1..3)
- **When / status:** Nov 16 · Chase sent 10 phone photos: "give me a demo I can use", "don't worry about faces, I checked that", "these are good" · Built
- **Chose:** the demo's 9 sample moments show those photos (beach and dunes, museum, playground, porch, bike by the lake, splash pad, bridge, overlook, hug), with captions rewritten to match each one. Each photo is re-saved with no camera data (no EXIF, GPS or XMP) at 1200px on the long side, and loads at its own shape.
- **Over:** the drawn flat pictures from `scripts/make-demo-pictures.py` (DEMO-3's "no people, no real places").
- **Because:** real photos make the demo feel like a family's app, which is what a recruiter or a relative needs to see; Chase checked the faces himself. Demo content only, no change for a relative using the app, so no persona check.
- **Source:** `app/src/demo/__tests__/realPhotos.test.ts`

### DEC-63 · No comment emoji; a standard comment field on every post (UX-R5)
- **When / status:** Nov 17 · Chase: "I don't think given our UI we need a comment emoji. Use standard comment UI for the first comment" · Failing tests written (RD-37, RD-38)
- **Chose:** the reaction row keeps ❤️ 😂 👍 🎉 as emoji only (REACT-7 stands); 💬 leaves it. Every post shows a "Comments" heading, an "Add a comment…" field and a Post button, even before anyone has commented.
- **Over:** REACT-7's fifth icon, 💬 "Write a comment" (Oct 25); the reviewer's words under each emoji ("❤️ Love"), which REACT-7 keeps out.
- **Because:** ux-reviewer UX-R5: nobody can say "tap the speech bubble" over the phone, and the field is already on the card.
- **Source:** `app/src/screens/__tests__/reviewRound1.test.tsx` (UX-R5, UX-R6). Persona check not yet written (staff-pm).

### DEC-64 · The public demo's parent is Chase, not Kai (UX-R12)
- **When / status:** Nov 17 · Chase: "you can use my name throughout vs Kai" · Failing tests written (RD-43)
- **Chose:** the demo parent is "Chase" ("Good evening, Chase"); kids Mia and Leo, Alex and Grandma Jo stay made up; no surname.
- **Over:** DEMO-3's "the parent is Kai, never the founder" (made-up names only).
- **Because:** it's Chase's own public demo with his own photos (DEC-62); his first name is already public as the founder. Demo only; relatives never see it.
- **Source:** `app/src/demo/__tests__/seed.test.ts` DEMO-3, `app/e2e-web/demo.spec.js` UX-R12

### DEC-65 · Apple Photos months, a search field, Instagram-style posts (RD-44..RD-55)
- **When / status:** Nov 17 · Chase on the round 2 mockup: "A - 1", "B3", "C1 - 5 photos seems like a lot.. 1 large, 2 small, 1 small or 1 small with the +x", "Search- B but hide the months vs all toggle for now" · Failing tests written
- **Chose:** Gallery as a months mosaic like the newest Apple Photos (month name, a wide photo then rounded squares per day group, 16 pt corners, 8 pt gaps, inset 16 pt, the day number on the photo, no sender lines). A "Search photos" field under the greeting that pins on scroll; Search and By date leave the top right; the Months / All photos switch stays hidden. Feed posts in Instagram's order (face and name with a small "⋯", photos, reactions, description, "3 hours ago", who can see it, comments), 32 pt of space instead of lines (A-1), all four emoji with counts in one row (B3), at most 4 photo tiles with "+N" (C1), no Bold anywhere.
- **Over:** the edge-to-edge square grid (RD-39), Search and By date top right (RD-13), hairline dividers (RD-34), the 8 pt gray band (A-2), Slack-style chips (B1) and a Facebook heart (B2), a carousel (C2) and a big photo with a strip (C3), a 5-tile mosaic, Search as a round button by the tabs (A) or two words top right (C).
- **Because:** Chase: "their monthly timeline looks much better", "the search and filters are in an odd place", "our fonts are very heavy". Every reaction and photo stays in sight with one tap (grandparents); a box that says Search is easy to explain over the phone.
- **Source:** `app/src/screens/__tests__/photosStyle.test.tsx`, `app/src/ui/__tests__/relativeTime.test.ts`, `app/e2e-web/demo.spec.js`; persona check `decisions/2026-11-17-photos-style.md`

### DEC-66 · Easy view: words under tabs and bigger text, on for grandparents, off for parents (RD-74..RD-81)
- **When / status:** Nov 17 · Chase: "labels under tab icons should be off by default" behind a profile setting, "Easy view"; then "On for grandparents, off for parents" · Specced, failing tests next
- **Chose:** one More setting, "Easy view" (On/Off in words), that replaces Bigger text and bundles words under the tab icons with the bigger text sizes. Default On for viewers (invited grandparents), Off for owners and adults. A saved Bigger text choice carries over. Parents see icon-only tabs that still speak their names and stay 48 pt.
- **Over:** words under every tab for everyone (rule 3, DS-5 as written); a separate "Tab words" switch next to Bigger text; Off for everyone with grandparents told to turn it on.
- **Because:** parents want the cleaner look of the apps they use; grandparents keep every word with nothing to set. One switch is one sentence over the phone.
- **Source:** `docs/product/SPEC-REDESIGN.md` 1g; persona check `decisions/2026-11-17-easy-view.md`

### DEC-67 · Warm paper, soft photo shadows, a reaction pop (RD-84..RD-93)
- **When / status:** Nov 18 · Chase: "use the warm paper, the photo shadows, pop reactions"; tried paper `#F1E9D2` in a tester and kept it; "Leave out the Tuesday Nov 17 above the greeting" · Built in #119; its tan page superseded by DEC-68 (Nov 18); shadows and pop stand
- **Chose:** light pages in warm paper `#F1E9D2` with fields and capsules ~4.5% darker and hairlines ~9% darker, warm ink; dark pages warm near-black `#14100D` with warm ink. A soft shadow under Gallery tiles, New for you tiles and Feed photos in light mode only. A quick pop (1 → 1.25 → 1, ≤ 250 ms) when a reaction is turned on, none with Reduce Motion. No date line above the greeting.
- **Over:** RD-1's white `#FFFFFF` and true black ("no warm off-white") and RD-34's plain white; mockup A's lighter paper `#FBF8F3` and its date line; option B (family moments); option C's accent band and Ember month titles (RD-4 keeps accent for "tap here").
- **Because:** the white look read clinical; paper feels like a photo album and still keeps one plain page with no gray boxes. Shadows lift photos off the page without cards. The pop confirms a tap without words.
- **Source:** `docs/product/SPEC-REDESIGN.md` 1h; persona check `decisions/2026-11-18-warm-paper.md`

### DEC-68 · Three themes: Paper (default), Avocado, Pomegranate (RD-94..RD-104)
- **When / status:** Nov 18 · Chase: "I do not like the warm theme"; then add color themes, plain names (he turned down "pit" and "rind"); 14:55Z: "I like Paper but the primary background needs to be the offwhite you provided in the pallette, and or we need something to separate the main nav bar from the rest"; 14:57Z: keep photo shadows and the reaction pop · Specced, failing tests next
- **Chose:** Paper (default): off-white page `#FAF8F3`, white surface, warm ink `#1E1B17`, accent `#AD371D`; dark `#131210`, accent `#FF8A65` (RD-94). The tab bar sits on `c.surface` with a 1 px `c.line` top border in every theme (RD-104). More → Family color becomes "Theme" with three swatches: Paper, Avocado, Pomegranate. Each theme sets its own page, surface, ink, muted, line, fill, photo and accent, light and dark (values from the palette page, RD-95). Forest and Plum fold away; an old Ember, Forest, Plum or Sage pick opens as Paper. Per phone, owner only, no database change before the beta. DEC-67's photo shadows and reaction pop stay (RD-100, RD-101 dropped).
- **Over:** DEC-67's tan paper `#F1E9D2`; plain white `#FFFFFF` / true black (Chase wanted the off-white, and the tab bar needs separating); dropping the shadows and pop; keeping Ember/Forest/Plum as accent-only colors; the names "skin", "seed", "pit", "rind"; a theme per person or saved for the whole family now (Phase 2, after the beta).
- **Because:** the tan read as a misread of what Chase wanted; off-white keeps photos clean without glare and still gives ink 16:1. A white tab bar on the off-white page tells the nav from the content. A whole theme says more than an accent swap, and three plain words are easy to say over the phone.
- **Source:** `docs/product/SPEC-REDESIGN.md` 1i; persona check `decisions/2026-11-18-themes.md`. Supersedes only DEC-67's page colors (its shadows, pop and "no date line" stay).

### DEC-69 · Paper's light page is Linen #F7F7F4 (RD-105)
- **When / status:** Nov 19 · Chase, after a picker of six near-whites on the Gallery screen: "Remember barely warm. But go with linen for now" · Built in a small PR, waits on Chase's "merge"
- **Chose:** Paper light page `#F7F7F4` (Linen). Surface, ink, accent, dark mode and the other themes stay as DEC-68 set them.
- **Over:** `#FAF8F3` (live, read as papyrus); `#F9F9F7` Barely warm (Chase's own suggestion, kept as the runner-up to revisit); `#FAFAFA` Neutral; `#FBFAF8` Soft.
- **Because:** Linen reads white next to the photos with no yellow cast, yet keeps a trace of warmth, and the white tab bar still stands apart from it.
- **Source:** `docs/product/SPEC-REDESIGN.md` RD-105; persona check `decisions/2026-11-19-paper-linen.md`; picker https://claude.ai/artifact/Yb4PXNBTHA8ytzmUGXHXV1

### DEC-70 · iPhone's own tab bar with Easy view Off, Hearth's fixed bar with Easy view On (RD-106, RD-107)
- **When / status:** Nov 19 · Chase, on how Apple's glass capsule works on older iOS: "That's the route I want", "But maybe the fixed bar for grandparents", "Build them now", "We will look back, re org work based on what we accomplished" · Built, waits on Chase's "merge" and an iPhone check
- **Chose:** on iPhone with Easy view Off (parents, icons only) the system tab bar: iOS 26 gives the floating glass capsule for free, older iPhones keep the classic bar. Easy view On (grandparents) keeps Hearth's fixed, solid bar with words. Android and the web unchanged. No custom glass of ours.
- **Over:** Hearth's bar everywhere on iPhone (LIVE-1, Nov 5); a custom glass capsule (`expo-glass-effect`, iOS 26 only, needs a fallback everywhere else); a solid floating capsule; the bar shrinking on scroll (DS-5).
- **Because:** the native bar matches what parents see in Apple's own apps and Instagram and costs nothing on older phones; LIVE-1's problem was 17 pt words, which only Easy view shows. Grandparents keep big words on a bar that never floats or blurs. Partly reverses Chase's Nov 16 "no glass before the beta" call, by his word.
- **Source:** `docs/product/SPEC-REDESIGN.md` RD-106, RD-107; persona check `decisions/2026-11-19-native-tab-bar.md`; picker https://claude.ai/artifact/Yb4PXNBTHA8ytzmUGXHXV1

### DEC-71 · No demo bar on a laptop; the phone keeps it slim (DEMO-BAR-LAPTOP-1)
- **When / status:** Nov 19 · Chase asked "do we need the demo bar?" and said its portfolio link went to an old page; picked "Laptop off, phone stays slim" on a decision card · Small PR, waits on Chase's "merge"
- **Chose:** at 900 px and wider the bar goes and Grandma Jo's view and Reset demo sit in the story panel under Try this; phones keep the 48 pt bar. Every way back opens `chaseholroyd.com/#p-hearth` (the portfolio's current Hearth case study). The badge reads DEMO in real capitals (small caps drew as "DEмо").
- **Over:** no bar anywhere (on a phone Grandma Jo's view would hide under More); keep the bar and only fix the link.
- **Because:** on a laptop the story panel already says demo, explains the sample family and links back, so the bar only pushed the app down. On a phone the bar is the only sign the family is made up and the only route to Grandma Jo's view. Deviates from the studio demo bar standard (pm-tools DEMO-BANNER.md) on wide screens.
- **Source:** persona check `decisions/2026-11-19-demo-bar-laptop.md`; screenshots `/mnt/project-files/demo/demo-bar-2026-11-19/` (project files)

### DEC-72 · The web demo shows a lookalike of the floating glass tab bar (RD-108, RD-109)
- **When / status:** Nov 19 · Chase: "i do not see it in the demo", then picked "Yes, build a web lookalike" on the card · Built, waits on Chase's "merge"
- **Chose:** on the web with Easy view Off, a floating, see-through, blurred capsule with a tinted pill on the picked tab; screens leave room under it. Easy view On keeps the fixed bar with words. Same PR: Easy view no longer enlarges the laptop panel or the demo bar (DEMO-EASY-1).
- **Over:** keeping the fixed bar on the web (iPhone only shows the real glass, so the demo wouldn't match what parents get).
- **Because:** most people only see Hearth through the web demo; it should show the bar iPhone users get. Text stays off the glass (icons only, DS-6).
- **Source:** `docs/product/SPEC-REDESIGN.md` RD-108, RD-109, DEMO-EASY-1; persona check `decisions/2026-11-19-web-glass-bar.md`

---
Last updated: Nov 19, 2026 (DEC-72)
