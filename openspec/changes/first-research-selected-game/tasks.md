# Implementation and independent-evaluation task packets

## Frozen planning identity

The change selected **Mossbound Measures 0.1.0**. This file separates a bounded builder
from a fresh independent evaluator; neither role may change its own task, model,
criteria, evaluation plan, or authority.

| Field                               | Frozen value                                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change                              | `first-research-selected-game`                                                                                                                                                      |
| Product-behavior baseline           | `297e07cfd91d471932a8c5354c5afcc19075e677`                                                                                                                                          |
| Concepts/criteria freeze            | `6751fabc575c2196c4e2755f395b38f9ef8e36dd`                                                                                                                                          |
| Criteria fingerprint                | `38bffbd3c109a4ca730655a8acb7e688b8150b37a523ebd790af87482cd678d3`                                                                                                                  |
| Planning input                      | **SELF:** the final coherent commit containing this exact `tasks.md`; the handoff SHALL provide its 40-character hash, and each claimant SHALL record/reject a mismatch before work |
| Planning author task                | `first-research-selected-game/concept-design`                                                                                                                                       |
| Planning task class                 | `high-judgment`                                                                                                                                                                     |
| Planning harness                    | native Codex CLI `0.147.0`                                                                                                                                                          |
| Planning configured model/reasoning | `gpt-5.6-sol`, `xhigh`; resolved model not separately exposed                                                                                                                       |
| Planning raw transcript             | `/var/tmp/nofi-first-game-design-sol.jsonl` (outside Git)                                                                                                                           |
| Game/runtime                        | `mossbound-measures@0.1.0`; Godot `4.7.1` Compatibility; SDK `0.1.0`; player app minimum `0.1.0`                                                                                    |
| Rollback                            | exact SELF planning commit for Git; behavior baseline above; empty/fixture-only nondiscoverable catalog for runtime                                                                 |

At claim time, replace no value in this artifact. Record the handoff's SELF hash in the
native task/run manifest outside Git, verify `HEAD` equals it, and use it as the branch
base and rollback target. This self-resolving reference avoids an impossible commit
self-hash while still requiring an exact immutable input.

## Builder packet

### Identity and authority

| Field                      | Required value                                          |
| -------------------------- | ------------------------------------------------------- |
| Task                       | `first-research-selected-game/game-build`               |
| Stage                      | `research-to-game@0.2.0 / game-build`                   |
| Task class                 | `bounded-implementation`                                |
| Configured model/reasoning | `gpt-5.6-luna`, `xhigh`                                 |
| Harness/version            | native Codex CLI `0.147.0`                              |
| Skill                      | `agents/skills/build-godot-game/SKILL.md`               |
| Claim branch               | `agent/codex/first-research-selected-game/game-build`   |
| Starting commit            | exact SELF planning hash supplied at handoff            |
| Raw transcript             | `/var/tmp/nofi-first-game-build-luna.jsonl` outside Git |

The builder implements only the frozen design. It may correct a mechanical defect when
one uniquely conforming solution exists and tests prove it. It SHALL stop at a coherent
checkpoint and escalate any player-value, mechanic, scenario, architecture, SDK,
evaluation, policy, or access decision.

### Builder writable paths

Only these tracked paths may change:

- `games/candidates/mossbound-measures/**`, excluding any synchronized/generated SDK
  copy under `addons/nofi_sdk/**`;
- `platform/player-app/src/main.gd`;
- `platform/player-app/src/pack_checkpoint_store.gd` and required Godot UID sidecar;
- `platform/player-app/tests/run_candidate_checkpoint_test.gd` and required UID
  sidecar;
- `tools/godot/build-game-pack.mjs`;
- `tools/godot/test-game-in-player.mjs`;
- `package.json`, limited to adding `game:pack` and `game:test-player` scripts; and
- this `tasks.md`, limited to changing builder checkboxes from `[ ]` to `[x]` only after
  their named evidence exists.

Generated, untracked test outputs may be written to:

- `.artifacts/first-research-selected-game/build/**`;
- `.artifacts/packs/mossbound-measures-0.1.0.pck`;
- `platform/player-app/catalog/catalog.generated.json`; and
- `platform/player-app/catalog/packs/mossbound-measures-0.1.0.pck`.

