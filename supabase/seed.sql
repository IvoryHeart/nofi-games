insert into public.studio_catalog_entries (
  game_id,
  version,
  title,
  status,
  discoverable,
  sdk_version,
  minimum_player_app_version,
  entry_scene,
  entry_script,
  pack_uri,
  pack_sha256,
  rollout_basis_points,
  manifest
) values (
  'contract-smoke',
  '0.1.0',
  'Contract Smoke Fixture',
  'fixture',
  false,
  '0.1.0',
  '0.1.0',
  'res://game_packs/contract_smoke/main.tscn',
  'res://game_packs/contract_smoke/main.gd',
  'local://contract-smoke-0.1.0.pck',
  repeat('0', 64),
  0,
  '{"schemaVersion":1,"discoverable":false,"entryScene":"res://game_packs/contract_smoke/main.tscn","entryScript":"res://game_packs/contract_smoke/main.gd"}'::jsonb
) on conflict (game_id, version) do nothing;
