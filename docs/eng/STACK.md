# Hearth stack

One line per choice: what we use, why, and when it was last checked against the vendor's page (rule 8 in `CLAUDE.md`; the post mortem is in `LESSONS.md`). Change a line here in the same PR that changes the choice. Versions below are the ones pinned in `app/package.json`.

| Job | Choice | Why | Checked |
|---|---|---|---|
| App shell | Expo SDK 58 (`expo` ~58.0.19, React Native 0.88.0, React 19.3.0) | One codebase for iPhone, Android and web; Expo Go opens a build with no store account. The SDK sets the React Native and React versions. | 2026-11-26 on the npm registry (see "Behind the registry") |
| Data | Supabase (Postgres, Auth, Edge Functions); `@supabase/supabase-js` ^2 | Row-level security carries the privacy rules; one US-hosted service (DEC-9). The app talks to it only through `HearthApi` (Supabase and Fake implementations). | 2026-11-26 |
| State | React Context (`app/src/state/AppContext.tsx`) plus a runtime switch (`runtime.ts`, `fakeRuntime.ts`) | The app has one signed-in user and one feed; no second state library does a job Context doesn't. | 2026-11-26 |
| Navigation | expo-router ~58, behind the 24-line `Nav` interface (`app/src/state/nav.tsx`) | Screens call `useNav()`, never the router, so tests pass spies and the router can change without touching screens. | 2026-11-26 |
| Tests | jest ~30 with jest-expo ~58 (app), Playwright (web and demo e2e), SQL and shell tests (backend) | Test first; the same jest runs the contract tests. Full list in `TESTING.md`. | 2026-11-26 |
| Media | `expo-image-manipulator` (resize, re-encode on the phone) plus `jpeg-js` (read and strip JPEG bytes) | **Two libraries, one job each:** the manipulator resizes and compresses natively and can't drop metadata on every platform; `jpeg-js` is the byte-level check that EXIF and GPS are gone (MEDIA-1..3, `SPEC-MEDIA.md`) and what the web build uses. | 2026-11-26 |
| Crypto | `@noble/ciphers` 2 and `@noble/hashes` 2 for AES-GCM and hashing; `expo-crypto` for random bytes | **Two libraries, two jobs:** noble is audited, pure JavaScript and runs the same on every platform; `expo-crypto` is only the phone's secure random source (`app/src/crypto/random.ts`). No home-made primitives (`docs/architecture/03-encryption-and-keys.md`). | 2026-11-26 |
| Messenger | `@holroyd/messenger` (MLS), in `packages/messenger` | Shared with the next app (DEC-42). | 2026-11-26 |
| Visibility | `@holroyd/visibility`, in `packages/visibility` | Reusable registry and `can_see` (DEC-83). | 2026-11-26 |
| Language | TypeScript ~6.0.3, strict | See "TypeScript" below. | 2026-11-26 |

## Behind the registry

On the npm registry on 2026-11-26 `expo` is 58.1.0 (58.0.26 is the last 58.0 patch), React Native 0.88.1 and React 19.3.1. Hearth pins expo 58.0.19, React Native 0.88.0 and React 19.3.0, which are the versions that SDK 58 was released with (`LESSONS.md`, Oct 26). Moving to the newest patches is a small upgrade for its own PR: run `npx expo install --check`, then a phone must open the build before it is called ready (rule 8). It is not done here because this change touches no app code.

## TypeScript

Hearth stays on ~6.0.3. `typescript` is 7.0.2 on the registry (2026-11-26) and other studio repos use it. We have not verified that Expo SDK 58's tooling and `jest-expo` accept 7, and a compiler change gains Hearth nothing before the beta. Revisit when Expo's own template moves to 7 or when the component library (intake #192) pins a version Hearth must match. Decision recorded here, not in the decision log: it changes no user-visible behaviour.
