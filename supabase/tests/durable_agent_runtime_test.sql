begin;

select plan(27);

select has_table('public', 'studio_agent_sessions', 'agent sessions exist');
select has_table('public', 'studio_stage_attempts', 'stage attempts exist');
select has_table('public', 'studio_agent_checkpoints', 'agent checkpoints exist');
select has_table('public', 'studio_model_calls', 'model call events exist');

select ok((select relrowsecurity from pg_class where oid = 'public.studio_agent_sessions'::regclass), 'session RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_stage_attempts'::regclass), 'attempt RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_agent_checkpoints'::regclass), 'checkpoint RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_model_calls'::regclass), 'model-call RLS enabled');

select results_eq(
  $$ select count(*)::bigint from pg_policy where polrelid in (
    'public.studio_agent_sessions'::regclass,
    'public.studio_stage_attempts'::regclass,
    'public.studio_agent_checkpoints'::regclass,
    'public.studio_model_calls'::regclass
  ) $$,
  array[0::bigint],
  'studio runtime tables expose no browser policies'
);

insert into public.studio_workflow_runs (
  id, workflow, workflow_version, git_commit, openspec_change, status, manifest
) values (
  '10000000-0000-4000-8000-000000000001', 'research-to-game', '0.1.0',
  repeat('0', 40), 'durable-agent-runtime', 'running', '{}'::jsonb
);

insert into public.studio_agent_sessions (
  id, workflow_run_id, workflow, workflow_version, stage, agent, agent_version,
  provider, compatibility_fingerprint, model_policy_version, session_policy_version,
  security_policy_version, status
) values (
  '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  'research-to-game', '0.1.0', 'opportunity-research', 'researcher', '0.1.0', 'fake',
  repeat('a', 64), '0.1.0', '0.1.0', '0.1.0', 'active'
);

insert into public.studio_stage_attempts (
  id, idempotency_key, workflow_run_id, stage, stage_version, session_id,
  generation, input_hashes, output_contract_hash, status
) values (
  '30000000-0000-4000-8000-000000000001', repeat('b', 64),
  '10000000-0000-4000-8000-000000000001', 'opportunity-research', '0.1.0',
  '20000000-0000-4000-8000-000000000001', 0,
  jsonb_build_object('question', repeat('c', 64)), repeat('d', 64), 'planned'
);

select results_eq(
  $$ select count(*)::bigint from (
    select * from public.studio_claim_stage_attempt(
      '30000000-0000-4000-8000-000000000001', 'worker-01', 60
    )
  ) claimed $$,
  array[1::bigint],
  'first worker claims the attempt'
);

select results_eq(
  $$ select sum(claimed)::bigint from (
    select (
      select count(*) from public.studio_claim_stage_attempt(
        '30000000-0000-4000-8000-000000000001', 'worker-' || lpad(n::text, 2, '0'), 60
      )
    ) claimed
    from generate_series(2, 20) n
  ) races $$,
  array[0::bigint],
  'nineteen competing workers cannot steal the live lease'
);

select results_eq(
  $$ select count(*)::bigint from public.studio_renew_stage_lease(
    '30000000-0000-4000-8000-000000000001', 'worker-01', 120
  ) $$,
  array[1::bigint],
  'current worker renews the lease'
);

update public.studio_stage_attempts
set lease_expires_at = statement_timestamp() - interval '1 second'
where id = '30000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select count(*)::bigint from public.studio_claim_stage_attempt(
    '30000000-0000-4000-8000-000000000001', 'worker-02', 60
  ) $$,
  array[1::bigint],
  'a new worker can claim an expired lease'
);

select throws_ok(
  $$ select public.studio_accept_agent_checkpoint(
    '30000000-0000-4000-8000-000000000001', 'worker-01',
    '40000000-0000-4000-8000-000000000001', null, '{}'::jsonb, repeat('e', 64),
    '[]'::jsonb, '[]'::jsonb, repeat('f', 64), repeat('d', 64), '{}'::jsonb
  ) $$,
  'P0001',
  'attempt lease is absent, stale, or already accepted',
  'stale worker cannot accept a checkpoint'
);