The builder SHALL verify generated outputs are ignored and SHALL NOT stage them.

### Builder forbidden scope

Do not modify market research, frozen concepts/selection/specs/design/eval plan,
canonical `openspec/specs/**`, other change artifacts, `platform/godot-sdk/**`, the pack
loader contract, catalog base/production/release data, other games, agents/skills,
evaluation suites, workflows, docs, control-plane contracts, dependencies/lockfile,
Supabase/infra, secrets, or production data. Do not create network, identity,
monetization, public UGC, live-generation, separate-app, model-client, conversation,
lease, task-coordination, or automatic-routing behavior. Do not write
`verification.md`, `decision.md`, or `retrospective.md`.

### Builder tasks

## 1. Claim and scaffold

- [ ] 1.1 Inspect `git worktree list`, local/remote matching branches, `git status`,
      `git rev-parse HEAD`, and the handoff manifest. Stop on a duplicate claim, dirty
      tracked path, wrong branch, wrong SELF hash, wrong harness/model/reasoning, or missing
      raw-transcript capture. Record configured/resolved model, CLI version, task class,
      source/planning/freeze hashes, skill hash, and writable/forbidden paths in
      `.artifacts/first-research-selected-game/build/run-manifest.json`.
- [ ] 1.2 Read in mandatory order `AGENTS.md`, README, strategy, architecture,
      constitution, canonical research/catalog/pack/player capabilities, the entire active
      change, builder skill, SDK/player/fixture contracts, eval plan, and workflows. Run
      OpenSpec status/instructions for the apply task before edits.
- [ ] 1.3 Run `pnpm game:new -- mossbound-measures` exactly once. Verify it created
      `games/candidates/mossbound-measures`, the scene is data-only, manifest identity is
      exact, SDK sync output is ignored, and only authorized paths changed. Add the exact
      game-local README and file structure from `design.md`; do not copy another game.

## 2. Deterministic domain and scenario proof

- [ ] 2.1 Implement typed rendering-independent model, exact pulse/awake/intent rules,
      canonical JSON/SHA-256, phase machine, one-slot edit, structured prediction, preview,
      six controlled ticks, budgets, settlement, rewind/restart/recovery, objectives, and
      metrics exactly as specified. No wall clock, frame callback, float, UI, RNG draw, or
      telemetry delivery may affect canonical decisions.
- [ ] 2.2 Encode the eight base records, three tutorial fixtures, exact RNG call order,
      eight transforms, intent mapping, tiers, palettes, and scenario IDs from `design.md`.
      Implement deterministic BFS/cache/yield behavior without exposing witnesses.
- [ ] 2.3 Add headless oracle tests for all 1,024 cell cases, order example, preview/commit
      equality, authoring counts, both witnesses under all 64 transforms, exhaustive
      four-commit reachability/diversity, solver distance/no-reach, D4 fairness, malformed
      actions, phase boundaries, optional loss/recovery, and repeated one-depth rewind.
      A mismatch with any frozen record is a high-judgment escalation; do not tune data.

## 3. SDK, replay, telemetry, and progression

- [ ] 3.1 Implement every SDK operation and exact concrete available-action enumeration.
      Validate action keys/types/ranges/phases; return stable reasons/hashes; preserve state
      on rejection; keep rejected diagnostics noncanonical; expose no solver answer.
- [ ] 3.2 Implement replay/checkpoint schema, required per-operation hashes, temporary
      restore model, public-path reexecution, exact tick interruption, mutation rejection,
      same-version-only behavior, and 64 KiB gate. Add fresh-instance tests after every
      action/phase/tick plus maximum-action, repeated-preview/rewind, corrupt/oversize,
      version/hash mismatch, and no-partial-mutation cases.
- [ ] 3.3 Implement the exact telemetry allowlist/common fields and local signal after
      each specified action/tick. Add schema/determinism/consent-independent local-signal
      tests proving no identity, personal/stable/device/raw-text/time field or transport
      client exists.
