# Spec: photo search (SEARCH-*)

Chase, Nov 10: go-live list item 9, "Search." Status: built locally (migration 0025 + Search screen), not pushed (GitHub hold). DEC-56.

**What it is.** A "Search" button on Photos finds posts by the words people wrote, who sent them and the year they were taken. Plain words only: it never looks inside a photo, never uses AI, and nothing typed is kept. AI search (faces, objects, places) stays on the separate paid tier (DEC-37, `docs/product/AI-FEATURES.md`).

## Acceptance criteria
| ID | Criterion | Test |
|---|---|---|
| SEARCH-1 | Every typed word (case-insensitive, any spacing) must appear in the post's title, caption or sender's name | `backend/tests/search_test.sql`, contract |
| SEARCH-2 | A post you can't see is never found (same rule as the timeline, `private.visible_posts`) | SQL, contract, SEARCH-UI-3 |
| SEARCH-3 | Group names are never searched; a found post carries no audience or group title unless you sent it | SQL, contract |
| SEARCH-4 | Replies are not searched (their reader rules stay with `get_comments`) | SQL |
| SEARCH-5 | Titles and senders' names are searched | SQL, contract |
| SEARCH-6 | "From" one person, with or without words | SQL, SEARCH-UI-5 |
| SEARCH-7 | A capture-date range `[from, until)` on `coalesce(taken_at, published_at)`; the app sends a year in the phone's time zone | SQL, contract, SEARCH-UI-6 |
| SEARCH-8 | `%` and `_` are plain characters, not patterns | SQL, contract |
| SEARCH-9 | Nothing to search for, over 100 characters or over 8 words: `22023` | SQL, contract |
| SEARCH-10 | Another family's posts are never found | SQL |
| SEARCH-11 | Deleted posts are not found | SQL |
| SEARCH-12 | Newest photo first, paged like `get_timeline` | SQL, contract |
| SEARCH-13 | `search_posts` is STABLE: it can't store what anyone typed | SQL |
| SEARCH-14 | Signed-out callers can't use it | SQL |
| SEARCH-UI-1..8 | Labeled Search button on Photos; a "Words to look for" field and a Search button; "From" and "Taken in" as worded buttons; "Found N posts"; a plain "Nothing found" line with what to try; a found post opens to love it or write back; Back to Photos and the phone's Back | `app/src/screens/__tests__/search.test.tsx` |

## Words (grandparent-ux to confirm)
- Toolbar: **Search** (icon plus the word). Screen title: **Search photos**.
- Under the title: "Search looks at the words people wrote and who sent them. It never looks inside your photos."
- Nothing found: `Nothing found for "piano". Try one word, or pick a person or a year.`

## Not in this version
Searching replies, event names or months; spelling forgiveness ("birthdy"); a search across families. Captions are plaintext columns today; encrypting them later (TRACKER) would end server-side search, which DEC-56 records.
