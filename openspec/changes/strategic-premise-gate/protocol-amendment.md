# Pre-grading protocol amendment

## Authority and timing

- Owner strategy change: the owner-directed evaluator task received on 2026-08-10 makes Codex/GPT the primary execution environment. Claude Code remains adoptable, but active Claude execution or coverage is no longer a prerequisite for project workflows or this evaluation.
- Amendment frozen at `2026-08-10T00:15:35Z`, before this evaluator opened any candidate response, grading output, or protected answer key.
- This amendment changes only the harness-coverage requirement and the model assignment needed to execute the otherwise-frozen evaluation. The challenger implementation, public fixtures, rubric, suite thresholds, schema, champion source commit, and challenger source commit remain immutable.

## Prior-attempt disposition

- Preserve commit `f28956109c04aff91278fb3e8bef1a1259fb10a3` and `/var/tmp/nofi-strategic-premise-eval-A6h86v/` unchanged as an incomplete, nonqualifying attempt.
- Its original cross-harness plan is `RE-RUN`: the native Claude session cap stopped execution before qualifying grading or verdict. This is missing/infrastructure-limited evidence, not failed candidate quality, and the original plan did not pass.
- Already-produced `gpt-5.6-luna`/`medium` traces and partial Claude traces are supplemental diagnostics only. Their model/reasoning assignments do not match the amended high-thinking run protocol, and the partial Claude set does not provide complete paired coverage. They MUST NOT enter metric aggregates, threshold decisions, or promotion evidence.

## Amended execution protocol

- Run the complete qualifying evaluation in native Codex sessions only.
- Pin every strategic candidate run and every independent grading run to `gpt-5.6-sol` with reasoning effort `xhigh`.
- Retain a minimum of three fresh repetitions for each champion/challenger candidate on all five cases: the three frozen public fixtures and the two independently authored protected holdouts.
- Keep champion/challenger settings matched within each pair. Use separate fresh candidate sessions, neutral prompts, immutable source snapshots, full out-of-Git traces, blinded identities, and fresh separate grader sessions. No candidate grades itself.
- Retain every frozen metric and threshold: `strategic-fit >= 0.8`, `capability-evidence >= 0.8`, `layer-clarity >= 0.8`, `outcome-preservation >= 0.9` with no champion regression, `unjustified-construction = 0`, `unjustified-blocking = 0`, and challenger primary improvement `>= 0.1` after every quality and protected gate passes.
- Retain all failure reporting, distributions, variance, disagreements, manifest-integrity limitations, adversarial leakage/overfitting/unjustified-construction/unjustified-blocking/reward-hacking/reproducibility audits, independent decision, Git-addressable rollback, and bounded shadow/canary requirements.
- The only removed qualification condition is mandatory active Claude execution/coverage. Claude Code remains an adoptable supported harness; this amendment makes no broader workflow, portability, rubric, or threshold change.

## Frozen protected assets

The following independently authored files are reused byte-for-byte. Hashes were computed without opening their content. Candidate sessions receive only the ordinary task prompt from the applicable holdout file; they never receive answer keys, role labels, expected capabilities, scoring notes, rubric text, hypothesis, version identity, or grading hints.

| Protected asset | Precommitted role | SHA-256 |
| --- | --- | --- |
| `holdout/H1-release-health.md` | integration-favored prompt | `673e1281bb21e09d7d32a1f84a8dbed9376a3e30bac9fd69037dd084ecef0450` |
| `holdout/protected/H1-answer-key.md` | grader-only answer key | `59341339fbdecfaf142b77e1c172f4b31fad10eb08a4e2b494f622bd81b26c12` |
| `holdout/H2-determinism-gate.md` | justified-construction-favored prompt | `d03eadd0936f3d9fc15404a96ba15d7afc871bc9250f41b688e9fdb009dc207f` |
| `holdout/protected/H2-answer-key.md` | grader-only answer key | `59d82db87f0cc4f299284e68173e30da2dba40e741ad432c979b1c857e4139be` |

## Amended decision rule

`PROMOTE` only if the three-repetition, five-case Codex evaluation is complete, all public and protected runs meet every frozen suite threshold, the challenger improves mean `strategic-fit` by at least `0.1` after protected gates pass, and independent blinded grading plus adversarial review finds no leakage, unjustified construction, unjustified blocking, lowest-common-denominator bias, reward hacking, or disqualifying integrity failure. `REJECT` on protected regression, unjustified construction, unjustified blocking, or another completed quality failure. `RE-RUN` on missing repetitions, missing independent holdouts or grading, infrastructure failure, or incomplete decision-critical manifests. Missing evidence is never a pass.