- [ ] 3.4 Implement tutorial state, noncoercive tier recommendation/unlock-all, 64-entry
      notebook/65th prompt, hide-efficiency, absence behavior, and structured local
      keepsakes. Test no currency, power, streak, daily/date gate, notification, ranking,
      penalty, or continuation advantage.

## 4. UI, access, and input

- [ ] 4.1 Implement programmatic Godot Control UI, exact copy/vocabulary, primitive
      icons, palettes, portrait/landscape reflow, 100–200% text, scroll/focus behavior,
      intent/failure explanations, preview trace, pause/exit/recovery/settle, storage
      warning, and result notebook. Use no external expressive asset or unsourced content.
- [ ] 4.2 Implement every fixed keyboard/controller mapping and focusable touch/pointer
      equivalent with no hover/drag/hold/simultaneous/timing requirement. Implement
      high-contrast, reduced-motion, instant, linear-list, persistent-trace, hide-efficiency,
      and unlock-all settings without changing decision rules.
- [ ] 4.3 Add headless/UI tests for fixed viewports, safe areas, 48×48 targets, contrast,
      label/shape redundancy, focus order/return/no trap, 200% long strings, sound-off,
      reduced/instant motion, input adapter byte parity, and every phase/error screen.

## 5. Shell-owned save and one-app integration

- [ ] 5.1 Implement `NofiPackCheckpointStore` exactly as designed: shell-hashed
      ID/version/PCK/replay key, JSON/64 KiB validation, same-directory temporary write,
      flush/atomic rename, last-valid retention, local event/pause/close/settle/replace
      triggers, consent-independent local save, no pack path/storage handle, and exact
      restore before operable display.
- [ ] 5.2 Integrate the store in player `main.gd` only for a granted `local-save` pack.
      Implement visible Retry/Start clean/Delete behavior, version/hash/rollback isolation,
      storage-denied/full/corrupt handling, and no identity/network fallback. Do not alter
      `pack_loader.gd` or SDK.
- [ ] 5.3 Add the candidate checkpoint integration runner and tests for verified PCK
      load, event-triggered save, kill/relaunch after every logical tick, malformed/oversize
      checkpoint, atomic interruption, no-grant behavior, storage failures, different
      version/hash, rollback key, nondiscoverability, and one in-app surface.

## 6. Deterministic build tooling and package

- [ ] 6.1 Add generic `pnpm game:pack -- <candidate-id>` tooling that reads/validates the
      candidate manifest, uses the pinned Godot/export templates, creates the immutable PCK
      under `.artifacts/packs/<id>-<version>.pck`, hashes it, copies it only to the ignored
      evaluation catalog pack path, and writes a generated `status: candidate`,
      `discoverable: false`, zero-rollout catalog entry. Reject fixtures/promoted paths,
      invalid manifests, duplicate IDs, missing preset, dirty output, or noncandidate
      capability/status rather than infer values.
- [ ] 6.2 Add generic `pnpm game:test-player -- <candidate-id>` tooling that verifies the
      generated entry/hash, runs the pinned player-app import and candidate checkpoint
      runner, and fails on any stderr error or ignored operation. Do not change base or
      production catalog files.
- [ ] 6.3 Build twice from clean game imports. Require byte-identical PCK SHA-256 or
      record/escalate nondeterministic Godot packaging; validate manifest/catalog,
      namespace, data-only scene/script attachment, PCK ≤8 MiB, assets ≤2 MiB, replay ≤64
      KiB, only `local-save`, zero network/native/credential finding, and rollback to the
      exact SELF planning commit plus empty/fixture catalog.

## 7. Builder verification and checkpoints

- [ ] 7.1 Run and retain exact outputs for `pnpm game:test -- mossbound-measures`,
      `pnpm game:pack -- mossbound-measures`,
      `pnpm game:test-player -- mossbound-measures`, direct scenario/performance test
      runners, `pnpm check`, direct Prettier check of authorized tracked files,
      `git diff --check`, strict OpenSpec validation, eval/workflow/catalog validation, and
      a clean-clone repeat. No unavailable platform/human-evidence result may be called
      passed by the builder.
