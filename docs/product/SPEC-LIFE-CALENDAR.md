# Spec: life calendar v1, birthdays and important dates (CAL-*)

Chase, Nov 24 (rapid messages): "Life calendar" / "Capture birthdays" / "And important dates" / "Tell everyone" / "So during onboardng" / "Build a v1". DEC-81. Persona check `decisions/2026-11-24-life-calendar.md`. Only approved work while everything else is paused.

**The bet.** A grandparent who joins Hearth gives her birthday in under 60 seconds with no help, and on the day everyone in the family opens Hearth and sees "Today is Grandma Jo's birthday". Families stop relying on Facebook's birthday nudges (STORY: the grandparents who avoid social media miss them). Parents add the kids' birthdays and the anniversaries once.

**Signal.** Share of members with a birthday saved after their first visit (target: 8 of 12 beta grandparents in week one). Grandparent test: LG saves her birthday in under 60 s without help. Help calls about it: 0.
**Stop or pivot.** Two or more help calls about the birthday ask, or LG fails it: drop the ask for viewers and let parents enter grandparents' birthdays from far away (already allowed by CAL-6).

## What v1 is (and isn't)
- **Month and day only. No year, no age.** Nobody is asked their birth year, so there is nothing to hide (pushback on "year optional": a stored year is a privacy liability for a feature that doesn't need it).
- **Everyone in the family sees every date.** Dates are family-wide, not per group. The screen says so before anyone saves.
- **"Tell everyone" in v1 means in the app:** the date is on everyone's list, and on the day a line on Gallery tells everyone who opens Hearth. A push or email on the day is v1.1 (needs the outbox to accept a notice with no post, a change to `notify`, and a deploy).
- **Onboarding = one optional card**, not a new gate: the first screen asks "When's your birthday?" with Not now. It reaches every way in (join by code, join by link, start a family) because it lives on Gallery.

## Data (migration 0029, deploy only on Chase's word)
`public.family_dates`: `id`, `space_id` (cascade), `kind` (`birthday` | `anniversary` | `other`), `label` (text, null for a member's own birthday, else 1 to 60 characters trimmed), `month` (1..12), `day` (valid for the month; Feb 29 allowed), `member_id` (nullable profile: "this is X's birthday"), `created_by`, `created_at`, `updated_at`. One birthday per member per family. Cap 200 dates per family. RLS on; select for members of the space only; no direct writes (RPCs, security definer, `search_path = ''`).
- `list_family_dates(p_space)`: every date in the family; a member's own birthday comes back with that member's current name (renames follow).
- `set_my_birthday(p_space, p_month, p_day)`: upsert your own; both null clears it.
- `save_family_date(p_space, p_id, p_kind, p_label, p_month, p_day, p_member)`: parents (owner, adult) only; `p_id` null adds.
- `delete_family_date(p_id)`: parents any; a viewer only their own birthday.
- When someone leaves the family (space_members row gone), their member-linked dates there go with them.

## Acceptance criteria
| ID | Given / When / Then | Type | Test home |
|---|---|---|---|
| CAL-1 | Given a member of family F, when they call `list_family_dates(F)`, then they get every date in F, sorted by month then day, and no date from any other family | auto | `backend/tests/family_dates_test.sql`, contract |
| CAL-2 | Given someone not in F (or signed out), when they list F's dates, then they get zero rows; when they touch a date id from F, then it fails as not found (`P0002`), same as an unknown id | auto | SQL, contract |
| CAL-3 | Given any member (viewer included), when they `set_my_birthday` with a month and day, then one birthday row linked to them exists in F; a second call changes it, never adds a second; null and null clears it | auto | SQL, contract |
| CAL-4 | Given month 2 day 30, month 4 day 31, month 13 or day 0, when saved, then it fails with `22023` and nothing is stored; Feb 29 is accepted | auto | SQL, contract |
| CAL-5 | Given a viewer, when they call `save_family_date` or delete someone else's date, then it fails as not found (`P0002`) and nothing changes | auto | SQL, contract |
| CAL-6 | Given a parent (owner or adult), when they add, change or delete any date in F (a kid's birthday with a label, an anniversary, a member's birthday), then it is saved; a label over 60 characters or blank (when no member is linked) fails `22023` | auto | SQL, contract |
| CAL-7 | Given a member's own birthday and that member renames, when anyone lists dates, then the row shows the new name | auto | SQL, contract |
| CAL-8 | Given a member who leaves F, when anyone lists F's dates, then that member's birthday is gone | auto | SQL |
| CAL-9 | No year column exists and no RPC takes or returns a year or age | auto | SQL (catalog check), contract |
| CAL-10 | Given 200 dates in F, when a parent adds one more, then it fails `P0001` with a plain message and nothing is stored | auto | SQL |
| CAL-11 | `HearthApi` gains `familyDates`, `setMyBirthday`, `saveFamilyDate`, `deleteFamilyDate`; the Fake and Supabase versions pass the same contract tests (CAL-1..7); `docs/eng/API.md` has a "Life calendar (0029)" section | auto | `app/src/api/contract/calendar.contract.test.ts` |
| CAL-12 | Given a member with no birthday saved, when Gallery opens, then a card reads "When's your birthday?" with "Your family will see the month and day. Never the year.", a month choice (12 worded buttons), a day choice (numbered buttons), "Save" and "Not now"; no typing, every target 48 pt, text 17 pt+ | auto | `app/src/screens/__tests__/calendar.test.tsx` |
| CAL-13 | Given the card, when they tap Save, then it reads "Saved. Your family will see December 8." and goes away for good; when they tap Not now, then it doesn't come back in this family on this phone (they can still add it from Birthdays) | auto | calendar.test.tsx |
| CAL-14 | Given any member, when they open More, then a "Birthdays" row (icon plus word) opens "Birthdays and dates": every date, soonest first, starting today, each with its label, the date in words ("December 8") and "Today", "Tomorrow", "In 5 days" (up to 30 days), never a year or age | auto | calendar.test.tsx |
| CAL-15 | Given a viewer on Birthdays, then the only action is "Add my birthday" or "Change my birthday"; given a parent, then "Add a date" (kind: Birthday, Anniversary, Something else; a name or label; month; day) and tapping a date opens Change and Delete, with "Delete this date?" confirm | auto | calendar.test.tsx |
| CAL-16 | Given today matches one or more dates (phone's own date; Feb 29 dates show on Feb 28 in other years), when anyone opens Gallery, then one line at the top reads "Today is Grandma Jo's birthday" (two or more: "Today: Grandma Jo's birthday and 1 more") with a "See birthdays" button | auto | calendar.test.tsx (fixed clock) |
| CAL-17 | Given the hosted backend doesn't have 0029 yet (function not found), when the app runs, then the card, the line and the More row hide quietly; no error banner, no client error report | auto | calendar.test.tsx |
| CAL-18 | Labels are never logged, sent in error reports or put in any notice (same rule as captions) | auto | SQL grep check + jest on the error reporter |
| CAL-19 | Demo: Grandma Jo's birthday is today (set relative to the visit, so the Gallery line always shows), Grandpa Earl's in 9 days, a made-up kid "Mia's birthday" and "Chase and Alex's anniversary"; demo seed version bumps so returning visitors get them; Grandma Jo's view shows only "Change my birthday" | auto | `app/e2e-web` demo spec |
| CAL-20 | `docs/architecture/02-data-flow.md` and `05-access-control.md` name the new table, who reads and writes it, and that no year is stored; "Last checked" updated | manual | privacy-security review of the PR |
| CAL-21 | Grandparent test: LG, on her own phone with no help, saves her birthday from the card in under 60 s and finds Grandpa Earl's on Birthdays in under 60 s | manual | Hearth Test Log |

## Words (grandparent-ux to confirm before build)
- Card: **When's your birthday?** / "Your family will see the month and day. Never the year." / **Save** / **Not now**.
- More row: **Birthdays**. Screen title: **Birthdays and dates**. Under it: "Everyone in the family sees these."
- Buttons: **Add my birthday**, **Change my birthday**, **Add a date**, **Change**, **Delete**. Gallery line button: **See birthdays**.
- "Group" never appears here: dates are family-wide.

## Not doing in v1 (parked, one line each)
- Push or email on the day, and "3 days before" reminders: v1.1; needs outbox changes, `notify` change and a deploy (TRACKER R77 follow-up).
- Birth year and ages: not needed; privacy cost with no beta job behind it.
- Per-group audience on dates: wide; revisit if a split family asks (SG risk, persona check).
- "Say happy birthday" button that opens Share prefilled: nice, not on the core path.
- Calendar export (iCal), a month grid view, recurring custom events, photos "on this day": ideas log.
