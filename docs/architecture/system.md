# System architecture

## Overview

```text
External evidence
      |
      v
Research -> Concepts -> OpenSpec -> Build -> Evaluate -> Artifact registry
   ^                                                    |          |
   |                                                    v          v
Learning <- Experiments <- Gameplay ledger <- Single player app <- Catalog

Agent definitions -> challenger evals -> promotion/rollback -> agent registry
```

## Planes

### Knowledge plane

OpenSpec stores current capabilities and proposed deltas. ADRs preserve architectural decisions. Git versions accepted specifications, source, agent definitions, skills, evaluation definitions, and release manifests.

### Studio control plane

The TypeScript control plane coordinates idempotent workflows. GitHub Actions execute bounded jobs. A Dockerized local Supabase stack provides reproducible development, while Supabase preview branches store isolated run state, telemetry, evaluation summaries, catalog metadata, and artifact references. Vercel branch previews host the exported player app.

### Runtime plane

One Godot player app runs on every distribution target. It fetches a catalog, verifies pack identity and integrity, loads a compatible Godot PCK, attaches the pack's declared contract script to its data-only entry scene, grants declared capabilities, and owns identity, persistence, telemetry, updates, and rollback.

### Game-pack plane

Each game is an independently built Godot project conforming to the Nofi SDK. Packs use unique resource namespaces, contain no platform credentials, and expose semantic observation/action methods for evaluation agents.

### Evidence plane

Headless simulation, deterministic replay, browser/device runs, visual evaluation, player telemetry, and explicit feedback produce immutable evidence. Git stores definitions and compact manifests; object storage holds large outputs.

## Single-app distribution

The platform releases one application. Games are catalog entries, not separately distributed binaries. A catalog version pins pack hash, SDK compatibility, entry scene and script, rollout, and rollback version. A pack cannot directly access native APIs or platform credentials.

## Version axes

Every workflow record pins:

- Git commit and OpenSpec change.
- Workflow and agent versions.
- Model, prompt, skill, and tool hashes.
- Game pack, SDK, catalog, and evaluation-suite versions.
- Inputs, outputs, evidence, decision, and baseline identifiers.
