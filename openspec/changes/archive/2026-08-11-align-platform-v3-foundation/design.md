## Context

See `proposal.md` for motivation. The review compared current specs with the Godot player and found runtime claims without enforcement. It also observed that two exports from the existing imported fixture produced SHA-256 `8cde096201a57eea433cd26affc4b7f12d45b6b8f5efbdd9997f0f4feab12bdc`, while two exports from a fresh detached worktree produced `7f1ee2923d0663f527f43ae0c533fe5e767f5726fe8438c9e4762a536fb16e36`.

Godot 4.7.1 generates `.gd.uid` sidecars for the SDK scripts in the ignored synced fixture directory, while the canonical SDK source omitted those sidecars and the fixture's own script UID sidecars were canonical and tracked. Workspace-specific SDK script identities were therefore a strong hypothesis for the differing exports, not an established cause. The bounded experiment below did not establish byte equality, so no independent clean-worktree causal investigation follows.

The one permitted local clean-cache comparison falsified byte equality after canonicalizing those UIDs: it produced SHA-256 `6ed18be8af16250aff70c22df2312e6a50e64e5a60fdb8455eb0bada523574bc` and `bbd71f4b3720b30c87666f30e83de6759d8669a05322b85315cbacff646fa7c3`. The change therefore stops causal investigation, performs no candidate two-worktree equality experiment, and uses only content-addressed artifact claims.

## Goals / Non-Goals

**Goals:**

- Make current runtime/product claims traceable to implementation and focused tests, repository constraints to deterministic checks, and approval, authority, or selection decisions to actively governing human policy.
- Remove the empty architectural promise represented by `evidence-ledger`.
- Accurately bound fixture-pack build claims through one causal experiment and content-addressed artifact verification.
- Remove duplicate CI executions without reducing gates.
- Keep durable history machine-independent.

**Non-Goals:**

- Implement any player service named by the removed requirements.
- Implement research, orchestration, run-record, promotion, release, or rollback automation.
- Investigate a second fixture-build reproducibility hypothesis after the canonical-SDK-UID experiment.
- Guarantee byte-identical Godot output across different engine versions, operating systems, architectures, or export settings.
- Rewrite the already archived bootstrap record; Git preserves what that change claimed and the follow-up records its correction.

## Decisions

### Current specs use an enforcement matrix

Classify every current `SHALL` before auditing its enforcement. A product/runtime claim requires observable source plus focused deterministic tests. A repository or contributor constraint requires a deterministic repository check. Human-owned policy is sufficient only for approval, authority, and selection decisions it actively governs; it cannot stand in for runtime truth. Rewrite product requirements around the actual bundled catalog, local PCK loader, SDK contract fixture, catalog schema, GitHub workflow, and human selection policy. Remove statements supported only by product direction.

Alternative: weaken `change-governance` so current specs may contain aspirations. Rejected because that would evade the review and make current capability discovery unreliable.

### Evidence-ledger is retired rather than renamed

Delete the current capability after syncing its removal delta. `studio-execution-boundary` already states that any future run record contains facts rather than authority. A new run-record capability should be named from its concrete implementation need rather than preserving a prototype abstraction.

Alternative: rename the one hypothetical requirement to `run-records`. Rejected because there is no run-record implementation to specify.

### The sole canonical-UID reproducibility hypothesis was falsified

The experiment tracked one UID sidecar beside each canonical SDK GDScript, synchronized those inputs into every game/player project, removed only the fixture's ignored import cache, and compared two clean-cache exports once. The differing hashes above show that canonical UIDs do not establish byte-identical output. The tracked sidecars remain canonical SDK inputs, but the repository makes no claim that they solve PCK reproducibility.

The normal check now performs one clean-cache export, computes its actual SHA-256 hash, writes that hash into the generated catalog, and proves the player rejects other bytes. It does not compare builds or gate on equality. No second causal hypothesis, normalization, PCK post-processing, or candidate two-worktree equality experiment is in scope.

After implementation and documentation pass locally, create a local candidate commit and verify only the content hash and generated-catalog relationship actually claimed. Sync and archive the OpenSpec change, amend the candidate into the final follow-up commit, and perform that content-addressed verification once more at the exact final commit before pushing. An unexpected final failure SHALL pause for human review and SHALL NOT start another hypothesis, amendment, or worktree loop. Uncommitted source SHALL NOT be described or tested as the same commit.

Alternative before the experiment: immediately document same-workspace repeatability. It was rejected as the first choice because the missing canonical UID inputs were a small owned cause worth testing once; the failed comparison now selects the narrower content-addressed fallback. Alternative: promise universal reproducible builds. Rejected because the evidence does not support even same-platform clean-cache byte equality.

### One workflow event owns each verification

Keep `pull_request` for feature review and `push` only for `main`. Add a concurrency key scoped to the pull-request number or pushed ref and cancel stale runs. Both existing application and database jobs remain unchanged.

Alternative: keep both triggers and skip jobs conditionally. Rejected because event topology is clearer and avoids creating redundant workflow runs at all.

### Durable history keeps refs, not workstation topology

Keep the platform-v2 branch, exact commit, non-mutation promise, and architecture summary. Remove absolute worktree paths and detached workspace inventory because they are ephemeral local state rather than durable product history.

## Risks / Trade-offs

- **Canonical UID sidecars did not eliminate nondeterministic PCK input** → Preserve the differing hashes, stop causal investigation, and fail closed to content-addressed wording without another hypothesis.
- **Deleting the fixture import cache increases check time** → Limit deletion to the ignored fixture `.godot` directory and measure the normal check; correctness takes precedence over a small import cost.
- **A UID collision could corrupt imports** → Check sidecar uniqueness, run Godot imports and contract tests, and inspect all engine output.
- **Narrower specs could accidentally discard a real invariant** → Preserve single-app distribution, namespace/integrity checks, research-gated selection, fixture hiding, authority policy, and Git rollback explicitly.
- **Removing the feature-branch push trigger changes status naming** → Verify the updated PR produces exactly one workflow run with both required jobs and that `main` remains in the push filter.

## Migration Plan

1. Add and strictly validate the follow-up deltas before implementation.
2. Correct specs through standard OpenSpec sync, retire `evidence-ledger`, and leave future direction in product/architecture documents.
3. Record the one local canonical-UID experiment's differing hashes, end reproducibility investigation, and adopt content-addressed wording without another causal hypothesis or equality gate.
4. Deduplicate CI, remove local paths from history/runbook claims, run all local checks, and create one local candidate review-response commit after `39a9df1`.
5. At the candidate commit, verify the generated catalog pins the actual clean-cache fixture artifact hash; do not perform a two-worktree equality experiment.
6. Sync and archive the follow-up, amend the candidate into the final commit, and perform the content-addressed verification once more before updating and pushing PR #24 without merging; any unexpected failure pauses for human review.

Rollback reverts the follow-up commit to `39a9df1139c4d2170b8e2502b61c74bb83836232`; no platform-v2 or evidence ref moves.

## Retrospective

- Canonical SDK UID inputs and a clean import cache were insufficient for byte-identical Godot PCK output. The reusable rule is to bound causal build investigations before implementation, preserve disconfirming hashes, and fall back to content-addressed artifacts without opening another hypothesis in the same cleanup.
- Current requirements are easier to audit when runtime/product behavior, repository constraints, and human approval/authority/selection policy have distinct enforcement rules.
- The change used the Codex harness with high-judgment planning followed by bounded implementation. The repository session did not expose the configured or resolved model identifier or reasoning-effort setting, so no more specific provenance claim is made.
