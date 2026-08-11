# System architecture

## Current foundation

```text
Current behavioral specs ──> Godot player app ──> versioned game packs
          │                         │
          │                         └── catalog + product runtime state
          └── proposed deltas + tasks

Native coding harnesses ──> repository files + Git + deterministic checks
```

The v3 bootstrap contains the player, SDK, fixture, catalog contract, product-only database, build tools, CI, and lightweight OpenSpec agreements. It contains no executable autonomous studio workflow, agent registry, promotion engine, evidence control plane, model client, conversation manager, lease service, or agent-runtime persistence.

## Future studio boundary

```text
                       human-approved policy
                                │
                                v
OpenSpec intent ──> deterministic orchestration ──> product side effects
                          │          │
                          │          └──> run records (facts)
                          v
                    bounded agents
                   (judgment only)
```

### OpenSpec

OpenSpec holds accepted behavioral requirements, concise proposed deltas, optional design decisions, and executable tasks. It is not orchestration state, a run ledger, a transcript, an agent registry, or an authority database.

### Deterministic orchestration (future)

Domain code will own branching, retries, idempotency, pause/resume, durable transitions, side effects, and delegation eligibility over explicit typed state. Model context, responses, and provider conversation identifiers cannot be authoritative state.

### Bounded agents (future)

An invocation has one focused judgment objective, repository-owned prompt and context assembly, schema-valid inputs, structured outputs or tool requests, explicit tool authority, and bounded completion. It acts like a stateless reducer from accepted state to a proposed next state; it does not own global control flow.

An agent cannot grant or expand authority, change policy, or approve or promote a change that affects itself.

### Run records (future)

Run records contain operational inputs, outputs, transitions, attempts, compact errors, timestamps, applied policy identity, eligibility evidence, and artifact references. They do not define accepted behavior, grant authority, or become hidden agent memory.

### Human authority

Humans permanently approve authority, delegation, evaluation, promotion, safety, and release policy. Humans initially approve every authority-bearing action and may later delegate only bounded acceptance, release, and promotion actions under previously accepted deterministic rules.

A delegation names the subject, action, required evidence, deterministic thresholds, scope, separation of duties, rollback, and expiry or revocation. Missing, conflicting, stale, invalid, or ambiguous evidence fails closed to a human-review state. Policy changes are never delegable. An affected agent cannot approve or promote its own change.

### Native coding harnesses

Codex and deliberately selected Claude Code own their conversation lifecycle, context, permissions, tools, authentication, models, and subagents. Repository agreements expose inputs, outputs, and checks without provider adapters or conversation persistence.

### Product runtime

One Godot player app owns identity, storage, telemetry, network policy, updates, rollback, and native platform capabilities. It verifies and mounts compatible game packs from one catalog. Packs contain no platform credentials and cannot shadow shell or other-pack resources.

Supabase stores only product catalog and consented gameplay state. Vercel previews host the exported player app.

## Applicable 12-factor-agent principles

The future seam applies HumanLayer's [12-Factor Agents](https://github.com/humanlayer/12-factor-agents) selectively:

- convert natural language into structured tool or human requests;
- own prompt text and context assembly;
- keep tools as schema-valid structured outputs;
- represent execution in one explicit typed run state that can pause and resume;
- contact humans through explicit waiting transitions;
- keep deterministic code in control of branches and side effects;
- compact errors while retaining references to detailed artifacts;
- use small, focused agent calls as stateless reducers; and
- keep trigger transports separate from domain transitions and authority.

These are constraints for later changes, not a framework implemented by the bootstrap.

## Single-app distribution

Games are catalog entries, not separately distributed applications. The current catalog schema records version strings, pack hash, entry scene and script, rollout metadata, and an optional rollback version. The current local loader enforces hash, namespace, mount, resource-type, and SDK-root checks; it does not yet decide SDK/player version compatibility or automate rollout and rollback.
