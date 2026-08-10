## 1. Challenger

- [x] 1.1 Record the reproduced failure, falsifiable hypothesis, exact diff, rollback, and
      proportional frozen evaluation plan.
- [x] 1.2 Add the shared execution policy and update all agent definitions, skills, and default
      prompts.
- [x] 1.3 Add strict workflow/agent contracts, migrate all manifests, and update durable specs,
      templates, and the native runbook.
- [x] 1.4 Add negative policy regressions and validator enforcement.
- [x] 1.5 Run final focused and repository validation after the last relevant source change,
      then commit the exact challenger.

## 2. Independent evaluation

- [x] 2.1 Run the frozen bounded review from a fresh evaluator without source repair.
- [x] 2.2 Record raw results, exact hashes, protected metrics, and the independent verdict.

## 3. Rejected challenger repair

- [x] 3.1 Preserve the rejected verdict and implement the owner-authorized minimum repair:
      required failed, unmet, unknown, or deliberately unrun gates prohibit acceptance.
- [x] 3.2 Cap automated reruns at two and require a frozen human-review or park disposition
      after the second unsuccessful rerun.
- [ ] 3.3 Rerun the bounded independent review against the repaired challenger from a
      worktree with local dependencies.

## 4. Decision and canary

- [ ] 4.1 Integrate only an accepted challenger and record its Git-only rollback.
- [ ] 4.2 Observe the next three governed tasks for post-decision work, hidden unmet gates, or
      premature stopping; promote finally or roll back.
