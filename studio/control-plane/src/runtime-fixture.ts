import { randomUUID } from "node:crypto";
import { hashArtifact } from "./hashing.js";
import { loadRuntimePolicies } from "./policies.js";
import type { StageExecutionRequest } from "./stage-coordinator.js";

export function deterministicFixtureOutput(now = new Date("2026-08-09T00:00:00.000Z")): unknown {
  return {
    artifacts: [
      {
        id: "market-brief",
        mediaType: "application/json",
        content: JSON.stringify({ status: "fixture", opportunities: [] }),
      },
    ],
    evidence: [
      {
        id: "fixture-source",
        kind: "test",
        uri: "fixture://durable-agent-runtime",
        sha256: hashArtifact("fixture evidence"),
        content: "fixture evidence",
        collectedAt: now.toISOString(),
        summary: "Deterministic runtime fixture",
      },
    ],
    gates: [
      { id: "source-provenance", passed: true, evidenceIds: ["fixture-source"] },
      { id: "evidence-cutoff", passed: true, evidenceIds: ["fixture-source"] },
      { id: "uncertainty-recorded", passed: true, evidenceIds: ["fixture-source"] },
    ],
    checkpoint: {
      conclusions: ["The deterministic runtime path completed"],
      assumptions: [],
      unresolvedQuestions: [],
      nextAction: "inspect provenance",
    },
  };
}

export async function createRuntimeFixtureRequest(
  workflowRunId = randomUUID(),
): Promise<StageExecutionRequest> {
  const policies = await loadRuntimePolicies();
  const modelPolicy = policies.models.get("terra-champion");
  const sessionPolicy = policies.sessions.get("bounded-workstream");
  const securityPolicy = policies.security.get("studio-redaction");
  const priceSchedule = policies.pricing.get("openai-2026-08-09");
  if (!modelPolicy || !sessionPolicy || !securityPolicy || !priceSchedule) {
    throw new Error("Runtime policy manifests are incomplete");
  }
  return {
    workflowRunId,
    workflow: "research-to-game",
    workflowVersion: "0.1.0",
    stage: "opportunity-research",
    stageVersion: "0.1.0",
    agent: "researcher",
    agentVersion: "0.1.0",
    agentPurpose: "Discover and rank game opportunities from current evidence.",
    stableInstructions: "Separate observation from inference and preserve provenance.",
    skillHash: hashArtifact("research-game-opportunities@0.1.0"),
    skillContent: "Produce the declared artifacts, evidence gates, and checkpoint.",
    allowedTools: [],
    inputArtifacts: [
      {
        id: "research-question",
        uri: "fixture://research-question",
        sha256: hashArtifact("exercise the durable runtime"),
        content: "Exercise the durable runtime without selecting a product game.",
      },
    ],
    requiredArtifactIds: ["market-brief"],
    requiredEvidenceGates: ["source-provenance", "evidence-cutoff", "uncertainty-recorded"],
    outputContractId: "artifact-envelope",
    outputContractVersion: "0.1.0",
    gitCommit: "0".repeat(40),
    openSpecChange: "durable-agent-runtime",
    modelPolicy,
    sessionPolicy,
    securityPolicy,
    priceSchedule,
    maxOutputTokens: 2_000,
  };
}
