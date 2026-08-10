## Requirement-to-evidence map

| Requirement                                         | Evidence                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Codex is the default while Claude remains adoptable | Strict OpenSpec validation plus repository-text assertions over `AGENTS.md`, `CLAUDE.md`, the runbook, and the canonical spec |
| Task class determines the Codex default             | Strict OpenSpec validation and repository-text assertions for both model IDs, `xhigh`, both classes, and the escalation rule  |
| Model provenance remains inspectable                | Spec/runbook consistency assertion and review of this change's verification record                                            |

## Protected metrics

- OpenSpec strict-validation failures: `0`.
- Full repository check failures: `0`.
- New model client, router, scheduler, provider SDK, or database coordination code: `0`.
- Acceptance-gate reductions: `0`.
- Claude adoption dependence on Codex conversation state: `0`.
- Consequential task-policy documents missing either task class, model ID, reasoning effort, or escalation behavior: `0`.

## Rollback triggers

Roll back or challenge the policy if a protected metric fails, bounded tasks repeatedly require avoidable repair, task classification is persistently ambiguous, or Claude can no longer consume the canonical artifact protocol independently.
