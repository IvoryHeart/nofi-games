## Environment and manifests

- Challenger implementation commit: `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c`
- Champion: `c6b891dc`, as pinned in `challenger.md`
- Structural evaluation environment: Codex CLI `0.147.0`, Node.js `24.19.0`, pnpm `11.21.0`, OpenSpec `1.8.0`
- Claude Code `2.1.220` is installed, but no candidate-authored Claude evaluation was substituted for independent evidence.
- Skill, prompt, tool, workflow, policy, public fixture, rubric, and suite hashes are pinned in `challenger.md`.

## Quality results and variance

| Planned result                     | Champion              | Challenger                                    | Status                          |
| ---------------------------------- | --------------------- | --------------------------------------------- | ------------------------------- |
| Structural skill validation        | No premise skill      | Quick validator passed                        | Complete                        |
| System-change premise prerequisite | Absent                | Present and validated for both system changes | Complete                        |
| Full repository regression         | Prior baseline passed | `pnpm check` and web export passed            | Complete                        |
| Public fixture repetitions         | Not run               | Not run                                       | Missing independent paired runs |
| Protected holdout                  | Not run               | Not run                                       | Missing independent evaluator   |
| Codex/Claude paired coverage       | Not run               | Not run                                       | Missing                         |

No strategic-fit score, primary improvement, distribution, or variance is reported because no qualifying independent runs occurred. Missing results are not encoded as zero or pass.

## Protected metrics and failures

- Outcome preservation: structurally protected in the frozen rubric; not independently scored.
- Capability evidence, layer clarity, unjustified construction, and unjustified blocking: frozen; not independently scored.
- Existing repository checks: pass with zero observed regression.
- Promotion integrity: pass so far because the candidate author has not promoted the challenger.
- Required independent/public/holdout evidence: fail-closed as missing.

## Cost and latency after quality gates

Not evaluated. Quality gates have not been independently passed, so cost and latency are intentionally excluded from the decision.

## Raw trace references

- Deterministic command evidence is summarized in `../archive/2026-08-09-native-harness-workflow/verification.md`.
- Public prompts: `evals/fixtures/strategic-premise/public/`.
- Frozen rubric: `evals/fixtures/strategic-premise/rubric.md`.
- Frozen suite: `evals/suites/strategic-premise/v1/suite.yaml`.
- No protected holdout traces exist in candidate-visible storage.
