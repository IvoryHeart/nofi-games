# Preview Infrastructure Specification

## Purpose

Provide reproducible local and branch-isolated environments while reusing the existing GitHub, Supabase, Vercel, domain, and secret integrations.

## Requirements

### Requirement: Local Supabase is disposable and reproducible

The repository SHALL define Supabase migrations and seed data that can recreate a development stack in Docker without production data.

#### Scenario: Fresh agent starts infrastructure

- **WHEN** an agent runs the documented local start and reset commands with Docker available
- **THEN** the same schema, policies, buckets, and non-sensitive fixtures SHALL be recreated

### Requirement: Branches receive isolated previews

The `platform-v2` branch and pull requests SHALL deploy to non-production Vercel and Supabase environments before production cutover.

#### Scenario: Database and app change are pushed

- **WHEN** preview integration is enabled and the branch changes application or Supabase files
- **THEN** the preview SHALL apply migrations, seed non-sensitive fixtures, build the app, and report status to GitHub

### Requirement: Legacy remains recoverable until cutover

The legacy production commit SHALL have an archive branch or tag and a deployable rollback target before main is replaced.

#### Scenario: New platform fails a cutover gate

- **WHEN** the new platform cannot satisfy a protected launch requirement
- **THEN** production SHALL remain on or return to the archived legacy release
