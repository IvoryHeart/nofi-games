begin;

select plan(19);

select has_table('public', 'studio_catalog_entries', 'catalog exists');
select has_table('public', 'studio_gameplay_events', 'consented gameplay table exists');
select has_column('public', 'studio_catalog_entries', 'entry_script', 'catalog pins entry script');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.studio_catalog_entries'::regclass),
  'catalog has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.studio_gameplay_events'::regclass),
  'gameplay observations have RLS'
);
select results_eq(
  $$ select count(*)::bigint from public.studio_catalog_entries where status = 'fixture' and discoverable $$,
  array[0::bigint],
  'fixtures are never discoverable'
);
select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'game-packs'
      and not public
      and file_size_limit = 104857600
  ),
  'game-pack bucket is private and bounded'
);

set local role anon;
select results_eq(
  $$ select count(*)::bigint from public.studio_catalog_entries $$,
  array[0::bigint],
  'anonymous players cannot read hidden fixtures'
);
reset role;

select ok(to_regclass('public.studio_workflow_runs') is null, 'workflow runs are absent');
select ok(to_regclass('public.studio_run_events') is null, 'workflow run events are absent');
select ok(to_regclass('public.studio_evidence') is null, 'studio evidence ledger is absent');
select ok(to_regclass('public.studio_agent_versions') is null, 'agent registry persistence is absent');
select ok(to_regclass('public.studio_agent_evaluations') is null, 'agent promotion persistence is absent');
select ok(to_regclass('public.studio_agent_sessions') is null, 'agent sessions are absent');
select ok(to_regclass('public.studio_stage_attempts') is null, 'stage attempts are absent');
select ok(to_regclass('public.studio_agent_checkpoints') is null, 'agent checkpoints are absent');
select ok(to_regclass('public.studio_model_calls') is null, 'model-call persistence is absent');
select ok(
  not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in ('studio_claim_stage_attempt', 'studio_renew_stage_lease')
  ),
  'attempt lease functions are absent'
);
select ok(
  not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'studio_accept_agent_checkpoint'
  ),
  'checkpoint acceptance function is absent'
);

select * from finish();
rollback;
