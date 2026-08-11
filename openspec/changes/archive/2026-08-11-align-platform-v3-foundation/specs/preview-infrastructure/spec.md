## MODIFIED Requirements

### Requirement: Branches receive isolated previews

Pull-request updates SHALL run the application and disposable-database jobs once through GitHub Actions, and pushes to `main` SHALL run the same gates after integration. When Vercel preview integration is enabled, a pull request SHALL receive a non-production player-app deployment. Pushes to an open feature branch SHALL NOT start a duplicate copy of the pull-request workflow.

#### Scenario: Pull request is updated

- **WHEN** a commit is pushed to a branch with an open pull request
- **THEN** GitHub SHALL start one workflow run containing the application and database jobs, cancel any stale run for that pull request, and allow Vercel to report its preview independently

#### Scenario: Database and app change are pushed

- **WHEN** application or database files change on a pull-request branch
- **THEN** the one pull-request workflow SHALL build and check the player, reset and test disposable product-only Supabase, and report both jobs without a duplicate push-triggered run

#### Scenario: Main is updated

- **WHEN** an accepted change is pushed to `main`
- **THEN** GitHub SHALL run the application and database gates for the integrated source

### Requirement: Legacy remains recoverable until cutover

The `platform-v2` branch at `201cfdda07e18b41cc5cd4f72a353e3882ab3456` SHALL remain the Git-addressable rollback target until a later directly human-approved cutover supersedes it.

#### Scenario: New platform fails a cutover gate

- **WHEN** platform v3 cannot satisfy a protected launch requirement
- **THEN** the human operator SHALL leave production on or restore it to the preserved rollback target without depending on machine-local worktree state
