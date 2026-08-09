import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashArtifact } from "../src/hashing.js";
import { InMemoryRuntimeRepository } from "../src/in-memory-runtime-repository.js";
import type { AgentCheckpoint, AgentSession, StageAttempt } from "../src/runtime-contracts.js";

const hash = (character: string): string => character.repeat(64);
const start = new Date("2026-08-09T10:00:00.000Z");

function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    schemaVersion: 1,
    id: randomUUID(),
    workflowRunId: "10000000-0000-4000-8000-000000000001",
    workflow: "research-to-game",
    workflowVersion: "0.1.0",
    stage: "opportunity-research",
    agent: "researcher",
    agentVersion: "0.1.0",
    provider: "fake",
    compatibilityFingerprint: hash("a"),
    modelPolicyVersion: "0.1.0",
    sessionPolicyVersion: "0.1.0",
    securityPolicyVersion: "0.1.0",
    status: "active",
    accumulatedContextTokens: 0,
    accumulatedCostMicrousd: 0,
    turns: 0,
    turnsSinceCheckpoint: 0,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    ...overrides,
  };
}

function attempt(sessionId: string, overrides: Partial<StageAttempt> = {}): StageAttempt {
  return {
    schemaVersion: 1,
    id: randomUUID(),
    idempotencyKey: hash("b"),
    workflowRunId: "10000000-0000-4000-8000-000000000001",
    stage: "opportunity-research",
    stageVersion: "0.1.0",
    sessionId,
    generation: 0,
    inputHashes: { question: hash("c") },
    outputContractHash: hash("d"),
    status: "planned",
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    ...overrides,
  };
}

function checkpoint(attemptValue: StageAttempt): AgentCheckpoint {
  const state = {
    conclusions: ["accepted"],
    assumptions: [],
    unresolvedQuestions: [],
    nextAction: "continue",
  };
  return {
    schemaVersion: 1,
    id: randomUUID(),
    sessionId: attemptValue.sessionId,
    attemptId: attemptValue.id,
    state,
    stateSha256: hashArtifact(state),
    inputArtifacts: [],
    outputArtifacts: [],
    evidenceManifestSha256: hash("e"),
    outputContractSha256: attemptValue.outputContractHash,
    versionEnvelope: { gitCommit: "0".repeat(40) },
    createdAt: new Date(start.getTime() + 1_000).toISOString(),
  };
}

describe("in-memory runtime repository", () => {
  it("keeps agent identity independent while isolating incompatible sessions", async () => {
    const repository = new InMemoryRuntimeRepository();
    const first = await repository.createSession(session());
    const duplicate = await repository.createSession(session({ id: randomUUID() }));
    const incompatible = await repository.createSession(
      session({ id: randomUUID(), compatibilityFingerprint: hash("f") }),
    );
    expect(duplicate.id).toBe(first.id);
    expect(incompatible.id).not.toBe(first.id);
    expect(incompatible.agent).toBe(first.agent);
  });

  it("grants exactly one of twenty concurrent workers and rejects late acceptance", async () => {
    const repository = new InMemoryRuntimeRepository();
    const createdSession = await repository.createSession(session());
    const createdAttempt = await repository.createAttempt(attempt(createdSession.id));
    const claims = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        repository.claimAttempt(createdAttempt.id, `worker-${index}`, 60, start),
      ),
    );
    expect(claims.filter((claim) => claim.status === "claimed")).toHaveLength(1);
    const winner = claims.find((claim) => claim.status === "claimed");
    expect(winner?.attempt.leaseOwner).toBe("worker-0");

    const reclaimed = await repository.claimAttempt(
      createdAttempt.id,
      "worker-later",
      60,
      new Date(start.getTime() + 61_000),
    );
    expect(reclaimed.status).toBe("claimed");
    await expect(
      repository.acceptCheckpoint(
        checkpoint(createdAttempt),
        "worker-0",
        new Date(start.getTime() + 62_000),
      ),
    ).rejects.toThrow("absent or stale");

    const accepted = await repository.acceptCheckpoint(
      checkpoint(createdAttempt),
      "worker-later",
      new Date(start.getTime() + 62_000),
    );
    const replay = await repository.claimAttempt(
      createdAttempt.id,
      "worker-replay",
      60,
      new Date(start.getTime() + 63_000),
    );
    expect(replay.status).toBe("accepted");
    expect(replay.status === "accepted" && replay.checkpoint.id).toBe(accepted.id);
  });

  it("isolates returned records from mutation and stores append-only call events", async () => {
    const repository = new InMemoryRuntimeRepository();
    const createdSession = await repository.createSession(session());
    const createdAttempt = await repository.createAttempt(attempt(createdSession.id));
    createdAttempt.status = "accepted";
    expect((await repository.getAttempt(createdAttempt.id))?.status).toBe("planned");

    const baseCall = {
      schemaVersion: 1 as const,
      id: randomUUID(),
      attemptId: createdAttempt.id,
      sessionId: createdSession.id,
      provider: "fake" as const,
      configuredModel: "fake-deterministic",
      modelPolicyVersion: "0.1.0",
      correlationId: "correlation-1",
      usage: {},
      estimatedCost: {
        status: "unpriced" as const,
        reason: "missing-usage" as const,
        priceScheduleId: "openai-2026-08-09",
        priceScheduleVersion: "0.1.0",
      },
      createdAt: start.toISOString(),
    };
    await repository.recordModelCall({ ...baseCall, sequence: 0, status: "started" });
    await repository.recordModelCall({
      ...baseCall,
      sequence: 1,
      status: "completed",
      resolvedModel: "fake-deterministic",
      providerResponseId: "response-1",
      completedAt: new Date(start.getTime() + 1).toISOString(),
    });
    expect(await repository.listModelCallEvents(baseCall.id)).toHaveLength(2);
    await expect(
      repository.recordModelCall({ ...baseCall, sequence: 1, status: "failed" }),
    ).rejects.toThrow("already exists");
  });
});
