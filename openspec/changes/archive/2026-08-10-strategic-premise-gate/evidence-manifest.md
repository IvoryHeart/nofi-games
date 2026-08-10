# Independent evaluation evidence manifest

## Evaluator identity and separation of duties

- Independent evaluator: fresh Codex evaluator on `agent/codex/strategic-premise-gate/independent-evaluation`.
- The evaluator did not author or alter the champion, challenger, frozen fixtures, holdouts, answer keys, rubric, suite, schema, thresholds, or source commits.
- The high-thinking candidate runs, graders, adversarial review, and verdict used `gpt-5.6-sol` with `xhigh`; bounded mechanical grading utilities used `gpt-5.6-luna` with `xhigh` and were independently reviewed before execution.
- Owner-strategy amendment commit: `81a868687acbf34404e178eb5c3271810422fde9`, before protected-answer, candidate-response, or grading content was opened.

## Trace locations and retention

- Qualifying Codex evidence root: `/var/tmp/nofi-strategic-premise-eval-codex-hydBis/`.
- Prior incomplete evidence root: `/var/tmp/nofi-strategic-premise-eval-A6h86v/`, preserved unchanged with commit `f28956109c04aff91278fb3e8bef1a1259fb10a3` as nonqualifying supplemental evidence.
- Retain both roots until the change is superseded or explicitly cleaned up. Nothing under either root is tracked by Git or pushed.
- Final raw-file manifest: `manifests/evidence-files.sha256`, covering all 1,099 other regular files under the qualifying root; SHA-256 `4fd61a2f97aac463af5cd182f0fd39f848a18ac2574d34a0711c875a1538141e`.

## Environment and sources

| Item                     | Value                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Codex CLI                | `0.147.0`                                                                                   |
| Candidate/grader model   | `gpt-5.6-sol`, `xhigh`                                                                      |
| Mechanical tooling model | `gpt-5.6-luna`, `xhigh`                                                                     |
| Node.js                  | `v24.19.0`                                                                                  |
| pnpm                     | `11.21.0`                                                                                   |
| OpenSpec                 | `1.8.0`                                                                                     |
| Champion                 | `c6b891dc93b659bc0462a7957fd1b93632902870`, tree `1850fc0cca621faa6a780150e9044974f8dbcd09` |
| Challenger               | `57e3d8bc03939c7e9470041ed41f9bdb4e98da7c`, tree `7d65842b703e7ed8a53f99cc52da34a5ad3a5158` |
| Amendment                | `81a868687acbf34404e178eb5c3271810422fde9`                                                  |

## Frozen prompt and answer-key hashes

| Asset                      | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Candidate `case01`         | `5e1fadaf2331cad4f80846d321b996fa96212ba6dabe4495db8389f316f5a666` |
| Candidate `case02`         | `a7105816e553c29f8da9c6324e8a501edfb29d0e2747b0705c732e90b2ddf9c8` |
| Candidate `case03`         | `1b6d80c76843313f0f34f06976e703c57a55c4d5223268265c0d8cb3fa4049d6` |
| Candidate `case04`         | `f0e61534143790bbc44e7d5fc7011a58272dcc53e3b1e143f672caa458552381` |
| Candidate `case05`         | `c35ba2a2426786288482f5d76223c1e27b91a4a27a7fdfc388af97ca85194f16` |
| H1 prompt                  | `673e1281bb21e09d7d32a1f84a8dbed9376a3e30bac9fd69037dd084ecef0450` |
| H1 answer key              | `59341339fbdecfaf142b77e1c172f4b31fad10eb08a4e2b494f622bd81b26c12` |
| H2 prompt                  | `d03eadd0936f3d9fc15404a96ba15d7afc871bc9250f41b688e9fdb009dc207f` |
| H2 answer key              | `59d82db87f0cc4f299284e68173e30da2dba40e741ad432c979b1c857e4139be` |
| Blind identity map         | `b5db12c36aa621d244a75a345d3bc429c51d5074bba90510ebb38ad5e36b9a02` |
| Grader-prompt hash ledger  | `44339a0009e86468aeff150b60e86091f7c6f22474d9617b5e0878a93575bbef` |
| Grader-runtime hash ledger | `24d8c0e973bfd973357618f3178e1e173855c6a569823040c765ade4d99a7e50` |

## Evidence summary and hashes

| Evidence               | Result                                          | SHA-256                                                            |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Candidate sealed audit | PASS, 30 canonical, 4 retained wrapper failures | `f243edf4d16cb64f215fc6ce70ba7dfec8e02fccd2904276fe3036032c32ef07` |
| Grader sealed audit    | PASS, 30 first-attempt records, 0 replacements  | `762c9ca5f12009f37c84841138751c135a9c50a808b64be2ecd2d7e7ac1881a6` |
| Aggregate JSON         | `REJECT`                                        | `59c19779d01a94717f4908e4ba0442f94a728ee79ced2aba09185ce207f7cf51` |
| Aggregate Markdown     | `REJECT`                                        | `1e07045a07f4e657b17e57175d01e34654e5eeb70ec0374d49b6ae50b125c93f` |
| Aggregate stdout       | `REJECT`                                        | `bf1d2276c19d4964d69524677045b90a28ab63ebf02d8f528c2b8aa87c2f0af0` |
| `pnpm check` log       | PASS                                            | `e01ca85174e2b9b14b5448786a10ad42e4a58c838351e57369aaca1ea69e4826` |
| `pnpm build:web` log   | PASS                                            | `083a0a8de5fcc37fdae17ffc8bad6b1f2b97527a6be8acc3541746e15261528b` |
| Strict change validate | PASS                                            | `deda46bb7b7bfb372c4563c8c00d2d4692c02e190e8a132922824f4f5b9cf6ff` |

## Integrity results and limitations

- Direct champion/challenger commit, tree, `AGENTS.md`, skill, public fixture, rubric, suite, prompt, holdout, answer-key, response, JSONL, schema, and grading-bundle hashes were recomputed.
- The original `challenger.md` composite/normalized hashes for premise enforcement, public evaluation, tool policy, workflow, promotion policy, and model policy remain not independently reproducible because their recipes were not recorded.
- Candidate sessions were never given protected paths/content and audit logs show no protected-key access. Shared Git metadata let several candidates list worktrees, revealing evaluator/snapshot paths and source commits. The host files were theoretically readable by the same Unix user, so future runs should use a separate mount namespace or pre-candidate permission lock.
- Grading identities were mode-locked (`000`) at the OS directory boundary until all 30 grades and the sealed audit completed. The map was revealed only during aggregation.
- One grader emitted schema-valid placeholder/pending content with confidence zero. It was retained; the schema lacks a semantic-completion rule. Eight of 15 reported disagreements originate from that cell.
- Model service aliases and reasoning settings are recorded, but the service does not expose a backend build hash. Web pages used by candidates are referenced in JSONL but not mirrored and may change.
- The four wrapper-`127` candidate attempts and the initial Luna sandbox failure are preserved and reported; none was silently ignored.
- The complete stdout streams from the first repository-check attempts were overwritten when their tee paths were reused for the post-bootstrap PASS logs. Their captured failure facts/excerpts are reconstructed in `logs/pre-bootstrap-check-failures.md`; this is an evidence-retention limitation, although the missing Godot prerequisite and subsequent full PASS are independently reproducible.
