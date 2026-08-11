# Platform v2 prototype

`platform-v2` is the preserved prototype whose first autonomous game run falsified its studio execution architecture without falsifying the autonomous-studio product direction.

## Rollback

- Local branch: `platform-v2`
- Remote-tracking branch: `origin/platform-v2`
- Pinned commit: `201cfdda07e18b41cc5cd4f72a353e3882ab3456`
- Recorded on: 2026-08-11

The v3 bootstrap removes prototype machinery from its own tree. It does not delete, force-update, merge, detach, or otherwise mutate the rollback branch, historical branches, worktrees, remote refs, or pull-request evidence. Git is the quarantine; the v3 tree does not copy the retired implementation into a second archive.

## Worktree claims at reset

| Worktree                                                                    | Branch or state                                                     | Commit                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `/home/ny/Forge/WizardOfAgents/nofi-studio`                                 | `platform-v3-bootstrap`                                             | `201cfdda07e18b41cc5cd4f72a353e3882ab3456` |
| `/home/ny/Forge/WizardOfAgents/nofi-agent-efficiency`                       | `agent/codex/decision-efficient-agent-execution/challenger-build`   | `d6dd995b7b16be5cd16abb04192200361971d6a2` |
| `/home/ny/Forge/WizardOfAgents/nofi-agent-efficiency-review`                | `agent/codex/decision-efficient-agent-execution/independent-review` | `939686a7e5d04ece4b5663ff151cd04357491263` |
| `/home/ny/Forge/WizardOfAgents/nofi-mossbound-build`                        | `agent/codex/first-research-selected-game/game-build`               | `6a4fdca660bd276a2f0a52c64a7baa12c0fc4de2` |
| `/home/ny/Forge/WizardOfAgents/nofi-mossbound-eval`                         | `agent/codex/first-research-selected-game/independent-evaluation`   | `6a4fdca660bd276a2f0a52c64a7baa12c0fc4de2` |
| `/var/tmp/nofi-strategic-premise-eval-A6h86v/snapshots/ablation`            | detached                                                            | `c6b891dc93b659bc0462a7957fd1b93632902870` |
| `/var/tmp/nofi-strategic-premise-eval-A6h86v/snapshots/challenger`          | detached                                                            | `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c` |
| `/var/tmp/nofi-strategic-premise-eval-A6h86v/snapshots/champion`            | detached                                                            | `c6b891dc93b659bc0462a7957fd1b93632902870` |
| `/var/tmp/nofi-strategic-premise-eval-codex-hydBis/snapshots/snapshot-7a9c` | detached                                                            | `c6b891dc93b659bc0462a7957fd1b93632902870` |
| `/var/tmp/nofi-strategic-premise-eval-codex-hydBis/snapshots/snapshot-b3e1` | detached                                                            | `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c` |

Additional historical local branches remain visible through `git branch --all`; this inventory records writable and detached worktree claims rather than redefining branch history.

## Retired architecture

The v3 reset retires the repository-owned agent registry, declarative autonomous workflow graphs, generic self-promotion/evaluation system, evidence/decision control plane, custom OpenSpec artifact factories, and agent-runtime database persistence. The preserved commit above remains the authoritative source for their exact code and planning evidence.
