## Environment and manifests

- Independent evaluator: fresh Codex evaluator on `agent/codex/strategic-premise-gate/independent-evaluation`; it did not author the challenger, fixtures, holdouts, rubric, suite, schema, thresholds, or source commits.
- Pre-grading amendment: `81a868687acbf34404e178eb5c3271810422fde9`, committed before candidate, grade, or protected-answer content was opened; formatting-only follow-up `fef9e6d2c9a778df34deda855684dcfc2083f030`.
- Champion: `c6b891dc93b659bc0462a7957fd1b93632902870`; challenger: `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c`.
- Qualifying candidate and grader assignment: Codex CLI `0.147.0`, `gpt-5.6-sol`, `xhigh`, fresh ephemeral sessions, read-only snapshots.
- Raw evidence: `/var/tmp/nofi-strategic-premise-eval-codex-hydBis/`; compact hashes and limitations are in `evidence-manifest.md`.
- The earlier commit `f28956109c04aff91278fb3e8bef1a1259fb10a3` and `/var/tmp/nofi-strategic-premise-eval-A6h86v/` remain an incomplete, nonqualifying `RE-RUN`, not a candidate-quality failure or cross-harness pass.

## Run completeness and integrity

- Candidate matrix: 30/30 qualifying responses = 5 cases × 3 repetitions × champion/challenger. All 30 had unique fresh thread IDs, exact prompt/model/reasoning settings, nonempty response and JSONL hashes, empty stderr, and clean post-run sources.
- Grader matrix: 30/30 first-attempt records = 15 blinded pairs × 2 graders. All had unique fresh thread IDs, schema-constrained output, exact bundle/schema/artifact hashes, empty stderr, and clean before/after sources. No grade was replaced.
- Candidate timing: 19,326 aggregate wall-seconds; range 429–971 seconds. Grader timing: 6,171 aggregate wall-seconds; range 94–395 seconds. Timing is operational provenance, not a quality offset.
- Four candidate attempts produced complete responses but wrapper exit `127` after the wrapper file was replaced while running. They are retained under `failures/`, excluded mechanically, and replaced once with clean identical-setting runs.
- One bounded Luna/xhigh tooling attempt failed before writes because `bwrap` could not initialize loopback. Its trace is retained. The unsandboxed isolated-directory retry produced the mechanical grading utilities; the evaluator reviewed, corrected, syntax-checked, and hash-froze them before use.

## Global metric distributions

Each per-response value is the mean of two independent graders for scalar metrics and the conservative maximum for violation counts. Variance is population variance over 15 response composites.

| Metric                   | Champion mean | Champion variance | Challenger mean | Challenger variance |     Delta |
| ------------------------ | ------------: | ----------------: | --------------: | ------------------: | --------: |
| strategic-fit            |      0.775000 |          0.074040 |        0.908000 |            0.019596 | +0.133000 |
| capability-evidence      |      0.899333 |          0.020936 |        0.919333 |            0.015896 | +0.020000 |
| layer-clarity            |      0.937000 |          0.017313 |        0.922667 |            0.018070 | -0.014333 |
| outcome-preservation     |      0.955333 |          0.018262 |        0.942000 |            0.015426 | -0.013333 |
| unjustified-construction |      1.600000 |          5.573333 |        0.466667 |            1.048889 | -1.133333 |
| unjustified-blocking     |      0.000000 |          0.000000 |        0.066667 |            0.062222 | +0.066667 |

The challenger exceeds the raw primary-improvement target (`+0.133 >= +0.100`) but the improvement is ineligible because protected prerequisites fail.

## Complete per-run distribution

Cases: `case01` cross-platform distribution; `case02` durable coding agents; `case03` game-pack validator; `case04` protected release health (integration-favored); `case05` protected cross-target determinism (justified-construction-favored).

