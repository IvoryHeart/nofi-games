## Environment and versions

- Date: 2026-08-09, Europe/London
- Implementation commit: `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c`
- Rollback commit: `c6b891dc93b659bc0462a7957fd1b93632902870`
- Codex CLI: `0.147.0`
- Claude Code: `2.1.220`
- Node.js: `24.19.0`; pnpm: `11.21.0`; TypeScript: `7.0.2`; Vitest: `4.1.10`
- OpenSpec: `1.8.0`; Godot: `4.7.1.stable.official.a13da4feb`
- Supabase services and credentials: not used for agent-workflow verification

Pinned artifacts:

```text
7cb9896b8f3fdeebb5d881ab689efec21311c6ef7d5a1a2c893ba138a3d6a247  AGENTS.md
b57f2968a892f042295764464b8e3c5324b036ef744278b540eec93537e06bdb  CLAUDE.md
22b11a156319aa933f78b5a4a3c1add0fef3593826a8929e554e309101e3995a  agents/skills/validate-strategic-premise/SKILL.md
25e96ab80ff7295295a6a196e8e08878a81bc77b19abea2b2ac5d3f4815072ec  docs/runbooks/native-harness-workflow.md
2a084425e47d467016b389d5767dc7f482d4d211b4c506671f98d3c70e94ae9c  studio/control-plane/src/contracts.ts
08b6acbd63af1c9e0fe75c97e8216f7142b7658a321ee3e76a80e6b218a431e2  tools/validate-premises.mjs
3943c9308ab6544ce1496cffdfc1fc75cb8be0c9f27bff9cb36ddaa72e79d7e8  evals/suites/strategic-premise/v1/suite.yaml
09701a446eacac88136f1523dea091ad276df8f93f6968be79df026e2c091c0d  openspec/schemas/system-change/schema.yaml
```

## Commands and artifacts

| Command                                                                                        | Result                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python3 .../skill-creator/scripts/quick_validate.py agents/skills/validate-strategic-premise` | Passed                                                                                                                                                                                                   |
| `pnpm check`                                                                                   | Passed: formatting, types, 7 unit tests, skills, 2 strategic premises, 10 strict OpenSpec items, 4 evaluation suites, 8 agents/3 workflows, catalog, Godot app/fixture/pack-loader checks                |
| `pnpm build:web`                                                                               | Passed; player and hidden contract pack exported                                                                                                                                                         |
| `pnpm studio:demo`                                                                             | Passed; compact run record includes Codex harness, version, task, source, and checkpoint provenance                                                                                                      |
| Temporary `agent/codex/native-harness-workflow/worktree-smoke` worktree                        | Created from `c6b891d`, appeared separately in `git worktree list`, contained canonical instructions, and was removed with exact clean branch cleanup                                                    |
| Direct-provider/dependency scan                                                                | Zero active OpenAI SDK, Supabase client, provider coordinator, runtime policy, model/session policy, or coordination-table references in studio source, tools, workflows, packages, CI, and current docs |
| `git diff --check`                                                                             | Passed                                                                                                                                                                                                   |

## Requirement results

| Requirement                             | Result and evidence                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Supported harnesses own execution       | Pass: `HarnessName` accepts only `codex`/`claude-code`; direct provider and SDK removed; native entry docs present                    |
| Canonical task packet                   | Pass: system-change task template and runbook pin outcome, inputs, scope, acceptance, evidence, and rollback                          |
| Worktree isolation                      | Pass: temporary named worktree/branch was independently visible and cleanly recoverable                                               |
| Git checkpoint/resume                   | Pass for repository substrate: task history and canonical artifacts were present in the clean worktree without conversation state     |
| No Supabase coordination dependency     | Pass: full source/verification path ran with no Supabase service or credential; historical migration is inert                         |
| Harness provenance                      | Pass: schema test rejects unsupported harnesses and demo validates compact provenance                                                 |
| Strategic premise gate                  | Pass structurally: schema prerequisite, template, project rules, and validator all pass                                               |
| Authoritative capability evidence       | Pass: premise links current official Codex and Claude Code SDK/session/subagent/worktree documentation and records installed versions |
| Abstraction accuracy                    | Pass: no active interface claims harness neutrality while exposing provider lifecycle semantics                                       |
| Strategic-fit evaluation                | Pass as frozen infrastructure: public fixtures, rubric, suite, and RE-RUN rule exist; independent scores remain pending               |
| OpenSpec governance and evidence ledger | Pass: strict deltas validate and workflow records use Git/OpenSpec/harness provenance without database state                          |

Protected metrics: direct model SDKs `0`; active coordination-table paths `0`; supported harnesses exactly `2`; test/validation/player regressions `0`; destroyed hosted evidence `0`; destructive database actions `0`.

## Failures and limitations

- This run did not invoke fresh Codex and Claude Code agents against paired champion/challenger fixtures. Doing so from this candidate author would not satisfy independent promotion. `strategic-premise-gate` is therefore explicitly `RE-RUN`, not promoted as an agent improvement.
- The native-harness architecture is accepted by explicit repository-owner direction and verified at the contract/worktree boundary. Cross-harness quality equivalence remains an empirical question and is not claimed.
- Supabase migration `202608090002_durable_agent_runtime.sql` remains applied and versioned. Its tables are not dropped because preserving historical evidence is safer than destructive cleanup; no active source path reads or writes them.
- The workflow is local/trusted by design. Automatic untrusted multi-machine scheduling would require a new premise-gated change.

## Reproduction instructions

```bash
pnpm install --frozen-lockfile
python3 /home/ny/.codex/skills/.system/skill-creator/scripts/quick_validate.py agents/skills/validate-strategic-premise
pnpm check
pnpm build:web
pnpm studio:demo
git worktree list
```

For worktree isolation, follow the exact create/list/remove commands in `docs/runbooks/native-harness-workflow.md`. Do not invoke or provision Supabase for this workflow.
