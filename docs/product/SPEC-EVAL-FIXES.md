# SPEC-EVAL-FIXES: intake #162 eval findings (R83)

Staff PM, Nov 24, 2026. Chase's rule: accessibility is high priority. One small app PR. The evidence from before the fix is in qa-tdd's run at main `ff4543e` (`e2e/results/eval-findings-red-2026-11-24.txt`; the before screenshots are outside the repo). This PR doesn't change the data model, the server or the RLS rules.

## 1. In this PR
**EF-HE-1 (P0, Chase yes): every Open button on Messages says which chat it opens.**
- EF-HE-1-AC1 (auto): Given Messages with 3 chats, when it renders, then no two buttons show the same text. Named groups and events show "Open Everyone" or "Open Lake weekend". People show "Open chat with Alex and Grandpa Earl".
- EF-HE-1-AC2 (auto): the spoken name is exactly the visible text, so WCAG 2.5.3 still holds. `chatOpenLabel` returns the same string the button shows.
- EF-HE-1-AC3 (manual): with Easy view on, at the phone's largest text size, a long title wraps inside the button and is never cut off with "…". The button is at least 48 pt tall and the text at least 17 pt.

**EF-HE-2: a radio row shows an empty ring when it isn't picked.**
- EF-HE-2-AC1 (auto): Given Easy view or Light or dark, when one row is picked, then every unpicked row shows an empty ring (`circle` / `radio_button_unchecked`) and the picked row shows a filled ring (`checkmark.circle.fill` / `radio_button_checked`) in accent. This changes the shared `Choice` radio, so it covers every radio in the app.
- EF-HE-2-AC2 (auto): the unpicked ring has at least 3:1 contrast against the row in light and dark mode, on Paper and on one fruit theme (WCAG 1.4.11).
- EF-HE-2-AC3 (auto): `aria-checked` and `accessibilityState` don't change. The whole row is still the 48 pt target.

**EF-HE-5: parents see an honest line about group names, and New group stands out.**
- EF-HE-5-AC1 (auto): Given a parent on Your groups, then the muted line reads exactly: "Each photo goes only to the groups you pick. Only parents see these names; everyone else sees people's names." It no longer says "People never see group names".
- EF-HE-5-AC2 (auto): "New group" is the one filled main button on the screen. "Rename" stays secondary, so the two no longer look the same (a deliberate DS-9 primary).
- EF-HE-5-AC3 (auto): a relative still never reaches this screen (GRP-15 stays green).

**EF-HE-6: an empty Events list says what an event is.**
- EF-HE-6-AC1 (auto): Given no events, when a relative opens Events, then they see "No events yet." followed by "An event is photos from one day, like a birthday or a trip. When someone adds you to one, it shows up here."
- EF-HE-6-AC2 (auto): Given no events and a parent, then they see the same two lines plus "To make one, open Groups in More, tap New group, and tick \"This group is for an event.\"" The words match the real labels.

**EF-HE-9 / B18: New for you counts every post since the last visit.**
- EF-HE-9-AC1 (auto, already red): the test "EF-HE-9 B18 25 new posts since the last visit…" in `evalFindings.test.tsx` passes. The walk counts all 25, not just the first 20, and starts at the oldest.

Gate: the whole app suite is green 3x, and grandparent-ux reviews the shots for EF-HE-1, 2, 5 and 6.

## 2. Close with evidence (no change)
- **EF-HE-3**: DEC-79's empty postcard fixed it (`ef-he-3-share-parent.png`). The empty space under one target is deliberate: one thing to tap (A1).
- **EF-HE-7**: by design (GUX-R10). The owner set up the family, so his Help has no "ask someone" card. Adults and viewers do get "Need help?" with a Call button.
- **EF-HE-8**: false alarm. The smallest text measured is 17 px.
- **Dark D-3**: fixed by PR #158. Dark mode has no shadows left (`ef-he-d3-*.png`).
- **EF-HE-5 invite hint**: false alarm, per qa-tdd.
- **EF-HE-10 / T27**: qa-tdd couldn't reproduce it. It stays open in T27 with no change; it isn't closed.

## 3. Needs Chase
- **EF-HE-4**: take Easy view and Light or dark off Me and keep them only in More. That reverses RD-78's placement and changes the DS-10 "on Me" test. **Recommend yes**: with one place for each setting, phone help is one sentence ("tap More, then Easy view").
- **EF-HE-6 button**: add a "Make an event" button on the parent's empty Events screen that opens New group with the event box ticked. This is new scope, so it goes to the ideas log. **Recommend not now**; the words in AC2 are enough for the beta.

Persona check: the radio ring and Groups wording follow rule 3 and DEC-49 and don't reverse either, so no new persona check is needed. EF-HE-4 gets its own check if Chase says yes.
