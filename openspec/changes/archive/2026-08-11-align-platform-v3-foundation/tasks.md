## 1. Establish the reviewed baseline

- [x] 1.1 Recheck that the working branch is `platform-v3-bootstrap`, the worktree contains only this follow-up planning change, PR #24 still targets `platform-v2`, rollback remains `39a9df1` for the follow-up and `201cfdd` for platform v2, and no historical branch/worktree/PR-evidence ref will be mutated.
- [x] 1.2 Classify and audit every current OpenSpec requirement: require observable implementation plus focused tests for runtime/product claims, deterministic repository checks for repository/contributor constraints, and actively governing human policy only for approval, authority, or selection decisions; record unsupported claims in the applicable delta rather than implementing missing features.
- [x] 1.3 Strictly validate `align-platform-v3-foundation`, confirm its six delta paths are the only proposed capability changes, and preserve `retire_capabilities: true` for the evidence-ledger removal.

## 2. Align current behavior and enforcement

- [x] 2.1 Add focused deterministic coverage for the current player catalog and local-pack fail-closed paths needed by the revised `single-player-app` and `game-pack-contract` requirements, without adding identity, networking, updates, rollout, or rollback behavior.
- [x] 2.2 Check the revised game-pack manifest/interface/namespace/identity requirements against the catalog schema, validator, canonical SDK, fixture, and loader; narrow any clause that cannot be demonstrated by source plus the focused checks.
- [x] 2.3 Check the revised research-selection and preview requirements against present human approval rules, GitHub Actions, Vercel integration, disposable Supabase, and Git rollback; keep market and concept evidence as concise sections in the governing OpenSpec change without a custom artifact factory, and remove any implication of an autonomous research queue or configured remote database preview.
- [x] 2.4 Verify `native-harness-workflow` and `studio-execution-boundary` describe current contributor/architecture constraints rather than implemented studio runtime behavior, and update only if the enforcement audit finds another unsupported claim.

## 3. Establish honest fixture-pack reproducibility

- [x] 3.1 Test the SDK-identity hypothesis by adding one unique tracked Godot UID sidecar beside each canonical SDK GDScript, synchronizing them into the fixture/player copies, and verifying sync is exact without committing generated copies; do not record the UIDs as the cause before the independent experiment passes.
- [x] 3.2 Make fixture export remove only its ignored `.godot` import cache before export, and run one two-export clean-cache comparison as the bounded local test of the canonical-UID hypothesis.
- [x] 3.3 Record the differing local hashes, stop reproducibility investigation for this change, remove the equality claim and prospective gate, retain content-addressed artifact hashing and generated-catalog pinning, and continue with accurate documentation.
- [x] 3.4 Confirm that no candidate two-worktree equality comparison or second causal hypothesis remains in this change.

## 4. Remove duplicate and machine-local foundation state

- [x] 4.1 Change CI to run on pull requests and pushes to `main`, add pull-request/ref-scoped stale-run cancellation, and retain both application and disposable-database jobs unchanged.
- [x] 4.2 Remove absolute worktree paths and detached workspace inventory from durable platform-v2 history while retaining the rollback branch, exact commit, non-mutation statement, and retired-architecture summary.
- [x] 4.3 Correct preview/cutover documentation and PR-facing build language to match the verified event topology and exact reproducibility scope; keep future product/runtime capabilities explicitly future-facing.
- [x] 4.4 Verify the retired `openspec/specs/evidence-ledger` capability directory is absent after sync, and establish runtime/product truth through the focused behavior tests and enforcement audit; do not add a forbidden-phrase or prose-blacklist validator.

## 5. Verify, sync, and deliver the review response

- [x] 5.1 Run `pnpm check`, strict OpenSpec validation, focused player/fixture checks, the content-addressed clean-cache build, and `pnpm build:web`; inspect every log and resolve failures without exclusions or swallowed errors.
- [x] 5.2 Review every changed and deleted file, `git diff --check`, generated/large/secret status, current-spec enforcement, and rollback/ref integrity; verify the change adds no autonomous workflow, runtime persistence, monetization, fixed genre, or separate app.
- [x] 5.3 Create one local candidate review-response commit after `39a9df1`, build one clean-cache fixture artifact at that exact source, and verify its generated catalog pins the actual SHA-256. Do not perform a candidate two-worktree equality comparison.
- [x] 5.4 Standard-sync and archive `align-platform-v3-foundation`, delete the retired empty `evidence-ledger` capability directory, rerun strict OpenSpec plus `pnpm check`, and amend the candidate into the final follow-up commit. Perform the content-hash/generated-catalog verification once more at that exact commit. Any unexpected failure SHALL pause for human review rather than starting another hypothesis or amendment loop. Verify the branch has exactly the original bootstrap commit plus that follow-up over `platform-v2`, then push only `platform-v3-bootstrap` without merging.
- [x] 5.5 Update PR #24's body to remove superseded claims, respond to the owner review point-by-point with exact checks and hash scope, and confirm one new GitHub workflow run contains passing application/database jobs plus a passing Vercel preview.