- [ ] 7.2 Maintain
      `.artifacts/first-research-selected-game/build/command-log.jsonl` with command, cwd,
      start/end, exit code, stdout/stderr artifact hash, failure reason, and retry relation.
      Record every failure; never use `|| true`, swallowed exception, ignored Godot error,
      or relabeling. Produce a compact build evidence manifest with requirement coverage,
      hashes, unknowns, and commands; do not write later OpenSpec verification.
- [ ] 7.3 Create coherent commits only after green scoped checks: (A) scaffold + domain +
      headless proofs; (B) UI + shell persistence + tooling/integration; (C) final bounded
      build evidence + permitted task checkboxes. Before each commit inspect
      `git diff --cached --name-only`, `git diff --cached --check`, and untracked paths.
      Final status may contain only known environment symlinks/ignored evidence. Report
      builder commit, PCK hash, raw transcript, checks, failures, rollback, and the explicit
      boundary that no independent evaluation or acceptance occurred.

### Builder escalation rules

Checkpoint useful in-scope work and stop for a fresh Sol/xhigh high-judgment task if:

- any frozen scenario count/witness/rule/threshold is inconsistent or must change;
- achieving correctness requires SDK, pack loader, canonical contract, workflow,
  evaluation plan, dependency, or path outside the writable list;
- save integration cannot remain shell-owned through the existing replay/signal surface;
- an access mode erases the cyclic-order decision or exact input parity is infeasible;
- solver/performance/artifact budgets require mechanic/content reduction;
- a store/IP/safety/privacy issue changes distribution or player promise;
- a check fails nondeterministically, a failure cannot be logged/reproduced, or source is
  dirty/duplicately claimed; or
- requested work would add network, identity, monetization, social/live content,
  separate distribution, or any unaccepted architecture.

Do not silently broaden, tune, route to another model, repair the plan, or mark the
blocked checkbox complete.

## Independent evaluator packet

### Identity and authority

| Field                      | Required value                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Task                       | `first-research-selected-game/independent-game-evaluation`                                                                              |
| Stage                      | `research-to-game@0.2.0 / independent-game-evaluation`                                                                                  |
| Task class                 | `high-judgment`                                                                                                                         |
| Configured model/reasoning | `gpt-5.6-sol`, `xhigh`                                                                                                                  |
| Harness/version            | fresh native Codex CLI `0.147.0`                                                                                                        |
| Skill                      | `agents/skills/evaluate-game/SKILL.md`                                                                                                  |
| Claim branch               | `agent/codex/first-research-selected-game/independent-evaluation`                                                                       |
| Inputs                     | exact SELF planning commit, concepts freeze, builder final commit/PCK hash, eval-plan blob hash, pinned suite/workflow/runtime versions |
| Raw transcript             | `/var/tmp/nofi-first-game-evaluation-sol.jsonl` outside Git                                                                             |

The evaluator SHALL be a fresh instance/thread with no builder role. Source is read-only
and repair is forbidden. If the configured harness/model/reasoning, participant work,
fixed device, protected nonce custody, or evidence storage is unavailable, record it and
return inconclusive/no acceptance.

### Evaluator writable paths

- external content-addressed raw root declared in its run manifest, under
  `/var/tmp/nofi-first-research-selected-game-eval-*/**`;
- `openspec/changes/first-research-selected-game/verification.md`, only after running
  status/instructions and completing or explicitly failing every eval-plan item;
- `openspec/changes/first-research-selected-game/decision.md`, only after verification
  and its own status/instructions;
- `openspec/changes/first-research-selected-game/retrospective.md`, only after decision
  and its own status/instructions; and
- this `tasks.md`, limited to evaluator checkbox completion backed by evidence.

All implementation, planning inputs, specs, suites, holdout procedure, thresholds,
source, game/player/tool files, catalog/release systems, and production systems are
read-only. The evaluator SHALL NOT publish preview/production, change rollout, repair a
defect, or write a canary/live acceptance.

### Evaluator tasks

## 8. Independent claim and evidence freeze

- [ ] 8.1 Verify independent worktree/branch, exact input commits/PCK hash, source
      cleanliness, no duplicate claim, configured/resolved Sol/xhigh and CLI version, skill
      and eval-plan hashes, fixed device/tool availability, adult-study authority, external
      evidence root, and builder/evaluator separation. Run OpenSpec status/instructions
      sequentially and read every dependency before later artifact writes.
