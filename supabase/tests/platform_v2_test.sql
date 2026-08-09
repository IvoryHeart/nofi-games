begin;

select plan(12);

select has_table('public', 'studio_workflow_runs', 'workflow ledger exists');
select has_table('public', 'studio_catalog_entries', 'catalog exists');
select has_table('public', 'studio_agent_versions', 'agent registry exists');
select has_table('public', 'studio_gameplay_events', 'gameplay event ledger exists');
select has_column('public', 'studio_catalog_entries', 'entry_script', 'catalog pins entry script');
select has_column(
  'public',
  'studio_agent_evaluations',
  'evaluator_agent_id',
  'agent evaluations record independent evaluator identity'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.studio_run_events'::regclass
      and tgname = 'studio_run_events_append_only'
      and not tgisinternal
  ),
  'run event history rejects mutation'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.studio_workflow_runs'::regclass),
  'workflow ledger has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.studio_catalog_entries'::regclass),
  'catalog has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.studio_gameplay_events'::regclass),
  'gameplay event ledger has RLS'
);
select results_eq(
  $$ select count(*)::bigint from public.studio_catalog_entries where status = 'fixture' and discoverable $$,
  array[0::bigint],
  'fixtures are never discoverable'
);

set local role anon;
select results_eq(
  $$ select count(*)::bigint from public.studio_catalog_entries $$,
  array[0::bigint],
  'anonymous players cannot read hidden fixtures'
);
reset role;

select * from finish();
rollback;
