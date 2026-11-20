# What is live (deploy ledger)

One table of what runs on the hosted project, so nobody has to guess from chat or HANDOFF. Update it in the same PR (or the next docs PR) every time something is deployed. Deploys happen only on Chase's exact words (CLAUDE.md, `docs/eng/MERGING.md`).

| Piece | Live | On main, not live | Last deploy |
|---|---|---|---|
| Database migrations | 0001–0025 (smoke check 9/9) | 0026 text sign-in (switched off; needs "deploy 0026"); 0027 group names for parents only (needs "deploy 0027"); 0028 no passwords in Auth (TS-SEC-R1, PR #134; the same deploy also turns "Confirm email" on); 0029 video fixes (ENG-R2 count back for unfinished videos, ENG-R11 HF002, SEC-R7; PR #135 once merged). `deploy.sh` applies every migration not yet applied, so the next deploy ships 0026 through 0029 together | Nov 11, 2026 (0024, 0025) |
| `start_family_open` switch | off | | Nov 11, 2026 |
| Edge function `notify` | yes (1-minute cron `hearth-notify`) | | Oct 28, 2026 (unchanged since Oct 18) |
| Edge function `sign-media` | yes | | Oct 28, 2026 |
| Expo preview (Expo Go) | main f882255, update group 3f7d0149 | everything merged after Nov 13 | Nov 13, 2026 |
| Public web demo (chaseholroyd.com/hearth/) | follows main on every merge (`demo-site.yml`, live checks before and after) | | each merge |

How to deploy: `backend/scripts/deploy.sh --dry-run`, then the real run, then `backend/scripts/smoke-check.sh`. Expo: `scripts/check-expo-go.sh`, then the EAS update in `app/`.
