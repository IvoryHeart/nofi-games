## Why

The native-harness workflow supports Codex and Claude Code but leaves the active harness and Codex model choice implicit. The owner has selected Codex as the primary harness and wants bounded coding assigned to Luna/xhigh while strategic work uses Sol/xhigh, without adding a custom router.

## What Changes

- Make Codex the default harness for current studio work.
- Keep Claude Code adoptable through the same OpenSpec, Git, test, evidence, and decision protocol without requiring active Claude execution.
- Classify tasks as bounded implementation or high judgment in their task packets.
- Default bounded implementation to `gpt-5.6-luna` with `xhigh` reasoning.
- Default strategy, architecture, ambiguous design, adversarial review, and promotion decisions to `gpt-5.6-sol` with `xhigh` reasoning.
- Require a bounded task to checkpoint and escalate when it discovers a decision outside its declared scope.
- Record the configured model and reasoning effort in consequential verification.
- Do not add automatic routing, a model client, a scheduler, a database, or a direct-provider harness.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `native-harness-workflow`: define the primary harness, task classes, model defaults, escalation, portability, and provenance behavior.

## Impact

- Repository instructions and native-harness runbook.
- Native-harness capability specification and OpenSpec context.
- Task authoring and verification provenance; no product runtime, database, dependency, or external API changes.
- Rollback target: `dbae29a6a7488643285bbefc2af12973731acc6f`.
