# What is live (deploy ledger)

One table of what runs on the hosted project, so nobody has to guess from chat or HANDOFF. Update it in the same PR (or the next docs PR) every time something is deployed. Deploys happen only on Chase's exact words (CLAUDE.md, `docs/eng/MERGING.md`).

| Piece | Live | On main, not live | Last deploy |
|---|---|---|---|
| Database migrations | 0001–0034 (34 recorded; checked Nov 25: no password hashes left, `videos_this_month` closed to app roles, `post_kinds` and `start_family_open` switches off, every public table has RLS). Smoke check not run: this token gets 403 on the secrets and auth-config APIs | Nothing waiting | Nov 25, 2026 (0026–0034; Chase: deploy after the merges) |
| `start_family_open` switch | off | | Nov 11, 2026 |
| Edge function `notify` | yes (1-minute cron `hearth-notify`) | | Oct 28, 2026 (unchanged since Oct 18) |
| Edge function `sign-media` | yes (HF002 cap code, 402 on the video cap) | | Nov 25, 2026 |
| Expo preview (Expo Go) | main f882255, update group 3f7d0149 | everything merged after Nov 13 | Nov 13, 2026 |
| Public web demo (chaseholroyd.com/hearth/) | follows main on every merge (`demo-site.yml`, live checks before and after) | | each merge |

How to deploy: `backend/scripts/deploy.sh --dry-run`, then the real run, then `backend/scripts/smoke-check.sh`.

Before deploying 0032 (PRIV-VC-B3): the dry run with `SUPABASE_ACCESS_TOKEN` set must print `RLS owners: pass`. It runs one read-only query on the hosted database, and the real run repeats it and stops on FAIL:

```sql
select c.oid::regclass::text as rel, pg_catalog.pg_get_userbyid(c.relowner) as owner,
       (r.rolsuper or r.rolbypassrls) as bypasses
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_roles r on r.oid = c.relowner
 where n.nspname = 'public' and c.relkind in ('r', 'p')
 order by 1;
```

Any row with `bypasses = false` blocks the deploy (0032 would also refuse to run). Expo: `scripts/check-expo-go.sh`, then the EAS update in `app/`.
