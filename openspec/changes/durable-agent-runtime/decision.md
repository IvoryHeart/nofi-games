## Verdict

REJECT

Independent user review rejected the strategic premise on 2026-08-09. The change rebuilt agent execution around direct OpenAI model APIs even though Codex and Claude Code are the intended native harnesses. Do not archive this change, enable live execution, run the live-provider smoke, or use its Supabase tables for new work.

## Evidence

- `pnpm check` passes formatting, strict TypeScript, 45 deterministic tests, all repository validators, strict OpenSpec validation, and Godot player/fixture/pack-loader checks.
- Two consecutive zero-state Supabase resets apply both migrations and pass all 39 pgTAP assertions.
- Hosted migrations `202608090001` and `202608090002` are applied and match local history without dropping or changing the three legacy public tables.
- Hosted PostgREST/RPC run `c06ea2bc-c6d8-4490-add5-e7741a280051` pins implementation commit `c023c4d5efee227a61eeed4dc36eaebdfa62195c` and proves one-call acceptance, zero-call replay, complete provenance, usage/pricing records, secret containment, and browser denial.
- The compatibility and adversarial matrices cover fingerprint mutations, forged output/evidence, prompt injection, provider uncertainty, conversation/artifact loss, lease races, hard budgets, rollback during a call, model promotion, cache cost regression, accounting, and encoded secrets.
- The web player export passes and the durable runtime does not alter the research-selected single-app strategy or add monetization.

The live OpenAI create/continue/rotate suite is implemented, manual-only, cleanup-safe, and capped, but was omitted because no credential was present. Terra remains the configured champion, explicit caching and Luna remain disabled, and live execution remains off.

## Protected-metric result

- Exactly-once acceptance: pass (`100%` across tested concurrency/replay fixtures).
- Duplicate invocation after accepted replay or uncertain outcome: pass (`0`).
- Invalid output acceptance: pass (`0`).
- Resume fidelity and artifact integrity mismatch: pass (`0` mismatches/repeated completed stages).
- Incompatible session reuse: pass (`0`).
- Calls after known hard budget: pass (`0`).
- Provenance completeness: pass (`100%` required fields).
- Secret canary matches in transmitted/returned/persisted evidence: pass (`0`).
- Protected model quality regression: pass (`0` promoted regressions); Luna without lower cost is rejected.
- Cache cost regression: pass (higher-cost candidate rejected; production cache stays disabled).
- Accounting: pass (provider categories preserved; deterministic rounding within one micro-USD; unavailable values remain `unpriced`).

All implementation-level protected metrics passed, but the unmeasured strategic-fit metric failed: the subsystem duplicates existing harness capabilities and exposes an OpenAI-shaped boundary as provider-neutral. Passing self-derived implementation tests does not override that failure.

## Rollback target

`native-harness-workflow` removes the source execution paths and dependencies while preserving this rejected change and migration history. The additive hosted tables remain inert for audit; rollback does not reset hosted Supabase or delete evidence. Git commit `c6b891d` can reconstruct the rejected implementation if later evidence genuinely requires it.
