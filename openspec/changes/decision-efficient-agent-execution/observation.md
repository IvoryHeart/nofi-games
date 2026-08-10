## Agent and affected versions

- Subject: all eight repository agents at `0.1.0`, especially `game-builder`,
  `game-evaluator`, and both agent-evolution roles.
- Champion source: `6860b6cefeb37fa6349a46b87004e58907ae8a5c`.
- Reproduced workflow: `first-research-selected-game`, build commit
  `6a4fdca660bd276a2f0a52c64a7baa12c0fc4de2`.
- Native runs: Codex CLI `0.147.0`; Luna/xhigh builder and Sol/xhigh evaluator.

## Reproducible observation

The builder and evaluator optimized for evidence volume instead of the earliest trustworthy
decision. The builder retained a large native context through broad closure work. The
evaluator then reread large accepted research and source artifacts, constructed a private
evaluation framework, sealed protected data, and repeated broad tests after static inspection
had already found acceptance-blocking product defects and confirmed that required human and
device evidence was unavailable. It was interrupted by the repository owner before writing a
verdict or evaluation commit.

The failure is reproducible from the champion contracts:

- `evaluate-game` orders a full matrix and says to report all planned results, but declares no
  cheapest-first order or decisive-failure stop.
- workflow stages require `complete-results` but do not distinguish result accounting from
  executing irrelevant or unavailable checks;
- task packets declare class and acceptance evidence but no retry, probe, unavailable-gate,
  context-reset, or hard-stop boundary;
- `evolve-agent` requires repeated trials without distinguishing deterministic policy
  guardrails from probabilistic capability claims; and
- normalized cost is discussed only after quality, so context amplification is not protected
  once a task can claim rigor.

## Evidence, frequency, and impact

- `/var/tmp/nofi-first-game-build-luna.jsonl` line 471 records one retained builder turn with
  `19,912,236` input tokens (`19,505,920` cached), `108,115` output tokens, and `42,213`
  reasoning tokens.
- `/var/tmp/nofi-first-game-evaluation-sol.jsonl` reached `1,076,166` bytes before interruption
  and contains no final usage or verdict record because the run was stopped.
- The evaluator created nine frozen evaluation-program or packet files, 96 derived protected
  cases, 160 study-assignment slots, and three complete candidate-suite repetitions before
  writing the decision.
- Static audit had already identified hard failures: no three-stage tutorial progression,
  helper-only wide-layout claims, non-applied 200% text scaling, presentation settings without
  their promised effects, and telemetry without required-key/type enforcement.
- Android, iOS, participant, and several device gates were known unavailable. Their absence
  already prohibited acceptance.
- Impact: high model/context consumption, delayed feedback, no committed independent verdict,
  and direct owner intervention. One observed end-to-end game workflow is enough to challenge
  the policy because the failure is high-cost and its enabling instructions are directly
  inspectable; it is not enough to claim the challenger has improved future behavioral runs.

## Alternative explanations

- A promotion candidate that survives hard gates may justify broad simulations, devices, and
  participant studies. This candidate had not survived them.
- Protected holdouts are valuable for probabilistic claims. They were not needed to establish
  visible deterministic UI/tutorial contract failures.
- Long native contexts can preserve useful uncommitted reasoning. Here Git/OpenSpec already
  held the accepted task and coherent build checkpoints.
- The evaluator's evidence was technically careful. The defect was ordering and stopping, not
  a lack of rigor.
