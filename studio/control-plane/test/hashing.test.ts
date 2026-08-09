import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  compatibilityFingerprint,
  hashArtifact,
  stageIdempotencyKey,
} from "../src/hashing.js";

const hash = "a".repeat(64);
const base = {
  agent: "researcher",
  agentVersion: "0.1.0",
  promptHash: hash,
  skillHash: hash,
  workflow: "research-to-game",
  workflowVersion: "0.1.0",
  stage: "opportunity-research",
  stageVersion: "0.1.0",
  inputHashes: { question: hash },
  acceptedCheckpointHash: hash,
  outputContractHash: hash,
  toolPolicyHash: hash,
  modelPolicyVersion: "0.1.0",
  sessionPolicyVersion: "0.1.0",
  securityPolicyVersion: "0.1.0",
};

describe("canonical hashing", () => {
  it("sorts object keys recursively", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
    expect(hashArtifact({ b: 2, a: 1 })).toBe(hashArtifact({ a: 1, b: 2 }));
  });

  it("pins the complete compatibility envelope", () => {
    const champion = compatibilityFingerprint(base);
    const mutations = [
      { ...base, agent: "game-designer" },
      { ...base, agentVersion: "0.2.0" },
      { ...base, promptHash: "b".repeat(64) },
      { ...base, skillHash: "b".repeat(64) },
      { ...base, workflow: "game-improvement" },
      { ...base, workflowVersion: "0.2.0" },
      { ...base, stage: "concept-design" },
      { ...base, stageVersion: "0.2.0" },
      { ...base, inputHashes: { question: "b".repeat(64) } },
      { ...base, acceptedCheckpointHash: "b".repeat(64) },
      { ...base, outputContractHash: "b".repeat(64) },
      { ...base, toolPolicyHash: "b".repeat(64) },
      { ...base, modelPolicyVersion: "0.2.0" },
      { ...base, sessionPolicyVersion: "0.2.0" },
      { ...base, securityPolicyVersion: "0.2.0" },
    ];
    expect(mutations.map(compatibilityFingerprint).every((value) => value !== champion)).toBe(true);
  });

  it("includes run and generation in stage idempotency", () => {
    const first = stageIdempotencyKey({
      ...base,
      workflowRunId: "00000000-0000-4000-8000-000000000001",
      generation: 0,
    });
    const second = stageIdempotencyKey({
      ...base,
      workflowRunId: "00000000-0000-4000-8000-000000000001",
      generation: 1,
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });
});