- [ ] 8.2 Before candidate execution, generate three external 256-bit nonces, seal each
      hash and timestamp, derive but do not disclose the protected seeds/mutations, freeze
      oracle/instruments/condition assignments/coder rubric/analysis, and prove the builder
      did not receive holdout answers.

## 9. Automated, semantic, visual, access, and performance evaluation

- [ ] 9.1 Execute every public/hidden matrix, ≥3 repetitions, 1,024-case independent
      oracle, all transforms/witnesses/policies, malformed/adversarial/replay/tick/save/
      rollback cases, clean builds/pack loads, and contract/capability/privacy/network
      checks. Retain every failure and raw replay/hash.
- [ ] 9.2 Execute every fixed platform, viewport, input, access-setting, layout/focus/
      contrast/flash, cold-load, 60-second frame/memory/network, and ≥100-repetition
      microbenchmark. Missing tools/devices are failures, not exclusions.
- [ ] 9.3 Repeat the four-surface competitor search within seven days, run seven blinded
      mechanics/IP reviewers, and complete provenance/license/name/copy/safety/privacy/
      telemetry/store-policy reviews without treating them as legal clearance.

## 10. Independent adult player evidence

- [ ] 10.1 Run preregistered wave A with 80 adults and every platform/frequency/access
      minimum, counterbalanced Full/Ablation conditions, desired-stop behavior, exact items
      and blind prompts. Report intention-to-treat, attrition, failures, subgroups, and raw
      external hashes before seeing wave B.
- [ ] 10.2 Run a separately recruited/facilitated wave B with the same frozen protocol;
      do not tune from wave A. Complete the seven-day no-reminder return period for both
      waves, dual blind coding, agreement, condition unlock, point/interval analyses, and
      every protected/countermetric. Synthetic evidence cannot fill participant gaps.

## 11. Verdict, rollback, and durable evidence

- [ ] 11.1 Produce a machine-readable requirement/eval-plan coverage matrix and
      protected-metric table with every numerator/denominator, wave/platform/input/access
      result, uncertainty, failure, unknown, command, raw hash, and reproduction path. Run
      strict checks on the untouched source plus compact evidence artifacts.
- [ ] 11.2 Run OpenSpec `instructions verification` and write only observed results. If
      any gate is failed/missing/inconclusive, say so explicitly. Commit the complete
      verification separately after staged-path/diff/format/strict checks.
- [ ] 11.3 Run OpenSpec `instructions decision` only after verification. Apply the frozen
      verdict logic: at most nondiscoverable `candidate` eligibility or `rejected`; never
      canary/live/production. On failure reproduce rollback to exact SELF planning source
      and empty/fixture catalog. Commit decision separately.
- [ ] 11.4 Run OpenSpec `instructions retrospective` only after decision. Record only
      evidence-backed reusable lessons or explicitly none, route any proposed change
      through a new OpenSpec task, validate full repository/strict OpenSpec, and commit the
      retrospective separately. Report all commits, verdict, rollback, raw transcript, and
      explicit no-production-release boundary.

## Planning command/retry ledger

This ledger records every failed or incomplete authoring attempt in the high-judgment
planning run. It is provenance, not verification evidence. Successful retries are named
so no failure is hidden.

