# Reuse: Hearth parts other products can take

Each part lives in `packages/`, keeps product words out, and has its own README, LICENSE and package.json. Hearth uses it through a thin adapter, so a fix lands in the package once.

| Package | What it gives | Hearth's adapter | Next user |
|---|---|---|---|
| `packages/messenger/` (`@holroyd/messenger`, AGPL-3.0-or-later) | End-to-end encrypted group chat on MLS, with pluggable relay, roster and store; a Supabase relay template | `app/src/messenger/`, migration 0015 | Crew Clock (DEC-42) |
| `packages/visibility/` (`@holroyd/visibility`, AGPL-3.0-or-later) | The `vis` schema: registry of kinds, one rule per reach, `vis.can_see`, `vis.attach`, conformance kit, product-word check | migration 0031 (the package's `core/supabase.sql` verbatim, held equal by `backend/tests/vis_core_copy_test.sh`, ARCH-VC-R1) and 0032 (Hearth's registry and adapter views); gate `backend/tests/vis_registry_test.sql` | Any Supabase product with per-audience data (DEC-83) |

Candidates not yet split out (ENG-R20): the supabase starter, the LargeSecureStore session, and the B2 sigv4 signer.

Rules: a package never imports from `app/` or names Hearth; a change to a package's SQL template is copied into a new migration, never edited into a deployed one.
