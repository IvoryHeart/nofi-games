## MODIFIED Requirements

### Requirement: Local Supabase is disposable and reproducible

The repository SHALL define a product-only Supabase baseline and seed data that can recreate catalog and consented gameplay development state in Docker without production data or studio-agent runtime state.

#### Scenario: Fresh agent starts infrastructure

- **WHEN** a contributor runs the documented local start and reset commands with Docker available
- **THEN** the same product schema, policies, buckets, and non-sensitive fixtures SHALL be recreated without workflow runs, agent versions, evaluations, sessions, attempts, checkpoints, model calls, or leases

### Requirement: Branches receive isolated previews

The `platform-v3-bootstrap` branch and pull requests SHALL build the player app and, when preview integration is enabled, use non-production Vercel and product-only Supabase environments before production cutover.

#### Scenario: Database and app change are pushed

- **WHEN** preview integration is enabled and the branch changes application or Supabase files
- **THEN** the preview SHALL apply the product-only migrations, seed non-sensitive fixtures, build the app, and report status to GitHub
