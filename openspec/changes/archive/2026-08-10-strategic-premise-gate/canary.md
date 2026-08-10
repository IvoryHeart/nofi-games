## Cohort and exposure boundary

No shadow/canary cohort was exposed. The independent decision is `REJECT`, so the conditional authorization to create a promoted tag and run integration-favored and construction-favored new prompts never became active.

## Drift and protected metrics

Not measured in canary. Pre-canary protected evaluation already triggered automatic stop conditions:

- unjustified construction was nonzero on all three protected integration-favored repetitions (`3,1,3`);
- unjustified blocking was nonzero on one public durable-agent repetition (`1`);
- layer clarity and outcome preservation regressed globally.

Running a canary after those triggers would violate the frozen promotion rule rather than add qualifying evidence.

## Final promotion or rollback result

- Final promotion: none.
- Promotion tag: none.
- Canary rollback execution: not needed because no challenger version was promoted or exposed.
- Active rollback/champion reference remains `c6b891dc93b659bc0462a7957fd1b93632902870`.
- Challenger and rejection evidence remain preserved for a future, separately defined challenger; no archive or push is authorized.
