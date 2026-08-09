create extension if not exists pgcrypto;

create table public.studio_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow text not null check (workflow ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  workflow_version text not null,
  git_commit text not null check (git_commit ~ '^[a-f0-9]{40}$'),
  openspec_change text not null,
  status text not null check (status in ('planned', 'running', 'evaluating', 'completed', 'failed', 'rolled-back')),
  baseline_run_id uuid references public.studio_workflow_runs(id),
  manifest jsonb not null,
  created_at timestamptz not null default now()
);

create table public.studio_run_events (
  run_id uuid not null references public.studio_workflow_runs(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  status text not null check (status in ('planned', 'running', 'evaluating', 'completed', 'failed', 'rolled-back')),
  reason text not null check (length(reason) > 0),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  primary key (run_id, sequence)
);

create table public.studio_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.studio_workflow_runs(id) on delete cascade,
  kind text not null check (kind in ('source', 'test', 'simulation', 'replay', 'visual', 'telemetry', 'feedback')),
  uri text not null,
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null
);

create table public.studio_agent_versions (
  agent_id text not null,
  version text not null,
  git_commit text not null check (git_commit ~ '^[a-f0-9]{40}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  champion boolean not null default false,
  rollback_version text,
  created_at timestamptz not null default now(),
  primary key (agent_id, version)
);

create unique index studio_one_champion_per_agent
  on public.studio_agent_versions (agent_id)
  where champion;

create table public.studio_agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  evaluator_agent_id text not null check (evaluator_agent_id <> agent_id),
  champion_version text not null,
  challenger_version text not null,
  evaluation_suite_version text not null,
  verdict text not null check (verdict in ('promote', 'reject', 'rerun', 'rollback')),
  protected_metrics_passed boolean not null,
  results jsonb not null,
  evidence_manifest_sha256 text not null check (evidence_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (agent_id, champion_version) references public.studio_agent_versions(agent_id, version),
  foreign key (agent_id, challenger_version) references public.studio_agent_versions(agent_id, version)
);

create table public.studio_catalog_entries (
  game_id text not null check (game_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  version text not null,
  title text not null,
  status text not null check (status in ('fixture', 'candidate', 'canary', 'live', 'retired')),
  discoverable boolean not null default false,
  sdk_version text not null,
  minimum_player_app_version text not null,
  entry_scene text not null check (entry_scene like 'res://game_packs/%'),
  entry_script text not null check (entry_script like 'res://game_packs/%'),
  pack_uri text not null,
  pack_sha256 text not null check (pack_sha256 ~ '^[a-f0-9]{64}$'),
  rollout_basis_points integer not null default 0 check (rollout_basis_points between 0 and 10000),
  rollback_version text,
  manifest jsonb not null,
  promoted_by_run_id uuid references public.studio_workflow_runs(id),
  created_at timestamptz not null default now(),
  primary key (game_id, version)
);

create table public.studio_gameplay_events (
  id bigint generated always as identity primary key,
  game_id text not null,
  game_version text not null,
  catalog_version text not null,
  session_id uuid not null,
  player_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_schema_version integer not null check (event_schema_version > 0),
  properties jsonb not null default '{}'::jsonb,
  consent_scope text not null,
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now()
);

create function public.studio_reject_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'studio run events are append-only';
end;
$$;

create trigger studio_run_events_append_only
before update or delete on public.studio_run_events
for each row execute function public.studio_reject_event_mutation();

alter table public.studio_workflow_runs enable row level security;
alter table public.studio_run_events enable row level security;
alter table public.studio_evidence enable row level security;
alter table public.studio_agent_versions enable row level security;
alter table public.studio_agent_evaluations enable row level security;
alter table public.studio_catalog_entries enable row level security;
alter table public.studio_gameplay_events enable row level security;

grant select on public.studio_catalog_entries to anon, authenticated;

create policy "public reads discoverable live catalog"
  on public.studio_catalog_entries
  for select
  to anon, authenticated
  using (status = 'live' and discoverable);

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('game-packs', 'game-packs', false, 104857600),
  ('studio-evidence', 'studio-evidence', false, 524288000)
on conflict (id) do nothing;

comment on table public.studio_workflow_runs is 'Version-pinned durable workflow manifests; runtime events append in studio_run_events.';
comment on table public.studio_catalog_entries is 'Immutable game-pack versions available to the single player app.';
