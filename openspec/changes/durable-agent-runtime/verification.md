## Environment and versions

- Date: 2026-08-09, Europe/London
- Branch: `platform-v2`
- Implementation commit pinned by the final hosted run: `c023c4d5efee227a61eeed4dc36eaebdfa62195c`; rollback base: `88f06f2e98e28aa132b0e7d5c25e3deea8f8df01`
- Node.js: `24.19.0`; pnpm: `11.21.0`; TypeScript: `7.0.2`; Vitest: `4.1.10`
- OpenSpec: `1.8.0`; Supabase CLI: `2.113.0`; local/hosted PostgreSQL: `17.6.1.104`
- Godot: `4.7.1.stable.official.a13da4feb`
- OpenAI SDK: `7.4.0`
- Hosted Supabase project: `nofi-games`, `eu-west-2`, `ACTIVE_HEALTHY`
- Live OpenAI credential: absent. Live execution remained disabled and the opt-in live test was skipped explicitly.

## Commands and artifacts

| Command                                                                                                                        | Result                                                                                                                                                                            | Reproducible artifact                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm studio:runtime validate`                                                                                                 | Passed; 1 model, session, security, pricing, and output-contract policy set loaded                                                                                                | `studio/policies/` and `studio/output-contracts/`                                                                                             |
| `pnpm studio:runtime fake-run`                                                                                                 | Passed; one accepted call and checkpoint                                                                                                                                          | `studio/control-plane/src/runtime-fixture.ts`                                                                                                 |
| `pnpm check`                                                                                                                   | Passed: formatting, strict TypeScript, 45 deterministic tests, all validators, strict OpenSpec, Godot import/fixture/pack-loader checks                                           | Test and policy hashes below                                                                                                                  |
| `pnpm infra:reset && pnpm db:test` repeated twice                                                                              | Passed twice from zero; 39 pgTAP assertions each run                                                                                                                              | `supabase/tests/durable_agent_runtime_test.sql`                                                                                               |
| `pnpm build:web`                                                                                                               | Passed; player and hidden fixture exported                                                                                                                                        | `dist/player/` (ignored build output)                                                                                                         |
| `supabase migration list`, `supabase db push --linked --dry-run`, `supabase db push --linked`                                  | Passed; only additive migrations `202608090001` and `202608090002`; legacy tables untouched                                                                                       | Hosted migration history and migration hashes below                                                                                           |
| `pnpm studio:runtime hosted-smoke`                                                                                             | Passed from pinned implementation commit `c023c4d5efee227a61eeed4dc36eaebdfa62195c`; one accepted call, zero-call replay, complete provenance, canary containment, browser denial | Run `c06ea2bc-c6d8-4490-add5-e7741a280051`; attempt `5df79517-8936-4998-9057-20f1348549f2`; checkpoint `21c7926a-3819-4f23-97c2-0f41ee8303a0` |
| `NOFI_LIVE_PROVIDER_TEST=true NOFI_LIVE_PROVIDER_ENABLED=true pnpm vitest run studio/control-plane/test/live-provider.test.ts` | Explicitly omitted: `OPENAI_API_KEY` absent. The test exists, is capped at three calls and 500,000 micro-USD, and is manual-only.                                                 | `studio/control-plane/test/live-provider.test.ts`                                                                                             |

Artifact SHA-256 ledger:

```text
5c11241e3fa47fa528fc893b0e3936908e6286dd5d522b334f4f99cf55db4905  studio/control-plane/src/stage-coordinator.ts
595c151c4a29d2abe9e50fcf580736c9ebbdddfa177d304951daeae22f776bc1  studio/control-plane/src/fake-provider.ts
a16276c68b6c7df980791ba0e2a316c5ce9d8a4cae8e5f1c0c6c48afaa62de27  studio/control-plane/src/cli.ts
dc484df85a54e1fb7580ada9a382d0f40df77b875e9140660469f2ee33fb5a1d  studio/control-plane/test/stage-coordinator.test.ts
a8e12dd390f2fc4f545bcf1449a9584247b46d90bea911242cb03b7b9fb848eb  studio/control-plane/test/live-provider.test.ts
c19b1c40b7f57591f8c1d4c2bcbdd4aa9dd751a368c5de94f0f8cbe08a026a0f  studio/control-plane/test/model-policy-evaluation.test.ts
7f54a6cdb29140ffa4278c448f827d2a70455ff77957ce694a4de85ca818b480  studio/control-plane/test/accounting.test.ts
f373266f554d2412482e93e53a28a185fbc76fe62ce13c1d2f72d9870f96d704  studio/control-plane/test/provider.test.ts
15e7d7e32a7e26c7dae537cca1390f521378ddfd555cadecf46d3acdac2ebe4a  studio/control-plane/test/hashing.test.ts
6b067a8f27137433732658bfb6dca03b1832210ca9bcd0f7e96b6be273f14b85  supabase/tests/durable_agent_runtime_test.sql
7dc4691172cb901b529ed0e9243c80c5c5bc91e904f1c7b62d501f21856bd423  supabase/migrations/202608090002_durable_agent_runtime.sql
824c7de10ea6ae8f5eda3ac06a74959d730fb9945b1021bfbe9a5e6e6bb32a8d  studio/policies/model-routing/terra-champion-v1.yaml
e59d409dce1bf8e15c24db934f0503eed54efa24aa865fdb5bdc5191be5f7193  studio/policies/session/bounded-workstream-v1.yaml
b1d86a969cab512c48381e0d0ea182b46ff7af482342a3b6bc8628b54bd6ccc3  studio/policies/security/studio-redaction-v1.yaml
b6a3a776ba9735e067c01badb24e39860026331ee81ae1ecb56e432850e5192c  studio/policies/pricing/openai-2026-08-09.yaml
```

## Requirement results

| Evaluation-plan requirement                 | Command/evidence                                                                              | Result                                                                                                                                         | Artifact hash                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Agent identity is independent from sessions | `pnpm test`; policy/workflow contract tests                                                   | Pass: stable definitions carry no provider conversation ID; incompatible workstreams create linked sessions                                    | `dc484d...`                   |
| Coherent work resumes durably               | `pnpm test`; compatibility matrix and failed-attempt resume                                   | Pass: exact-compatible work reused its session; every mutated fingerprint component rotated                                                    | `dc484d...`, `15e7d...`       |
| Memory survives conversation loss           | `pnpm test`; reconstruction and missing-artifact cases                                        | Pass: checkpoint artifacts reconstruct; missing hash fails before a call                                                                       | `dc484d...`                   |
| Context growth is bounded                   | `pnpm test`; soft/hard token, cost, idle, turn, checkpoint boundaries                         | Pass: deterministic rotate/stop; zero calls after hard limits; budget event retained                                                           | `dc484d...`, `e59d40...`      |
| Attempts are idempotent and leased          | Repeated `pnpm db:test`; hosted smoke                                                         | Pass: 20-way claim race has one winner; stale/late acceptance rejected; accepted replay has zero calls                                         | `6b067a...`, `7dc469...`      |
| Output is contract validated                | `pnpm test`; malformed/repair/undeclared/forged cases                                         | Pass: no invalid checkpoint accepted; one bounded valid repair accepted                                                                        | `dc484d...`                   |
| Model selection is evidence controlled      | `pnpm test`; repeated Terra/Sol/Luna and independent evaluator fixtures                       | Pass: protected metrics and minimum repetitions enforced; Luna additionally reduces cost                                                       | `c19b1c...`, `824c7d...`      |
| Provider failure is reversible              | `pnpm test`; missing credentials, auth, timeout, cancellation, conversation loss, disablement | Pass: ambiguous calls reconcile without retry; in-flight disabled output cannot accept                                                         | `dc484d...`, `f37326...`      |
| Workflow records are version pinned         | `pnpm test`; hosted provenance reconstruction                                                 | Pass: Git/OpenSpec/workflow/agent/prompt/skill/tool/input/output/policy/provider/model/session/attempt/lease/checkpoint/resume fields complete | `dc484d...`, hosted run above |
| Usage and cost are attributable             | `pnpm test`; complete/partial/unknown usage and integer pricing goldens                       | Pass: exact categories preserved; unknown model and missing usage remain `unpriced`                                                            | `7f54a6...`, `b6a3a7...`      |
| Checkpoints are immutable/content addressed | Repeated `pnpm db:test`; reconstruction tests                                                 | Pass: mutation rejected, bytes reproduce hashes, predecessor links retained                                                                    | `6b067a...`, `7dc469...`      |
| Secrets are excluded                        | `pnpm test`; hosted canary smoke                                                              | Pass: zero raw, URL-encoded, base64, multiline, substring, or nested-error canary bytes in envelopes, diagnostics, repositories, or artifacts  | `dc484d...`, hosted run above |

Adversarial coverage:

| Case                                                                       | Result | Evidence                                                                        |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Twenty lease claimants, expiry, stale and late worker                      | Pass   | pgTAP tests 5-20 and acceptance guards                                          |
| Provider accepted but transport response lost                              | Pass   | Attempt stays `reconciling`; second execution creates zero calls                |
| Conversation missing with complete/incomplete artifacts                    | Pass   | Reconstruction accepts with predecessor; missing artifact fails before call     |
| Every compatibility component changed independently                        | Pass   | Golden fingerprint matrix plus coordinator session-rotation matrix              |
| Extra artifact, forged evidence digest, invalid URI, forged gate reference | Pass   | All fail validation with no accepted checkpoint                                 |
| Prompt-injection text in evidence/input                                    | Pass   | Retained as data; stable runtime guard remains authoritative                    |
| Encoded, multiline, substring, and nested secret errors                    | Pass   | Recursive redaction unit and end-to-end canary suites                           |
| Partial usage, unknown model, long-context/effective price boundaries      | Pass   | Accounting goldens preserve unavailable fields and deterministic rounding       |
| Cache prefix churn/cost regression                                         | Pass   | Three-repetition cache candidate rejects higher measured cost                   |
| Summary omits detail retained in artifact                                  | Pass   | Checkpoint reconstruction verifies and loads content-addressed references       |
| Zero-state/repeat local migration and non-empty hosted schema              | Pass   | Two clean resets; additive hosted migration over three untouched legacy tables  |
| Hidden protected model-routing and injected research evidence              | Pass   | Independent evaluator required; protected gates prevent self-authored promotion |

Protected metrics all pass on deterministic and hosted evidence: exactly-once acceptance `100%`; duplicate paid invocation after replay/uncertainty `0`; invalid-output acceptance `0`; completed-stage repeats `0`; incompatible-session reuse `0`; calls after known hard limits `0`; provenance completeness `100%`; secret matches `0`; protected model regressions `0`; cache cost regression is rejected; accounting goldens are within one micro-USD. No rollback trigger remains active. Live execution nevertheless remains disabled by policy pending independent acceptance and an explicitly authorized live smoke.

## Failures and limitations

- The live OpenAI create/continue/rotate test was not executed because no `OPENAI_API_KEY` was present. SDK request shape, Conversations lifecycle, structured output, persisted reasoning, prompt-cache fields, usage normalization, cleanup, and failure behavior are covered with the official SDK types and deterministic adapter tests. This omission does not substitute fake evidence for a live result.
- Full local Supabase auxiliary services had health timeouts. The database-only profile is now the deterministic CI path; hosted PostgREST/RPC covers the actual repository transport.
- PostgreSQL `17.6.1.104` segfaulted inside pgTAP when `throws_ok` invoked a revoked set-returning function. The test was replaced by the equivalent `has_function_privilege` catalog assertion; two subsequent zero-state resets and all 39 assertions passed.
- A repeated hosted fake smoke initially reused `fake-response-1`, hit the intended global response uniqueness guard, and entered manual reconciliation. Fake provider IDs are now namespaced per hosted run, and the CLI failure path automatically reconciles its attempt and marks its workflow failed. The failed run remains append-only evidence.
- `supabase db dump --dry-run` may print an ephemeral database login and is prohibited in shared logs by the runbook. No credential value is stored in Git or runtime evidence.
- Independent acceptance is pending. Do not archive this change or start live game-opportunity research until a reviewer accepts the decision artifact.

## Reproduction instructions

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm studio:runtime validate
pnpm studio:runtime fake-run
pnpm check
pnpm infra:start:db
pnpm infra:reset
pnpm db:test
pnpm infra:reset
pnpm db:test
pnpm build:web
```

For hosted reproduction, load ignored server credentials, inspect `supabase migration list`, require an additive `supabase db push --linked --dry-run`, and run `pnpm studio:runtime hosted-smoke`. For the optional live sequence, follow `docs/runbooks/first-agent-run.md`; the protected GitHub workflow requires explicit cost authorization and deletes its conversations.
