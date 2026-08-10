## Independent verdict

`REJECT`.

This verdict is authored by the fresh independent Codex evaluator, not the challenger author. The original Claude-led attempt remains `RE-RUN`/incomplete; this verdict applies only the amended native-Codex protocol committed before grading.

## Frozen-rule application

- Evidence completeness: 30/30 fresh candidate runs and 30/30 fresh blinded grader runs exist with pinned sources/settings, three repetitions, all three public cases, both protected holdouts, clean sources, retained failures, and exact raw hashes.
- Primary metric: raw challenger strategic-fit improvement is `+0.133`, exceeding `+0.100`.
- Protected prerequisites: fail. Challenger unjustified-construction counts on protected integration-favored `case04` are `3,1,3`, not `0,0,0`; challenger unjustified-blocking is `1` on `case02-r2`.
- Scalar prerequisites: fail on multiple runs, including protected `case04-r1` strategic fit `0.670` and layer clarity `0.720`.
- Non-regression: fail. Global layer clarity regresses `-0.014333` and outcome preservation regresses `-0.013333`; seven per-case checks also regress.
- Independent adversarial review found repeated redundant persistence/action/dashboard/ingestion boundaries, one blocking tendency, shared-filesystem leakage risk without observed answer access, and a semantic-placeholder grader limitation. None reverses the protected count failures.

The frozen rule does not allow average improvement, verbosity, citations, lower construction counts, timing, or cost to compensate for a protected failure. `REJECT` is therefore mandatory.

## Promotion tag or rollback target

- Promotion tag: none created.
- Promoted version: none created.
- Canary: not eligible and not run.
- Rollback/champion target remains `c6b891dc93b659bc0462a7957fd1b93632902870`.
- Challenger source `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c` and all evidence remain preserved for diagnosis; rejection does not rewrite either source commit.
