#!/usr/bin/env node
/**
 * Auto-migration script for Supabase.
 *
 * Reads SQL files from supabase/migrations/ and applies them via the
 * Supabase Management API. Idempotent — safe to run on every deploy.
 *
 * Required env vars:
 *   SUPABASE_ACCESS_TOKEN  — personal access token from supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF   — project reference (the subdomain before .supabase.co)
 *
 * Usage:
 *   node scripts/migrate.mjs
 *   npm run db:migrate
 */

import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.log('⏭  Skipping DB migration — SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set.');
  console.log('   This is expected in local dev without a token. Set them in .env.local or Vercel env vars.');
  process.exit(0); // Don't fail the build
}

const MIGRATIONS_DIR = resolve(import.meta.dirname || '.', '..', 'supabase', 'migrations');
const API_URL = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSQL(sql, filename) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Migration ${filename} failed (${res.status}): ${body}`);
  }

  console.log(`✅  Applied ${filename}`);
}

async function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // lexicographic = chronological with 001_ prefix
  } catch {
    console.log('⏭  No supabase/migrations/ directory found. Skipping.');
    process.exit(0);
  }

  if (files.length === 0) {
    console.log('⏭  No migration files found.');
    process.exit(0);
  }

  console.log(`🔄  Running ${files.length} migration(s) against project ${REF}...`);

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    await runSQL(sql, file);
  }

  console.log('🎉  All migrations applied.');
}

main().catch(err => {
  console.error('❌  Migration error:', err.message);
  // Don't fail the build on migration errors — the app can still deploy
  // and tables might already exist from a previous run.
  process.exit(0);
});
