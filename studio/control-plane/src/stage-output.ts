import { z } from "zod";
import { EvidenceReference, Identifier } from "./contracts.js";
import { hashArtifact } from "./hashing.js";
import { CheckpointState } from "./runtime-contracts.js";

export const ProducedArtifact = z.object({
  id: Identifier,
  mediaType: z.string().min(1),
  content: z.string(),
});

export const EvidenceGateResult = z.object({
  id: Identifier,
  passed: z.literal(true),
  evidenceIds: z.array(Identifier).min(1),
});

export const StageEvidence = EvidenceReference.extend({
  uri: z.url(),
  content: z.string(),
});

export const StageOutputEnvelope = z.object({
  artifacts: z.array(ProducedArtifact),
  evidence: z.array(StageEvidence),
  gates: z.array(EvidenceGateResult),
  checkpoint: CheckpointState,
});

export type StageOutputEnvelope = z.infer<typeof StageOutputEnvelope>;

export const stageOutputJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    artifacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          mediaType: { type: "string", minLength: 1 },
          content: { type: "string" },
        },
        required: ["id", "mediaType", "content"],
      },
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          kind: {
            type: "string",
            enum: ["source", "test", "simulation", "replay", "visual", "telemetry", "feedback"],
          },
          uri: { type: "string", minLength: 1 },
          collectedAt: { type: "string", format: "date-time" },
          summary: { type: "string", minLength: 1 },
          content: { type: "string" },
        },
        required: ["id", "kind", "uri", "collectedAt", "summary", "content"],
      },
    },
    gates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          passed: { type: "boolean", const: true },
          evidenceIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          },
        },
        required: ["id", "passed", "evidenceIds"],
      },
    },
    checkpoint: {
      type: "object",
      additionalProperties: false,
      properties: {
        conclusions: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        unresolvedQuestions: { type: "array", items: { type: "string" } },
        nextAction: { type: "string", minLength: 1 },
      },
      required: ["conclusions", "assumptions", "unresolvedQuestions", "nextAction"],
    },
  },
  required: ["artifacts", "evidence", "gates", "checkpoint"],
};

export function validateStageOutput(
  value: unknown,
  requiredArtifactIds: readonly string[],
  requiredEvidenceGates: readonly string[],
): StageOutputEnvelope {
  const output = StageOutputEnvelope.parse(value);
  const artifactIds = output.artifacts.map((artifact) => artifact.id).sort();
  const expectedArtifacts = [...requiredArtifactIds].sort();
  if (new Set(artifactIds).size !== artifactIds.length)
    throw new Error("Output contains duplicate artifact IDs");
  if (JSON.stringify(artifactIds) !== JSON.stringify(expectedArtifacts)) {
    throw new Error(
      `Output artifacts must exactly match declaration: expected ${expectedArtifacts.join(", ")}`,
    );
  }
  const evidenceIds = new Set(output.evidence.map((evidence) => evidence.id));
  if (evidenceIds.size !== output.evidence.length)
    throw new Error("Output contains duplicate evidence IDs");
  for (const evidence of output.evidence) {
    if (evidence.sha256 && hashArtifact(evidence.content) !== evidence.sha256) {
      throw new Error(`Evidence ${evidence.id} hash does not match retained content`);
    }
  }
  const gateIds = output.gates.map((gate) => gate.id).sort();
  const expectedGates = [...requiredEvidenceGates].sort();
  if (new Set(gateIds).size !== gateIds.length)
    throw new Error("Output contains duplicate gate IDs");
  if (JSON.stringify(gateIds) !== JSON.stringify(expectedGates)) {
    throw new Error(
      `Output gates must exactly match declaration: expected ${expectedGates.join(", ")}`,
    );
  }
  for (const gate of output.gates) {
    if (gate.evidenceIds.some((id) => !evidenceIds.has(id))) {
      throw new Error(`Gate ${gate.id} references undeclared evidence`);
    }
  }
  return output;
}
