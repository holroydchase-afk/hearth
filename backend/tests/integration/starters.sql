-- START-ON-6 (QA-R1): a pool of signed-in accounts in no family for the 0024 contract cases (BETA-START-1, 5, 8, 11).
-- Every start-a-family case ends with its starter owning a family, so the app harness hands each test a fresh one.
-- Test-only, fake addresses (example.test). Loaded by start.sh and supabase_harness.sh; safe to run twice.
insert into auth.users (id, email, raw_user_meta_data)
select ('c5000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'starter_' || lpad(n::text, 2, '0') || '@example.test',
       jsonb_build_object('display_name', 'Starter ' || lpad(n::text, 2, '0'))
from generate_series(1, 30) n
on conflict (id) do nothing;
