import { hashArtifact } from "./hashing.js";
import { redactUnknown } from "./redaction.js";
import {
  AgentCheckpoint as AgentCheckpointSchema,
  AgentSession as AgentSessionSchema,
  ModelCall as ModelCallSchema,
  RuntimeWorkflowEvent as RuntimeWorkflowEventSchema,
  StageAttempt as StageAttemptSchema,
} from "./runtime-contracts.js";
import type {
  AgentCheckpoint,
  AgentSession,
  ModelCall,
  RuntimeWorkflowEvent,
  StageAttempt,
  StageAttemptStatus,
} from "./runtime-contracts.js";
import type { AttemptClaim, RuntimeRepository } from "./runtime-repository.js";

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryRuntimeRepository implements RuntimeRepository {
  readonly #sessions = new Map<string, AgentSession>();
  readonly #attempts = new Map<string, StageAttempt>();
  readonly #attemptIdsByKey = new Map<string, string>();
  readonly #checkpoints = new Map<string, AgentCheckpoint>();
  readonly #modelCalls = new Map<string, ModelCall>();
  readonly #workflowEvents = new Map<string, RuntimeWorkflowEvent[]>();

  constructor(readonly secrets: readonly string[] = []) {}

  async createSession(session: AgentSession): Promise<AgentSession> {
    session = AgentSessionSchema.parse(redactUnknown(session, this.secrets));
    const existing = [...this.#sessions.values()].find(
      (item) =>
        item.workflowRunId === session.workflowRunId &&
        item.stage === session.stage &&
        item.compatibilityFingerprint === session.compatibilityFingerprint &&
        item.status === "active",
    );
    if (existing) return clone(existing);
    if (this.#sessions.has(session.id)) throw new Error(`Session ${session.id} already exists`);
    this.#sessions.set(session.id, clone(session));
    return clone(session);
  }

  async findActiveSession(
    workflowRunId: string,
    stage: string,
    compatibilityFingerprint: string,
  ): Promise<AgentSession | undefined> {
    const session = [...this.#sessions.values()].find(
      (item) =>
        item.workflowRunId === workflowRunId &&
        item.stage === stage &&
        item.compatibilityFingerprint === compatibilityFingerprint &&
        item.status === "active",
    );
    return session ? clone(session) : undefined;
  }

  async findLatestActiveSession(
    workflowRunId: string,
    stage: string,
  ): Promise<AgentSession | undefined> {
    const session = [...this.#sessions.values()]
      .filter(
        (item) =>
          item.workflowRunId === workflowRunId && item.stage === stage && item.status === "active",
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    return session ? clone(session) : undefined;
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    const session = this.#sessions.get(sessionId);
    return session ? clone(session) : undefined;
  }

  async rotateSession(
    sessionId: string,
    status: "rotated" | "closed" | "blocked" = "rotated",
  ): Promise<void> {
    const session = this.#requiredSession(sessionId);
    this.#sessions.set(sessionId, { ...session, status, updatedAt: new Date().toISOString() });
  }

  async updateSessionUsage(
    sessionId: string,
    contextTokens: number,
    costMicrousd: number,
    checkpointAccepted: boolean,
  ): Promise<AgentSession> {
    const session = this.#requiredSession(sessionId);
    const updated: AgentSession = {
      ...session,
      accumulatedContextTokens: session.accumulatedContextTokens + contextTokens,
      accumulatedCostMicrousd: session.accumulatedCostMicrousd + costMicrousd,
      turns: session.turns + 1,
      turnsSinceCheckpoint: checkpointAccepted ? 0 : session.turnsSinceCheckpoint + 1,
      updatedAt: new Date().toISOString(),
    };
    this.#sessions.set(sessionId, updated);
    return clone(updated);
  }

  async createAttempt(attempt: StageAttempt): Promise<StageAttempt> {
    attempt = StageAttemptSchema.parse(redactUnknown(attempt, this.secrets));
    const existingId = this.#attemptIdsByKey.get(attempt.idempotencyKey);
    if (existingId) return clone(this.#requiredAttempt(existingId));
    if (this.#attempts.has(attempt.id)) throw new Error(`Attempt ${attempt.id} already exists`);
    this.#attempts.set(attempt.id, clone(attempt));
    this.#attemptIdsByKey.set(attempt.idempotencyKey, attempt.id);
    return clone(attempt);
  }

  async getAttempt(attemptId: string): Promise<StageAttempt | undefined> {
    const attempt = this.#attempts.get(attemptId);
    return attempt ? clone(attempt) : undefined;
  }

  async getAttemptByIdempotencyKey(idempotencyKey: string): Promise<StageAttempt | undefined> {
    const id = this.#attemptIdsByKey.get(idempotencyKey);
    return id ? clone(this.#requiredAttempt(id)) : undefined;
  }

  async listAttempts(workflowRunId: string): Promise<readonly StageAttempt[]> {
    return [...this.#attempts.values()]
      .filter((attempt) => attempt.workflowRunId === workflowRunId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async claimAttempt(
    attemptId: string,
    workerId: string,
    leaseSeconds: number,
    now = new Date(),
  ): Promise<AttemptClaim> {
    if (!workerId.trim() || leaseSeconds <= 0)
      throw new Error("A worker and positive lease are required");
    const attempt = this.#requiredAttempt(attemptId);
    if (attempt.status === "accepted" && attempt.acceptedCheckpointId) {
      const checkpoint = this.#checkpoints.get(attempt.acceptedCheckpointId);
      if (!checkpoint)
        throw new Error(`Accepted checkpoint ${attempt.acceptedCheckpointId} is missing`);
      return { status: "accepted", attempt: clone(attempt), checkpoint: clone(checkpoint) };
    }
    if (attempt.status === "reconciling") return { status: "reconciling", attempt: clone(attempt) };
    const leaseActive = attempt.leaseExpiresAt && new Date(attempt.leaseExpiresAt) > now;
    if (leaseActive && attempt.leaseOwner !== workerId) {
      return { status: "unavailable", attempt: clone(attempt) };
    }
    if (["abandoned"].includes(attempt.status))
      return { status: "unavailable", attempt: clone(attempt) };
    const updated: StageAttempt = {
      ...attempt,
      status: "leased",
      leaseOwner: workerId,
      leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
      lastLeaseOwner: workerId,
      lastLeaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
      updatedAt: now.toISOString(),
    };
    this.#attempts.set(attemptId, updated);
    return { status: "claimed", attempt: clone(updated) };
  }

  async renewLease(
    attemptId: string,
    workerId: string,
    leaseSeconds: number,
    now = new Date(),
  ): Promise<boolean> {
    const attempt = this.#requiredAttempt(attemptId);
    if (
      attempt.leaseOwner !== workerId ||
      !attempt.leaseExpiresAt ||
      new Date(attempt.leaseExpiresAt) <= now ||
      !["leased", "calling", "validating"].includes(attempt.status)
    )
      return false;
    this.#attempts.set(attemptId, {
      ...attempt,
      leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
      lastLeaseOwner: workerId,
      lastLeaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
      updatedAt: now.toISOString(),
    });
    return true;
  }

  async transitionLeasedAttempt(
    attemptId: string,
    workerId: string,
    status: Extract<StageAttemptStatus, "calling" | "validating" | "failed" | "blocked">,
    reason?: string,
    now = new Date(),
  ): Promise<StageAttempt> {
    const attempt = this.#requireLiveLease(attemptId, workerId, now);
    const terminal = status === "failed" || status === "blocked";
    const updated: StageAttempt = {
      ...attempt,
      status,
      ...(terminal ? { leaseOwner: undefined, leaseExpiresAt: undefined } : {}),
      ...(reason ? { terminalReason: reason } : {}),
      updatedAt: now.toISOString(),
    };
    this.#attempts.set(attemptId, updated);
    return clone(updated);
  }

  async markReconciliation(
    attemptId: string,
    workerId: string,
    reason: string,
    now = new Date(),
  ): Promise<StageAttempt> {
    const attempt = this.#requireLiveLease(attemptId, workerId, now);
    const updated: StageAttempt = {
      ...attempt,
      status: "reconciling",
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      terminalReason: reason,
      updatedAt: now.toISOString(),
    };
    this.#attempts.set(attemptId, updated);
    return clone(updated);
  }

  async recordModelCall(call: ModelCall): Promise<void> {
    call = ModelCallSchema.parse(redactUnknown(call, this.secrets));
    const key = `${call.id}:${call.sequence}`;
    if (this.#modelCalls.has(key)) throw new Error(`Model call event ${key} already exists`);
    this.#modelCalls.set(key, clone(call));
  }

  async listModelCallEvents(callId: string): Promise<readonly ModelCall[]> {
    return [...this.#modelCalls.values()]
      .filter((call) => call.id === callId)
      .sort((left, right) => left.sequence - right.sequence)
      .map(clone);
  }

  async listModelCallsByAttempt(attemptId: string): Promise<readonly ModelCall[]> {
    return [...this.#modelCalls.values()]
      .filter((call) => call.attemptId === attemptId)
      .sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.sequence - right.sequence
          : left.createdAt.localeCompare(right.createdAt),
      )
      .map(clone);
  }

  async acceptCheckpoint(
    checkpoint: AgentCheckpoint,
    workerId: string,
    now = new Date(),
  ): Promise<AgentCheckpoint> {
    checkpoint = AgentCheckpointSchema.parse(redactUnknown(checkpoint, this.secrets));
    const attempt = this.#requireLiveLease(checkpoint.attemptId, workerId, now);
    if (attempt.sessionId !== checkpoint.sessionId)
      throw new Error("Checkpoint session does not match attempt");
    if (attempt.acceptedCheckpointId) throw new Error("Attempt already has an accepted checkpoint");
    if (hashArtifact(checkpoint.state) !== checkpoint.stateSha256) {
      throw new Error("Checkpoint state hash does not match its content");
    }
    if (this.#checkpoints.has(checkpoint.id))
      throw new Error(`Checkpoint ${checkpoint.id} already exists`);
    this.#checkpoints.set(checkpoint.id, clone(checkpoint));
    this.#attempts.set(attempt.id, {
      ...attempt,
      status: "accepted",
      acceptedCheckpointId: checkpoint.id,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      terminalReason: undefined,
      updatedAt: now.toISOString(),
    });
    const session = this.#requiredSession(checkpoint.sessionId);
    this.#sessions.set(session.id, {
      ...session,
      latestCheckpointId: checkpoint.id,
      turnsSinceCheckpoint: 0,
      updatedAt: now.toISOString(),
    });
    return clone(checkpoint);
  }

  async getCheckpoint(checkpointId: string): Promise<AgentCheckpoint | undefined> {
    const checkpoint = this.#checkpoints.get(checkpointId);
    return checkpoint ? clone(checkpoint) : undefined;
  }

  async appendWorkflowEvent(
    workflowRunId: string,
    status: RuntimeWorkflowEvent["status"],
    reason: string,
    payload: Readonly<Record<string, unknown>> = {},
  ): Promise<RuntimeWorkflowEvent> {
    const events = this.#workflowEvents.get(workflowRunId) ?? [];
    const event: RuntimeWorkflowEvent = {
      runId: workflowRunId,
      sequence: events.length,
      status,
      reason,
      payload: structuredClone(payload),
      occurredAt: new Date().toISOString(),
    };
    const safeEvent = RuntimeWorkflowEventSchema.parse(redactUnknown(event, this.secrets));
    this.#workflowEvents.set(workflowRunId, [...events, safeEvent]);
    return clone(safeEvent);
  }

  async listWorkflowEvents(workflowRunId: string): Promise<readonly RuntimeWorkflowEvent[]> {
    return (this.#workflowEvents.get(workflowRunId) ?? []).map(clone);
  }

  #requiredSession(sessionId: string): AgentSession {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);
    return session;
  }

  #requiredAttempt(attemptId: string): StageAttempt {
    const attempt = this.#attempts.get(attemptId);
    if (!attempt) throw new Error(`Attempt ${attemptId} does not exist`);
    return attempt;
  }

  #requireLiveLease(attemptId: string, workerId: string, now: Date): StageAttempt {
    const attempt = this.#requiredAttempt(attemptId);
    if (
      attempt.leaseOwner !== workerId ||
      !attempt.leaseExpiresAt ||
      new Date(attempt.leaseExpiresAt) <= now
    )
      throw new Error("Attempt lease is absent or stale");
    return attempt;
  }
}
