## Outcome

The repository now states one current default harness and two explicit Codex execution classes while remaining adoptable by Claude Code. The implementation changed only governed specifications and documentation. The complete repository gate passes.

## Evidence-backed lessons

- Model choice is a small, inspectable task-packet policy over native harness capability. It is not a reason to build model invocation, routing, persistence, or coordination infrastructure.
- “Bounded” is more useful than “menial” as the machine-facing distinction: it names settled design, narrow scope, deterministic checks, and limited authority rather than making a subjective claim about difficulty.
- Model policy and acceptance policy are independent. Luna/xhigh receives the same task-specific quality gates; discovering undeclared judgment causes a checkpoint and Sol/xhigh reassignment, not a weaker result.
- Harness portability belongs at the artifact boundary. Claude adoption remains viable because canonical tasks and evidence do not depend on Codex conversation state or OpenAI lifecycle semantics.
- Worktree-local tool prerequisites must be explicit. The initial full check surfaced the missing ignored Godot installation; `pnpm bootstrap` repaired it deterministically, and the rerun passed.

## Improvement suggestions

Collect ordinary task outcomes by execution class before adding any more model-policy complexity. Only a repeated protected-quality, repair-cost, or classification signal should open a challenger policy.
