# @holroyd/visibility

Who can see what, written once. A Postgres (Supabase) core that every kind of data in a product goes through: one registry of kinds, one rule per reach, one dispatch, and a CI gate that fails the build when a table, function or edge function isn't registered. Built for Hearth and kept free of Hearth's words so other products can use it, like `@holroyd/messenger`.

## What's here

| File | What it is |
|---|---|
| `core/supabase.sql` | The `vis` schema template: `vis.kinds`, `vis.functions`, `vis.edge_functions`, `vis.sees_item`, `vis.viewer_sees_item`, `vis.can_see`, `vis.attach`, and four placeholder adapter views. Copy it into a migration verbatim. |
| `core/test.sql` | The conformance kit: a toy product (guilds, squads, scrolls) proves a throwaway kind follows its item's audience with one `vis.attach` call, a yes-to-everyone hook can't widen, and a hook that returns null or raises fails closed. Rolls back. |
| `core/no_product_words_test.sh` | Fails if the template mentions a product word. |

## Use it

1. Copy `core/supabase.sql` into a migration.
2. In a later migration, replace `vis.item_v`, `vis.audience_v`, `vis.membership_v` and `vis.role_v` with views over your own tables (same columns; see the file header).
3. Register every table an app user can touch in `vis.kinds`, or call `vis.attach('<table>', '<kind>', item_column => '<item id column>')` for anything that hangs off an item.
4. Add a catalog gate to CI. Hearth's is `backend/tests/vis_registry_test.sql`.

Run the kit on any scratch database: `psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -f core/test.sql`.

Design and limits: Hearth's `docs/architecture/07-visibility-model.md`. License: AGPL-3.0-or-later.
