# Independent evaluation evidence manifest

Compact, Git-committed index of the independent evaluation. Raw prompts, transcripts, responses,
grader records, and failures are preserved outside Git; see "Trace location and retention".

## Evaluator identity and separation of duties

- Independent evaluator: fresh Claude Code session on branch
  `agent/claude-code/strategic-premise-gate/independent-evaluation`, worktree
  `nofi-strategic-eval-A6h86v`.
- The evaluator did not author the challenger, the frozen fixtures, the rubric, the suite, the
  schema, the thresholds, or the manifest boundary, and modified none of them.
- Protected holdouts were authored by the evaluator only after the evaluation inventory below was
  frozen and committed.

## Trace location and retention

- Raw evidence root (outside Git, machine-local): `/var/tmp/nofi-strategic-premise-eval-A6h86v/`
- Layout: `snapshots/` (immutable champion and challenger worktrees), `prompts/` (exact candidate
  and grader prompts), `runs/` (per-run stdout, JSONL event streams, final responses, exit codes,
  wall time), `grading/` (blinded response bundles and grader records), `holdout/` (protected
  prompts; expected answers and scoring notes under `holdout/protected/`), `manifests/`
  (inventory freeze, per-run manifests, integrity checks), `logs/`.
- Retention: keep until this change is archived and the decision is superseded; the directory is
  machine-local and is not pushed. Nothing in it is secret; session credentials are never copied
  into it.
- Nothing under the evidence root is tracked by Git. Only this manifest, `results.md`,
  `adversarial-review.md`, `decision.md`, `canary.md`, and `retrospective.md` are committed.

## Environment provenance

| Item           | Value                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- |
| Codex CLI      | `codex-cli 0.147.0`                                                                         |
| Claude Code    | `2.1.220`                                                                                   |
| Node.js        | `v24.19.0`                                                                                  |
| pnpm           | `11.21.0`                                                                                   |
| OpenSpec       | `@fission-ai/openspec 1.8.0`                                                                |
| Champion       | `c6b891dc93b659bc0462a7957fd1b93632902870`, tree `1850fc0cca621faa6a780150e9044974f8dbcd09` |
| Challenger     | `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c`, tree `7d65842b703e7ed8a53f99cc52da34a5ad3a5158` |
| Evaluator base | `dbae29a6a7488643285bbefc2af12973731acc6f`                                                  |

## Evaluation inventory freeze

Frozen at `2026-08-09T23:13:01Z`, before any protected holdout existed.
Raw freeze record: `<EVIDENCE_ROOT>/manifests/inventory-freeze.txt`,
sha256 `4f7c927b747eed80f1c7686431f7f42320b00541cbabee68d03c5af8f48f4c2e`.

Frozen evaluation assets (sha256):

| Asset                                                                    | sha256                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `evals/fixtures/strategic-premise/public/cross-platform-distribution.md` | `04a152fdbfef8fa7dfaa419aa900ac3e805d959d64519f767d5981263150c199` |
| `evals/fixtures/strategic-premise/public/durable-coding-agents.md`       | `3139456f8e769ab23d5a0fe6299d0aaaf3bb977e1181eaab1dadfba3b557c13c` |
| `evals/fixtures/strategic-premise/public/game-pack-validator.md`         | `f65fdb1a8ab73d13680b3a9e5b5cace40593673d0d229299e4798bfa7f07d081` |
| `evals/fixtures/strategic-premise/rubric.md`                             | `68dd9404c56c230820be41426820791297522caf2cbd6c26064bf628e91940ac` |
| `evals/suites/strategic-premise/v1/suite.yaml`                           | `3943c9308ab6544ce1496cffdfc1fc75cb8be0c9f27bff9cb36ddaa72e79d7e8` |

Frozen agent-definition assets (sha256):

| Asset                                               | sha256                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md` (challenger)                            | `7cb9896b8f3fdeebb5d881ab689efec21311c6ef7d5a1a2c893ba138a3d6a247` |
| `AGENTS.md` (champion, from `c6b891dc`)             | `45c11b6210403da15400068955dbb0b48221a19b58ca25ecb753e840fa316236` |
| `agents/skills/validate-strategic-premise/SKILL.md` | `22b11a156319aa933f78b5a4a3c1add0fef3593826a8929e554e309101e3995a` |
| `CLAUDE.md` (challenger; absent in champion)        | `b57f2968a892f042295764464b8e3c5324b036ef744278b540eec93537e06bdb` |
| `openspec/schemas/agent-evolution/schema.yaml`      | `18c1d4ec2c51c5caa9e1aa3a0f9879a29c91946d91cc2da2980f17b48988c306` |

## Manifest-integrity verification

| Pinned in `challenger.md`                                                   | Independently recomputed                                               | Result           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| Champion `AGENTS.md` `45c11b62…6236`                                        | sha256 of `c6b891dc:AGENTS.md`                                         | Match            |
| Challenger `AGENTS.md` `7cb9896b…a247`                                      | sha256 of `57e3d8bc:AGENTS.md`                                         | Match            |
| Challenger `SKILL.md` `22b11a15…3995a`                                      | sha256 of `57e3d8bc:agents/skills/validate-strategic-premise/SKILL.md` | Match            |
| Champion strategic-premise skill absent, empty-content hash `e3b0c442…b855` | Path absent at `c6b891dc`; value is the sha256 of the empty string     | Match            |
| Premise enforcement bundle `bef5fd89…f858c`                                 | Composition recipe not stated in the change                            | Not reproducible |
| Public evaluation bundle `4b8f9f0c…62074`                                   | Composition recipe not stated in the change                            | Not reproducible |
| Normalized tool policy `3fae5fb4…6cc28`                                     | Normalization recipe not stated in the change                          | Not reproducible |
| Normalized agent-evolution workflow `7bc2b762…02b20`                        | Normalization recipe not stated in the change                          | Not reproducible |
| Promotion policy `042d1fb9…d8e8b4`                                          | Normalization recipe not stated in the change                          | Not reproducible |
| Model policy identity `47ac6ac7…8a73d`                                      | Composition recipe not stated in the change                            | Not reproducible |

The frozen public fixtures, rubric, suite, skill, and both `AGENTS.md` revisions are byte-identical
between the challenger commit `57e3d8bc` and the evaluator base `dbae29a6`, so nothing frozen moved
under the evaluation.
