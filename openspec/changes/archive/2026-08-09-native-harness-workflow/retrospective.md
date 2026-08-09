## Outcome

The repository now delegates agent execution to Codex or Claude Code and uses OpenSpec, branches/worktrees, commits, and CI for local durable coordination. The correction removed 5,963 lines from the implementation checkpoint, eliminated the OpenAI and Supabase JavaScript runtime dependencies, rejected the prior change without erasing its evidence, and left player/game-pack behavior unchanged.

The strategic-premise gate is structurally active by repository-owner direction. Its challenger evaluation is frozen but intentionally not self-promoted.

## Evidence-backed lessons

- Neutrality must be named at the correct layer. Portable task outcomes and evidence can be harness-neutral while subagent, context, tool, and model behavior remains native.
- A branch/worktree is a useful local claim because ownership and abandoned state are inspectable without expiry or a second state store. A commit is a stronger accepted checkpoint than a conversation reference.
- Databases are justified by shared runtime requirements, not by a general preference for durability. Local trusted work did not need leases, reconciliation, RLS, or remote checkpoint tables.
- Strong implementation tests can entrench a bad premise. Strategic fit, capability reuse, and operational-surface growth must be frozen before construction.
- Rejecting a change should preserve its design, verification, and migration history. The failed premise is reusable evaluation evidence rather than something to hide.
- Harness portability does not require a lowest-common-denominator harness API. The repository can standardize inputs, outputs, evidence, and gates while letting each harness use its strengths.

## Invalidated assumptions

- The studio needed to invoke model APIs to execute agents.
- Provider conversations were the primary continuity mechanism for development agents.
- Supabase task leases were needed before a distributed scheduler requirement existed.
- Model routing belonged in the first workflow scaffold.
- Passing all requirements authored by the same design was sufficient acceptance evidence.
- Removing implemented code represented wasted effort. The rejected runtime supplied concrete failure evidence and useful boundaries while its active operational surface was cheaply removed.

## Improvement suggestions

- Complete the frozen champion/challenger suite with fresh independent Codex and Claude Code evaluators before claiming that `validate-strategic-premise` improves agent performance.
- Run one real research/design/build slice through each harness after the first game concept exists, applying identical artifact gates and comparing friction rather than forcing identical execution traces.
- Add distributed scheduling only after observed local/remote branch coordination failures establish required semantics.
- Consider harness-specific skill discovery shims only if a native harness fails to load the canonical project skill through its documented repository instructions.
- Periodically revalidate linked vendor capabilities because both harnesses evolve; route material changes through a premise-gated OpenSpec change.