select lives_ok(
  $$ select public.studio_accept_agent_checkpoint(
    '30000000-0000-4000-8000-000000000001', 'worker-02',
    '40000000-0000-4000-8000-000000000001', null,
    '{"conclusions":[],"assumptions":[],"unresolvedQuestions":[],"nextAction":"continue"}'::jsonb,
    repeat('e', 64), '[]'::jsonb, '[]'::jsonb, repeat('f', 64), repeat('d', 64),
    '{"gitCommit":"0000000000000000000000000000000000000000"}'::jsonb
  ) $$,
  'current worker atomically accepts a checkpoint'
);

select results_eq(
  $$ select count(*)::bigint from public.studio_stage_attempts
     where id = '30000000-0000-4000-8000-000000000001'
       and status = 'accepted'
       and accepted_checkpoint_id = '40000000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'attempt has exactly one accepted checkpoint'
);

select results_eq(
  $$ select count(*)::bigint from public.studio_claim_stage_attempt(
    '30000000-0000-4000-8000-000000000001', 'worker-03', 60
  ) $$,
  array[0::bigint],
  'completed replay cannot claim or invoke again'
);

select throws_ok(
  $$ update public.studio_agent_checkpoints set state = '{}'::jsonb
     where id = '40000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'studio runtime evidence is append-only',
  'checkpoint mutation is rejected'
);

insert into public.studio_model_calls (
  id, sequence, attempt_id, session_id, provider, configured_model, model_policy_version,
  correlation_id, status, cost_status, unpriced_reason, price_schedule_id, price_schedule_version
) values (
  '50000000-0000-4000-8000-000000000001', 0,
  '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  'fake', 'fake-deterministic', '0.1.0', 'call-1', 'started', 'unpriced', 'missing-usage',
  'openai-2026-08-09', '0.1.0'
);

select lives_ok(
  $$ insert into public.studio_model_calls (
    id, sequence, attempt_id, session_id, provider, configured_model, resolved_model,
    model_policy_version, provider_response_id, correlation_id, status, input_tokens,
    output_tokens, cost_status, estimated_cost_microusd, price_schedule_id,
    price_schedule_version, completed_at
  ) values (
    '50000000-0000-4000-8000-000000000001', 1,
    '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    'fake', 'fake-deterministic', 'fake-deterministic', '0.1.0', 'fake-response-1',
    'call-1', 'completed', 10, 5, 'priced', 0, 'openai-2026-08-09', '0.1.0', now()
  ) $$,
  'terminal model-call event appends after start'
);

select throws_ok(
  $$ delete from public.studio_model_calls where id = '50000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'studio runtime evidence is append-only',
  'model-call deletion is rejected'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.studio_agent_checkpoints'::regclass
      and tgname = 'studio_agent_checkpoints_append_only' and not tgisinternal
  ),
  'checkpoint append-only trigger exists'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.studio_model_calls'::regclass
      and tgname = 'studio_model_calls_append_only' and not tgisinternal
  ),
  'model-call append-only trigger exists'
);

select results_eq(
  $$ select count(*)::bigint from public.studio_model_calls
     where id = '50000000-0000-4000-8000-000000000001' $$,
  array[2::bigint],
  'model call has immutable start and terminal events'
);

select lives_ok(
  $$ select public.studio_append_runtime_event(
    '10000000-0000-4000-8000-000000000001', 'failed', 'budget-exhausted',
    '{"reason":"hard-context-limit","resumable":true}'::jsonb
  ) $$,
  'budget stop appends a workflow event transactionally'
);

select results_eq(
  $$ select count(*)::bigint from public.studio_run_events
     where run_id = '10000000-0000-4000-8000-000000000001'
       and reason = 'budget-exhausted' and payload ->> 'resumable' = 'true' $$,
  array[1::bigint],
  'budget event preserves its resumable reason payload'
);

set local role anon;
select throws_ok(
  $$ select count(*) from public.studio_agent_sessions $$,
  '42501',
  null,
  'anonymous role cannot read studio sessions'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.studio_claim_stage_attempt(uuid, text, integer)',
    'EXECUTE'
  ),
  'anonymous role cannot execute studio lease functions'
);
reset role;

select * from finish();
rollback;