| ID  | Failed/incomplete attempt                                           | Observed result                                                                                            | Successful response                                                                                                     |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| P01 | Read `openspec-update-change` from `/home/ny/.codex/...`            | `wc` reported no such file; no content read                                                                | Retried exact advertised `.agents/skills/...` path and read full skill                                                  |
| P02 | Combined mandatory specs + 586-line market brief read               | Terminal warned combined output was truncated                                                              | Re-read brief in bounded ranges and exact missing evidence rows                                                         |
| P03 | Market brief lines 1–200 in one read                                | Output truncated inside evidence table                                                                     | Re-read smaller ranges and exact E14–E16 rows                                                                           |
| P04 | Market brief lines 81–140 in one read                               | Output again truncated across long table rows                                                              | Used exact-row search plus 200–300, 301–400, 401–500, 501–620 reads                                                     |
| P05 | `pnpm exec prettier --write .../concepts.md`                        | pnpm refused shared symlinked `node_modules` with `ERR_PNPM_UNSAFE_MODULES_DIR`                            | Used pinned `./node_modules/.bin/prettier` directly; dependencies unchanged                                             |
| P06 | First temporary offline scenario-solver run through yielded wrapper | Wrapper completed without returning buffered stdout; no result used                                        | Retried with explicit output/session handling                                                                           |
| P07 | First explicit-result solver retry                                  | Orchestration JavaScript had an invalid inline token and did not start                                     | Returned to the already parsed command form                                                                             |
| P08 | Second long solver run                                              | Nested terminal yielded an inaccessible session; exact retained solver process was resolved and terminated | Replaced with explicit session polling and then a smaller derivation                                                    |
| P09 | Depth-3 quadratic candidate-pair solver                             | Exceeded 90 seconds; cell and exact child processes were terminated, no file written                       | Replaced pair search with bounded depth-2/linear-sized exploration                                                      |
| P10 | Strict all-four ring/refuge authoring search                        | Exited `Error: no 0` after 5,000 candidates                                                                | Treated as disconfirming design evidence; changed both public predicates to at-least-three-of-four before design freeze |
| P11 | First relaxed-predicate search                                      | Exited `Error: no 0`; authoring LCG low bits were visibly correlated                                       | Corrected temporary sampler to high bits; derived all eight records/witnesses/counts in 0.1 s                           |
| P12 | Add telemetry tick row using pre-format table context               | Patch context did not match Prettier-aligned table; no change                                              | Located exact row and reapplied                                                                                         |
| P13 | Combined spec/design coherence patch                                | One wrapped design paragraph prevented entire patch; no change                                             | Applied spec and two exact design hunks separately                                                                      |
| P14 | Replay `post_state_hash` design patch                               | Paragraph wrap differed; no change                                                                         | Located exact lines and reapplied                                                                                       |
| P15 | Format expected change-local eval plan                              | Formatter reported no matching file, exposing accidental root target                                       | Moved exact file into authorized change path and verified root path absent                                              |
| P16 | Move-only `apply_patch` for eval plan                               | Patch engine rejected an empty move hunk; file unchanged                                                   | Retried move with one-line identity hunk                                                                                |
| P17 | Read assumed `tools/godot/build-pack.mjs`                           | Discovery chain stopped because file does not exist                                                        | Read actual tool list/package scripts; bounded packet specifies the missing generic tool                                |
| P18 | Read assumed template `export_presets.cfg`                          | `sed` reported missing file                                                                                | Used fixture export contract; builder task explicitly adds candidate preset through scaffold scope                      |
| P19 | No-op patch against root `design.md`                                | Patch engine rejected nonexistent/empty target; no change                                                  | Applied README/rollback clarification to active change `design.md`                                                      |
| P20 | Broad final `sed` range over `design.md`                            | Tool output exceeded the remaining model-context budget and was truncated                                  | Replaced the broad read with narrow anchored extraction plus an executable scenario-record validator                    |
| P21 | First inline scenario-validator wrapper                             | Nested JavaScript template literals caused the command orchestrator to reject the wrapper before execution | Retried with a delimiter-safe script containing no nested template literals                                             |
| P22 | First executed scenario-validator pass                              | Validator interpreted compact `XY` coordinates as row/column and falsely rejected S6                       | Applied the design's explicit `(X,Y)` column/row convention; all 8 records and 16 witnesses then passed                 |
| P23 | First inline selection-math wrapper                                 | Markdown fence literals again caused the command orchestrator to reject the wrapper before execution       | Removed fence literals from the math check and ran fingerprint verification as a separate shell assertion               |
| P24 | Marker-only fingerprint extraction experiment                       | The experimental extractor did not reproduce the frozen fingerprint                                        | Reused the exact frozen AWK byte-extraction command from the concepts checkpoint; it reproduced the declared SHA-256    |

Any later planning validation failure/retry SHALL be appended before the final planning
checkpoint. Raw command detail is retained in the native transcript above. No source,
implementation, verification, acceptance decision, or retrospective was produced by
this authoring run.