| Case/rep  | Source     |    SF |    CE |    LC |    OP |  UC |  UB |
| --------- | ---------- | ----: | ----: | ----: | ----: | --: | --: |
| case01-r1 | Champion   | 0.980 | 0.975 | 0.985 | 0.990 |   0 |   0 |
| case01-r1 | Challenger | 0.985 | 0.990 | 0.970 | 0.980 |   0 |   0 |
| case01-r2 | Champion   | 0.775 | 0.875 | 1.000 | 1.000 |   1 |   0 |
| case01-r2 | Challenger | 1.000 | 1.000 | 1.000 | 1.000 |   0 |   0 |
| case01-r3 | Champion   | 0.975 | 0.975 | 0.975 | 0.990 |   0 |   0 |
| case01-r3 | Challenger | 0.990 | 0.980 | 0.995 | 0.995 |   0 |   0 |
| case02-r1 | Champion   | 0.825 | 0.935 | 0.945 | 0.990 |   3 |   0 |
| case02-r1 | Challenger | 0.980 | 0.955 | 0.995 | 0.990 |   0 |   0 |
| case02-r2 | Champion   | 0.960 | 0.960 | 0.990 | 0.995 |   0 |   0 |
| case02-r2 | Challenger | 0.835 | 0.870 | 0.925 | 0.835 |   0 |   1 |
| case02-r3 | Champion   | 0.875 | 0.920 | 0.955 | 0.985 |   2 |   0 |
| case02-r3 | Challenger | 0.970 | 0.965 | 0.990 | 0.975 |   0 |   0 |
| case03-r1 | Champion   | 0.965 | 0.925 | 0.965 | 0.995 |   0 |   0 |
| case03-r1 | Challenger | 0.975 | 0.975 | 0.990 | 0.975 |   0 |   0 |
| case03-r2 | Champion   | 0.450 | 0.375 | 0.450 | 0.450 |   0 |   0 |
| case03-r2 | Challenger | 0.500 | 0.500 | 0.500 | 0.500 |   0 |   0 |
| case03-r3 | Champion   | 0.970 | 0.950 | 0.965 | 0.985 |   0 |   0 |
| case03-r3 | Challenger | 0.990 | 0.985 | 0.995 | 0.990 |   0 |   0 |
| case04-r1 | Champion   | 0.325 | 0.865 | 0.930 | 0.985 |   6 |   0 |
| case04-r1 | Challenger | 0.670 | 0.920 | 0.720 | 0.985 |   3 |   0 |
| case04-r2 | Champion   | 0.310 | 0.885 | 0.955 | 0.990 |   6 |   0 |
| case04-r2 | Challenger | 0.910 | 0.935 | 0.895 | 0.975 |   1 |   0 |
| case04-r3 | Champion   | 0.270 | 0.940 | 0.970 | 0.990 |   6 |   0 |
| case04-r3 | Challenger | 0.845 | 0.770 | 0.880 | 0.975 |   3 |   0 |
| case05-r1 | Champion   | 0.970 | 0.955 | 0.985 | 0.990 |   0 |   0 |
| case05-r1 | Challenger | 0.990 | 0.980 | 0.990 | 0.965 |   0 |   0 |
| case05-r2 | Champion   | 0.990 | 0.985 | 1.000 | 1.000 |   0 |   0 |
| case05-r2 | Challenger | 0.990 | 0.985 | 1.000 | 0.995 |   0 |   0 |
| case05-r3 | Champion   | 0.985 | 0.970 | 0.985 | 0.995 |   0 |   0 |
| case05-r3 | Challenger | 0.990 | 0.980 | 0.995 | 0.995 |   0 |   0 |

`case03-r2` is depressed by one schema-valid but semantically incomplete grader output containing “Pending…” rationales and confidence `0`. It remains in the frozen aggregate; it is not discarded or replaced post hoc. The rejection is independently established by unaffected protected count failures.

## Frozen-rule application

| Gate                                       | Result               | Evidence                                                                                                 |
| ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------- |
| Complete 3×5 champion/challenger matrix    | PASS                 | 30/30 canonical candidate runs                                                                           |
| Complete independent blinded grading       | PASS with limitation | 30/30 first-attempt records; one semantic-placeholder grade retained                                     |
| Challenger scalar minima on every response | FAIL                 | `case02-r2` OP 0.835; `case03-r2` all scalars 0.500; `case04-r1` SF 0.670/LC 0.720; `case04-r3` CE 0.770 |
| Unjustified construction exactly 0         | FAIL                 | protected `case04` challenger counts 3, 1, 3                                                             |
| Unjustified blocking exactly 0             | FAIL                 | `case02-r2` challenger count 1                                                                           |
| Per-case higher-metric non-regression      | FAIL                 | seven failed checks across cases 01, 02, 04, and 05                                                      |
| Global higher-metric non-regression        | FAIL                 | LC -0.014333; OP -0.013333                                                                               |
| Primary improvement after prerequisites    | FAIL                 | raw +0.133, but prerequisites failed                                                                     |
| Static validation                          | PASS                 | prior structural evidence plus current deterministic checks recorded below                               |

## Grader variance, disagreements, and failures

- Fifteen disagreements were retained: five substantive scalar/count disagreements outside `case03-r2`, two additional count-granularity disagreements, and eight scalar disagreements caused by the incomplete `case03-r2-g2` record.
- No grader CLI/schema/source failure occurred and no grader record was replaced.
- Full grader-level distributions, rationales, confidence, all 15 disagreements, population variances, and every gate check are in `grading/aggregate.json` (SHA-256 `59c19779d01a94717f4908e4ba0442f94a728ee79ced2aba09185ce207f7cf51`).

## Deterministic repository checks

- `pnpm check`: PASS after bootstrapping the repository-pinned Godot `4.7.1`; this includes formatting, TypeScript, seven tests, skill/premise/OpenSpec/evaluation/workflow/catalog validators, Godot imports, fixture tests, pack export, and single-app pack loading.
- `pnpm build:web`: PASS with the pinned Godot binary and export templates.
- `openspec validate strategic-premise-gate --type change --strict --no-interactive --json`: PASS, one change valid and zero failures.
- The first attempts at `pnpm check` and `pnpm build:web` stopped because this fresh worktree lacked the pinned Godot binary. They performed no grading and are superseded by the successful post-bootstrap runs; the final log paths are hash-frozen in `evidence-manifest.md`.

## Cost and latency after quality gates

Cost was not used or compared because quality and protected gates failed. Wall-time provenance is reported above but cannot offset failure.

## Result

`REJECT`. The challenger materially reduces unjustified construction on average and clears the raw primary-improvement delta, but it violates zero-tolerance protected metrics and regresses protected higher-is-better metrics. No promotion tag or canary is eligible.
