## Desired outcome

Give repository agents an explicit, economical default execution policy without coupling the repository to a custom harness or preventing another native harness from adopting the same task and evidence protocol.

## Required capabilities

- One primary native harness for current work.
- A reproducible distinction between bounded implementation work and high-judgment work.
- An explicit model and reasoning-effort default for each class.
- A safe escalation boundary when a bounded task exposes strategic ambiguity.
- Harness-portable task, checkpoint, evidence, and decision artifacts.

## Existing capabilities and evidence

Codex already owns model invocation, long-running context, tools, permissions, subagents, and compaction. The native-harness workflow already uses OpenSpec and Git as the portability and durability boundary. The official [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) references show that both are available through Codex and support `xhigh` reasoning; Luna is positioned for cost-sensitive high-volume work, while Sol is positioned for complex reasoning and coding. No repository service is needed to select either model when a Codex task starts.

## Alternatives and rejection reasons

- **Reuse Codex model selection with a documented policy — selected.** It provides the required execution behavior without new runtime code.
- **Adapt the workflow with a deterministic repository router — rejected.** The two task classes do not justify a routing service, and a router would duplicate harness behavior.
- **Construct a direct-model or multi-vendor harness — rejected.** It recreates lifecycle, context, authentication, and tool capabilities already supplied by Codex and Claude Code.
- **Use Sol for every task — rejected as the default.** It spends high-judgment capacity on bounded transformations without changing acceptance gates.
- **Leave model choice implicit — rejected.** Different sessions would make inconsistent and unauditable choices.

## Selected repository-owned boundary

The repository owns only the task classification, default model policy, escalation rule, and recorded provenance. Codex owns execution and model invocation. Git and OpenSpec remain authoritative. Claude Code remains able to consume the same task packets, but active Claude execution is not required by the current policy.

## Assumptions and disconfirming signals

- Assumption: bounded implementation work retains quality under Luna/xhigh. Repeated acceptance failures, elevated repair rates, or protected regressions disconfirm it for the affected task class.
- Assumption: Sol/xhigh is appropriate for strategic and independent decision work. A measured alternative with equal protected quality and lower cost may challenge this default later.
- Assumption: two explicit classes are sufficient. Persistent classification disputes or frequent mid-task escalation would justify evaluating a richer policy, not silently constructing one.

## Decision, validation, and rollback

Adopt Codex as the current primary harness, `gpt-5.6-luna` with `xhigh` reasoning for bounded implementation, and `gpt-5.6-sol` with `xhigh` reasoning for high-judgment work. Validate through strict OpenSpec checks, documentation consistency checks, and normal task acceptance evidence. Roll back to commit `dbae29a6a7488643285bbefc2af12973731acc6f` if the policy causes ambiguity or quality regression; retained task evidence can then support a challenger policy.
