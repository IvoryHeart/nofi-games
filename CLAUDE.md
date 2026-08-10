# Claude Code entry point

`AGENTS.md` is the canonical repository instruction file. Read it and its mandatory documents before acting.

Codex is currently the primary execution harness. Claude Code remains a supported adoption path and does not need an active role in ordinary Codex acceptance.

When deliberately assigned work, use Claude Code's native threads, subagents, tools, permissions, context management, and authentication. Do not construct a model-provider runtime or a second agent harness. Consume and produce the same OpenSpec, Git, test, evidence, and decision artifacts used by Codex; never depend on Codex conversation state.

For concurrent writable work, follow the branch/worktree protocol in `docs/runbooks/native-harness-workflow.md`. Harness-specific execution choices may differ; task outcomes and acceptance gates may not.
