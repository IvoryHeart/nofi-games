## Context

See `proposal.md`. Codex and Claude Code already execute natively; OpenSpec and Git are the shared durability boundary. The policy must change assignment defaults without recreating either harness.

## Goals / Non-Goals

**Goals:**

- Make the common assignment deterministic and understandable from repository artifacts.
- Spend Sol/xhigh on work where judgment changes outcomes and Luna/xhigh on work with settled boundaries.
- Preserve identical quality gates and a clean escalation path.
- Keep Claude Code adoption possible without requiring dual-harness execution.

**Non-Goals:**

- Benchmarking every current or future OpenAI model.
- Building automatic task classification or model routing.
- Starting, monitoring, or persisting native harness sessions from repository code.
- Requiring cross-vendor agreement for ordinary acceptance.

## Decisions

### 1. Classify the task packet, not the agent identity

The task author records one of two execution classes. A named agent may perform both classes on different tasks; long-lived role names do not hard-code a model. This avoids duplicating agent definitions solely for model choice.

### 2. Treat boundedness as a contract

A bounded implementation task needs settled design, a narrow writable scope, deterministic acceptance checks, and no strategy or promotion authority. Documentation edits, mechanical refactors, test additions against an accepted contract, and scoped implementation are typical examples. “Easy” is not sufficient: ambiguity moves the work to high judgment.

### 3. Use high judgment for decisions with broad blast radius

Sol/xhigh is the default for market and product strategy, system architecture, premise validation, unfamiliar diagnosis, ambiguous design, adversarial evaluation, and promotion or rejection. The defining property is consequential judgment, not code volume.

### 4. Escalate by checkpoint and reassignment

Luna does not silently broaden a task or alter its own model policy. It commits or records completed bounded evidence and returns the unresolved decision. A Sol/xhigh task then resolves the decision; bounded implementation may resume afterward. Codex performs both invocations natively.

### 5. Preserve harness portability at the artifact boundary

`AGENTS.md` is canonical and `CLAUDE.md` remains a thin entry point. Claude Code may later execute any task using the same OpenSpec change, worktree, commits, checks, and evidence. Claude does not need to emulate Codex model names, and Codex tasks do not wait for Claude coverage unless explicitly required.

## Risks / Trade-offs

- [A task is mislabeled as bounded] → Preserve acceptance gates and require escalation on undeclared judgment.
- [Luna produces more repair work for a task class] → Record failures by class and challenge the default with repeated protected evaluation.
- [Rolling model aliases change behavior] → Record configured and resolved model identifiers in consequential verification.
- [The policy becomes a hidden scheduler] → Keep it declarative; no routing code or persistent execution state is introduced.
- [Claude compatibility drifts] → Keep task artifacts free of Codex conversation state and validate `CLAUDE.md` against the shared protocol.

## Migration Plan

1. Add the model-policy delta and repository guidance.
2. Validate OpenSpec and documentation consistency.
3. Apply the policy to new Codex task packets; do not rewrite historical provenance.
4. Revert this change to return to harness-neutral, implicit model selection if protected quality regresses.
