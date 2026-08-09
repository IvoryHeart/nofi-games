create table public.studio_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.studio_workflow_runs(id) on delete cascade,
  workflow text not null check (workflow ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  workflow_version text not null,
  stage text not null check (stage ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  agent text not null check (agent ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  agent_version text not null,
  provider text not null check (provider in ('fake', 'openai')),
  provider_conversation_id text,
  compatibility_fingerprint text not null check (compatibility_fingerprint ~ '^[a-f0-9]{64}$'),
  model_policy_version text not null,
  session_policy_version text not null,
  security_policy_version text not null,
  predecessor_session_id uuid references public.studio_agent_sessions(id),
  latest_checkpoint_id uuid,
  status text not null check (status in ('active', 'rotated', 'closed', 'blocked')),
  accumulated_context_tokens bigint not null default 0 check (accumulated_context_tokens >= 0),
  accumulated_cost_microusd bigint not null default 0 check (accumulated_cost_microusd >= 0),
  turns integer not null default 0 check (turns >= 0),
  turns_since_checkpoint integer not null default 0 check (turns_since_checkpoint >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index studio_one_active_compatible_session
  on public.studio_agent_sessions (workflow_run_id, stage, compatibility_fingerprint)
  where status = 'active';

create table public.studio_stage_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  workflow_run_id uuid not null references public.studio_workflow_runs(id) on delete cascade,
  stage text not null check (stage ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  stage_version text not null,
  session_id uuid not null references public.studio_agent_sessions(id),
  generation integer not null check (generation >= 0),
  input_hashes jsonb not null,
  output_contract_hash text not null check (output_contract_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('planned', 'leased', 'calling', 'reconciling', 'validating', 'accepted', 'failed', 'blocked', 'abandoned')),
  lease_owner text,
  lease_expires_at timestamptz,
  last_lease_owner text,
  last_lease_expires_at timestamptz,
  accepted_checkpoint_id uuid,
  resume_parent_attempt_id uuid references public.studio_stage_attempts(id),
  terminal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lease_owner is null) = (lease_expires_at is null)),
  check ((last_lease_owner is null) = (last_lease_expires_at is null)),
  check ((status = 'accepted') = (accepted_checkpoint_id is not null))
);

create index studio_runnable_attempts
  on public.studio_stage_attempts (status, lease_expires_at, created_at)
  where status in ('planned', 'leased', 'calling', 'validating');

create index studio_reconciling_attempts
  on public.studio_stage_attempts (updated_at)
  where status = 'reconciling';

create table public.studio_agent_checkpoints (
  id uuid primary key,
  session_id uuid not null references public.studio_agent_sessions(id),
  attempt_id uuid not null references public.studio_stage_attempts(id),
  predecessor_checkpoint_id uuid references public.studio_agent_checkpoints(id),
  state jsonb not null,
  state_sha256 text not null check (state_sha256 ~ '^[a-f0-9]{64}$'),
  input_artifacts jsonb not null,
  output_artifacts jsonb not null,
  evidence_manifest_sha256 text not null check (evidence_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  output_contract_sha256 text not null check (output_contract_sha256 ~ '^[a-f0-9]{64}$'),
  version_envelope jsonb not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, state_sha256)
);

alter table public.studio_agent_sessions
  add constraint studio_agent_sessions_latest_checkpoint_fkey
  foreign key (latest_checkpoint_id) references public.studio_agent_checkpoints(id);

alter table public.studio_stage_attempts
  add constraint studio_stage_attempts_accepted_checkpoint_fkey
  foreign key (accepted_checkpoint_id) references public.studio_agent_checkpoints(id);

create table public.studio_model_calls (
  id uuid not null,
  sequence integer not null check (sequence >= 0),
  attempt_id uuid not null references public.studio_stage_attempts(id),
  session_id uuid not null references public.studio_agent_sessions(id),
  provider text not null check (provider in ('fake', 'openai')),
  configured_model text not null,
  resolved_model text,
  model_policy_version text not null,
  provider_conversation_id text,
  provider_response_id text,
  correlation_id text not null,
  status text not null check (status in ('started', 'completed', 'failed', 'reconciliation-required', 'cancelled')),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens is null or cached_input_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens is null or cache_write_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens is null or reasoning_tokens >= 0),
  cost_status text not null check (cost_status in ('priced', 'unpriced')),
  estimated_cost_microusd bigint check (estimated_cost_microusd is null or estimated_cost_microusd >= 0),
  unpriced_reason text check (unpriced_reason is null or unpriced_reason in ('unknown-model', 'missing-usage')),
  price_schedule_id text not null,
  price_schedule_version text not null,
  latency_milliseconds bigint check (latency_milliseconds is null or latency_milliseconds >= 0),
  diagnostic text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (id, sequence),
  unique (correlation_id, sequence),
  check (
    (cost_status = 'priced' and estimated_cost_microusd is not null and unpriced_reason is null)
    or
    (cost_status = 'unpriced' and estimated_cost_microusd is null and unpriced_reason is not null)
  )
);

create unique index studio_unique_provider_response
  on public.studio_model_calls (provider, provider_response_id)
  where provider_response_id is not null;

create index studio_model_calls_by_attempt
  on public.studio_model_calls (attempt_id, id, sequence);

create function public.studio_reject_runtime_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'studio runtime evidence is append-only';
end;
$$;

create trigger studio_agent_checkpoints_append_only
before update or delete on public.studio_agent_checkpoints
for each row execute function public.studio_reject_runtime_record_mutation();

create trigger studio_model_calls_append_only
before update or delete on public.studio_model_calls
for each row execute function public.studio_reject_runtime_record_mutation();

create function public.studio_claim_stage_attempt(
  p_attempt_id uuid,
  p_worker_id text,
  p_lease_seconds integer
)
returns setof public.studio_stage_attempts
language plpgsql
set search_path = ''
as $$
begin
  if length(trim(p_worker_id)) = 0 or p_lease_seconds <= 0 then
    raise exception 'worker id and positive lease duration are required';
  end if;

  return query
  update public.studio_stage_attempts
  set status = 'leased',
      lease_owner = p_worker_id,
      lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
      last_lease_owner = p_worker_id,
      last_lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = statement_timestamp()
  where id = p_attempt_id
    and status in ('planned', 'leased', 'calling', 'validating', 'failed', 'blocked')
    and (
      lease_owner is null
      or lease_owner = p_worker_id
      or lease_expires_at <= statement_timestamp()
    )
  returning *;
end;
$$;

create function public.studio_renew_stage_lease(
  p_attempt_id uuid,
  p_worker_id text,
  p_lease_seconds integer
)
returns setof public.studio_stage_attempts
language sql
set search_path = ''
as $$
  update public.studio_stage_attempts
  set lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
      last_lease_owner = p_worker_id,
      last_lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = statement_timestamp()
  where id = p_attempt_id
    and lease_owner = p_worker_id
    and lease_expires_at > statement_timestamp()
    and p_lease_seconds > 0
    and status in ('leased', 'calling', 'validating')
  returning *;
$$;

create function public.studio_mark_attempt_reconciling(
  p_attempt_id uuid,
  p_worker_id text,
  p_reason text
)
returns setof public.studio_stage_attempts
language sql
set search_path = ''
as $$
  update public.studio_stage_attempts
  set status = 'reconciling',
      lease_owner = null,
      lease_expires_at = null,
      terminal_reason = p_reason,
      updated_at = statement_timestamp()
  where id = p_attempt_id
    and lease_owner = p_worker_id
    and lease_expires_at > statement_timestamp()
    and status in ('leased', 'calling', 'validating')
    and length(trim(p_reason)) > 0
  returning *;
$$;

create function public.studio_accept_agent_checkpoint(
  p_attempt_id uuid,
  p_worker_id text,
  p_checkpoint_id uuid,
  p_predecessor_checkpoint_id uuid,
  p_state jsonb,
  p_state_sha256 text,
  p_input_artifacts jsonb,
  p_output_artifacts jsonb,
  p_evidence_manifest_sha256 text,
  p_output_contract_sha256 text,
  p_version_envelope jsonb
)
returns public.studio_agent_checkpoints
language plpgsql
set search_path = ''
as $$
declare
  claimed public.studio_stage_attempts%rowtype;
  accepted public.studio_agent_checkpoints%rowtype;
begin
  select * into claimed
  from public.studio_stage_attempts
  where id = p_attempt_id
    and lease_owner = p_worker_id
    and lease_expires_at > statement_timestamp()
    and status in ('leased', 'calling', 'validating')
    and accepted_checkpoint_id is null
  for update;

  if not found then
    raise exception 'attempt lease is absent, stale, or already accepted';
  end if;

  insert into public.studio_agent_checkpoints (
    id, session_id, attempt_id, predecessor_checkpoint_id, state, state_sha256,
    input_artifacts, output_artifacts, evidence_manifest_sha256,
    output_contract_sha256, version_envelope
  ) values (
    p_checkpoint_id, claimed.session_id, claimed.id, p_predecessor_checkpoint_id, p_state,
    p_state_sha256, p_input_artifacts, p_output_artifacts, p_evidence_manifest_sha256,
    p_output_contract_sha256, p_version_envelope
  ) returning * into accepted;

  update public.studio_stage_attempts
  set status = 'accepted',
      accepted_checkpoint_id = accepted.id,
      lease_owner = null,
      lease_expires_at = null,
      terminal_reason = null,
      updated_at = statement_timestamp()
  where id = claimed.id;

  update public.studio_agent_sessions
  set latest_checkpoint_id = accepted.id,
      turns_since_checkpoint = 0,
      updated_at = statement_timestamp()
  where id = claimed.session_id;

  return accepted;
end;
$$;

create function public.studio_append_runtime_event(
  p_run_id uuid,
  p_status text,
  p_reason text,
  p_payload jsonb default '{}'::jsonb
)
returns public.studio_run_events
language plpgsql
set search_path = ''
as $$
declare
  next_sequence integer;
  appended public.studio_run_events%rowtype;
begin
  if p_status not in ('planned', 'running', 'evaluating', 'completed', 'failed', 'rolled-back') then
    raise exception 'invalid workflow status';
  end if;
  if length(trim(p_reason)) = 0 then raise exception 'runtime event reason is required'; end if;

  perform 1 from public.studio_workflow_runs where id = p_run_id for update;
  if not found then raise exception 'workflow run does not exist'; end if;

  select coalesce(max(sequence), -1) + 1 into next_sequence
  from public.studio_run_events where run_id = p_run_id;

  insert into public.studio_run_events (run_id, sequence, status, reason, payload)
  values (p_run_id, next_sequence, p_status, p_reason, p_payload)
  returning * into appended;

  update public.studio_workflow_runs set status = p_status where id = p_run_id;
  return appended;
end;
$$;

alter table public.studio_agent_sessions enable row level security;
alter table public.studio_stage_attempts enable row level security;
alter table public.studio_agent_checkpoints enable row level security;
alter table public.studio_model_calls enable row level security;

revoke all on public.studio_agent_sessions from public, anon, authenticated;
revoke all on public.studio_stage_attempts from public, anon, authenticated;
revoke all on public.studio_agent_checkpoints from public, anon, authenticated;
revoke all on public.studio_model_calls from public, anon, authenticated;

grant select, insert, update on public.studio_agent_sessions to service_role;
grant select, insert, update on public.studio_stage_attempts to service_role;
grant select, insert on public.studio_agent_checkpoints to service_role;
grant select, insert on public.studio_model_calls to service_role;

revoke all on function public.studio_claim_stage_attempt(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.studio_renew_stage_lease(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.studio_mark_attempt_reconciling(uuid, text, text) from public, anon, authenticated;
revoke all on function public.studio_accept_agent_checkpoint(uuid, text, uuid, uuid, jsonb, text, jsonb, jsonb, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.studio_append_runtime_event(uuid, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.studio_claim_stage_attempt(uuid, text, integer) to service_role;
grant execute on function public.studio_renew_stage_lease(uuid, text, integer) to service_role;
grant execute on function public.studio_mark_attempt_reconciling(uuid, text, text) to service_role;
grant execute on function public.studio_accept_agent_checkpoint(uuid, text, uuid, uuid, jsonb, text, jsonb, jsonb, text, text, jsonb) to service_role;
grant execute on function public.studio_append_runtime_event(uuid, text, text, jsonb) to service_role;

comment on table public.studio_agent_sessions is 'Bounded provider conversations; accepted checkpoints remain authoritative.';
comment on table public.studio_stage_attempts is 'Idempotent leased workflow-stage attempts with exactly-once acceptance.';
comment on table public.studio_agent_checkpoints is 'Immutable content-addressed accepted agent memory.';
comment on table public.studio_model_calls is 'Append-only model-call lifecycle and usage events.';
