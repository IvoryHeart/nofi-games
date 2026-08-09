# Evaluation suites

Evaluation policy is versioned independently from the agents and artifacts it judges. Every consequential run pins an exact suite version and stores raw evidence outside Git by content hash.

Each `suite.yaml` fixes repetition count, the primary decision metric, protected boundaries, allowed regression, independence, and holdout policy before a challenger runs. A candidate cannot edit the suite or access protected holdout answers. Changing a suite requires an OpenSpec `system-change`; changing an agent uses `agent-evolution`.

`pnpm evals:validate` validates all suite contracts. The control plane's `decideAgentPromotion` function enforces independent evaluation, repetition, evidence, quality improvement, regression protection, and a champion rollback target.
