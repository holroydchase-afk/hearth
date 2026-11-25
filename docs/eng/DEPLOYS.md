# What is live (deploy ledger)

One table of what runs on the hosted project, so nobody has to guess from chat or HANDOFF. Update it in the same PR (or the next docs PR) every time something is deployed. Deploys happen only on Chase's exact words (CLAUDE.md, `docs/eng/MERGING.md`).

| Piece | Live | On main, not live | Last deploy |
|---|---|---|---|
| Database migrations | 0001–0025 (smoke check 9/9) | 0026 text sign-in (switched off; needs "deploy 0026"); 0027 group names for parents only (needs "deploy 0027"); 0028 no passwords in Auth (TS-SEC-R1, PR #134 once merged; the same deploy also turns "Confirm email" on). `deploy.sh` applies every migration not yet applied, so the next deploy ships every one from 0026 up together. 0029 life calendar (DEC-81); 0030 video fixes (ENG-R2 count back for unfinished videos, ENG-R11 HF002, SEC-R7; PR #135). Branch `claude/project-thread-jtelk5` adds 0031 visibility core and 0032 visibility registry (R77 Phase 1/1b, no behavior change; 0032 refuses to run if the table owner doesn't bypass RLS; 0030 is the video-fixes branch, PR #135, and ships before 0031 and 0032: deploy.sh applies in number order, ARCH-VC-R3); then 0033 oracle fixes and 0034 News, Event and Saying posts (SHARE-U; adds `posts.kind`, `post_events`, `post_sayings`, new `create_post` signature, `kind` on the feed RPCs; switch `post_kinds` ships off: turning it on is one row in `private.feature_flags` plus the family's `space_features` row, only on Chase's word) | Nov 11, 2026 (0024, 0025) |
| `start_family_open` switch | off | | Nov 11, 2026 |
| Edge function `notify` | yes (1-minute cron `hearth-notify`) | | Oct 28, 2026 (unchanged since Oct 18) |
| Edge function `sign-media` | yes | | Oct 28, 2026 |
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
