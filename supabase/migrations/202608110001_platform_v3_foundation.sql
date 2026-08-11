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
  consent_scope text not null check (length(trim(consent_scope)) > 0),
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now()
);

alter table public.studio_catalog_entries enable row level security;
alter table public.studio_gameplay_events enable row level security;

grant select on public.studio_catalog_entries to anon, authenticated;

create policy "public reads discoverable live catalog"
  on public.studio_catalog_entries
  for select
  to anon, authenticated
  using (status = 'live' and discoverable);

insert into storage.buckets (id, name, public, file_size_limit)
values ('game-packs', 'game-packs', false, 104857600)
on conflict (id) do nothing;

comment on table public.studio_catalog_entries is 'Immutable game-pack versions available to the single player app.';
comment on table public.studio_gameplay_events is 'Consented product gameplay observations; not studio orchestration state.';
