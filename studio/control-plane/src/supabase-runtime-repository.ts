import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AgentCheckpoint,
  AgentSession,
  ModelCall,
  RuntimeWorkflowEvent,
  StageAttempt,
  type StageAttemptStatus,
} from "./runtime-contracts.js";
import type { AttemptClaim, RuntimeRepository } from "./runtime-repository.js";
import { redactUnknown } from "./redaction.js";

type Row = Record<string, unknown>;

function requiredString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Database row is missing ${key}`);
  return value;
}

function optionalString(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" ? value : undefined;
}

function requiredNumber(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Database row is missing ${key}`);
  return value;
}

function optionalNumber(row: Row, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" ? value : undefined;
}

function mapSession(value: unknown): AgentSession {
  const row = value as Row;
  return AgentSession.parse({
    schemaVersion: 1,
    id: requiredString(row, "id"),
    workflowRunId: requiredString(row, "workflow_run_id"),
    workflow: requiredString(row, "workflow"),
    workflowVersion: requiredString(row, "workflow_version"),
    stage: requiredString(row, "stage"),
    agent: requiredString(row, "agent"),
    agentVersion: requiredString(row, "agent_version"),
    provider: requiredString(row, "provider"),
    providerConversationId: optionalString(row, "provider_conversation_id"),
    compatibilityFingerprint: requiredString(row, "compatibility_fingerprint"),
    modelPolicyVersion: requiredString(row, "model_policy_version"),
    sessionPolicyVersion: requiredString(row, "session_policy_version"),
    securityPolicyVersion: requiredString(row, "security_policy_version"),
    predecessorSessionId: optionalString(row, "predecessor_session_id"),
    latestCheckpointId: optionalString(row, "latest_checkpoint_id"),
    status: requiredString(row, "status"),
    accumulatedContextTokens: requiredNumber(row, "accumulated_context_tokens"),
    accumulatedCostMicrousd: requiredNumber(row, "accumulated_cost_microusd"),
    turns: requiredNumber(row, "turns"),
    turnsSinceCheckpoint: requiredNumber(row, "turns_since_checkpoint"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  });
}

function mapAttempt(value: unknown): StageAttempt {
  const row = value as Row;
  return StageAttempt.parse({
    schemaVersion: 1,
    id: requiredString(row, "id"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    workflowRunId: requiredString(row, "workflow_run_id"),
    stage: requiredString(row, "stage"),
    stageVersion: requiredString(row, "stage_version"),
    sessionId: requiredString(row, "session_id"),
    generation: requiredNumber(row, "generation"),
    inputHashes: row.input_hashes,
    outputContractHash: requiredString(row, "output_contract_hash"),
    status: requiredString(row, "status"),
    leaseOwner: optionalString(row, "lease_owner"),
    leaseExpiresAt: optionalString(row, "lease_expires_at"),
    lastLeaseOwner: optionalString(row, "last_lease_owner"),
    lastLeaseExpiresAt: optionalString(row, "last_lease_expires_at"),
    acceptedCheckpointId: optionalString(row, "accepted_checkpoint_id"),
    resumeParentAttemptId: optionalString(row, "resume_parent_attempt_id"),
    terminalReason: optionalString(row, "terminal_reason"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  });
}

function mapCheckpoint(value: unknown): AgentCheckpoint {
  const row = value as Row;
  return AgentCheckpoint.parse({
    schemaVersion: 1,
    id: requiredString(row, "id"),
    sessionId: requiredString(row, "session_id"),
    attemptId: requiredString(row, "attempt_id"),
    predecessorCheckpointId: optionalString(row, "predecessor_checkpoint_id"),
    state: row.state,
    stateSha256: requiredString(row, "state_sha256"),
    inputArtifacts: row.input_artifacts,
    outputArtifacts: row.output_artifacts,
    evidenceManifestSha256: requiredString(row, "evidence_manifest_sha256"),
    outputContractSha256: requiredString(row, "output_contract_sha256"),
    versionEnvelope: row.version_envelope,
    createdAt: requiredString(row, "created_at"),
  });
}

function mapModelCall(value: unknown): ModelCall {
  const row = value as Row;
  const costStatus = requiredString(row, "cost_status");
  return ModelCall.parse({
    schemaVersion: 1,
    id: requiredString(row, "id"),
    sequence: requiredNumber(row, "sequence"),
    attemptId: requiredString(row, "attempt_id"),
    sessionId: requiredString(row, "session_id"),
    provider: requiredString(row, "provider"),
    configuredModel: requiredString(row, "configured_model"),
    resolvedModel: optionalString(row, "resolved_model"),
    modelPolicyVersion: requiredString(row, "model_policy_version"),
    providerConversationId: optionalString(row, "provider_conversation_id"),
    providerResponseId: optionalString(row, "provider_response_id"),
    correlationId: requiredString(row, "correlation_id"),
    status: requiredString(row, "status"),
    usage: {
      inputTokens: optionalNumber(row, "input_tokens"),
      cachedInputTokens: optionalNumber(row, "cached_input_tokens"),
      cacheWriteTokens: optionalNumber(row, "cache_write_tokens"),
      outputTokens: optionalNumber(row, "output_tokens"),
      reasoningTokens: optionalNumber(row, "reasoning_tokens"),
    },
    estimatedCost:
      costStatus === "priced"
        ? {
            status: "priced",
            microusd: requiredNumber(row, "estimated_cost_microusd"),
            priceScheduleId: requiredString(row, "price_schedule_id"),
            priceScheduleVersion: requiredString(row, "price_schedule_version"),
          }
        : {
            status: "unpriced",
            reason: requiredString(row, "unpriced_reason"),
            priceScheduleId: requiredString(row, "price_schedule_id"),
            priceScheduleVersion: requiredString(row, "price_schedule_version"),
          },
    latencyMilliseconds: optionalNumber(row, "latency_milliseconds"),
    diagnostic: optionalString(row, "diagnostic"),
    createdAt: requiredString(row, "created_at"),
    completedAt: optionalString(row, "completed_at"),
  });
}

function mapWorkflowEvent(value: unknown): RuntimeWorkflowEvent {
  const row = value as Row;
  return RuntimeWorkflowEvent.parse({
    runId: requiredString(row, "run_id"),
    sequence: requiredNumber(row, "sequence"),
    status: requiredString(row, "status"),
    reason: requiredString(row, "reason"),
    payload: row.payload,
    occurredAt: requiredString(row, "occurred_at"),
  });
}

function sessionRow(session: AgentSession): Row {
  return {
    id: session.id,
    workflow_run_id: session.workflowRunId,
    workflow: session.workflow,
    workflow_version: session.workflowVersion,
    stage: session.stage,
    agent: session.agent,
    agent_version: session.agentVersion,
    provider: session.provider,
    ...(session.providerConversationId
      ? { provider_conversation_id: session.providerConversationId }
      : {}),
    compatibility_fingerprint: session.compatibilityFingerprint,
    model_policy_version: session.modelPolicyVersion,
    session_policy_version: session.sessionPolicyVersion,
    security_policy_version: session.securityPolicyVersion,
    ...(session.predecessorSessionId
      ? { predecessor_session_id: session.predecessorSessionId }
      : {}),
    status: session.status,
    accumulated_context_tokens: session.accumulatedContextTokens,
    accumulated_cost_microusd: session.accumulatedCostMicrousd,
    turns: session.turns,
    turns_since_checkpoint: session.turnsSinceCheckpoint,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

function attemptRow(attempt: StageAttempt): Row {
  return {
    id: attempt.id,
    idempotency_key: attempt.idempotencyKey,
    workflow_run_id: attempt.workflowRunId,
    stage: attempt.stage,
    stage_version: attempt.stageVersion,
    session_id: attempt.sessionId,
    generation: attempt.generation,
    input_hashes: attempt.inputHashes,
    output_contract_hash: attempt.outputContractHash,
    status: attempt.status,
    ...(attempt.resumeParentAttemptId
      ? { resume_parent_attempt_id: attempt.resumeParentAttemptId }
      : {}),
    ...(attempt.lastLeaseOwner ? { last_lease_owner: attempt.lastLeaseOwner } : {}),
    ...(attempt.lastLeaseExpiresAt ? { last_lease_expires_at: attempt.lastLeaseExpiresAt } : {}),
    created_at: attempt.createdAt,
    updated_at: attempt.updatedAt,
  };
}

function modelCallRow(call: ModelCall): Row {
  return {
    id: call.id,
    sequence: call.sequence,
    attempt_id: call.attemptId,
    session_id: call.sessionId,
    provider: call.provider,
    configured_model: call.configuredModel,
    ...(call.resolvedModel ? { resolved_model: call.resolvedModel } : {}),
    model_policy_version: call.modelPolicyVersion,
    ...(call.providerConversationId
      ? { provider_conversation_id: call.providerConversationId }
      : {}),
    ...(call.providerResponseId ? { provider_response_id: call.providerResponseId } : {}),
    correlation_id: call.correlationId,
    status: call.status,
    input_tokens: call.usage.inputTokens ?? null,
    cached_input_tokens: call.usage.cachedInputTokens ?? null,
    cache_write_tokens: call.usage.cacheWriteTokens ?? null,
    output_tokens: call.usage.outputTokens ?? null,
    reasoning_tokens: call.usage.reasoningTokens ?? null,
    cost_status: call.estimatedCost.status,
    estimated_cost_microusd:
      call.estimatedCost.status === "priced" ? call.estimatedCost.microusd : null,
    unpriced_reason: call.estimatedCost.status === "unpriced" ? call.estimatedCost.reason : null,
    price_schedule_id: call.estimatedCost.priceScheduleId,
    price_schedule_version: call.estimatedCost.priceScheduleVersion,
    latency_milliseconds: call.latencyMilliseconds ?? null,
    diagnostic: call.diagnostic ?? null,
    created_at: call.createdAt,
    completed_at: call.completedAt ?? null,
  };
}

export class SupabaseRuntimeRepository implements RuntimeRepository {
  constructor(
    readonly client: SupabaseClient,
    readonly secrets: readonly string[] = [],
  ) {}

  async createSession(session: AgentSession): Promise<AgentSession> {
    session = AgentSession.parse(redactUnknown(session, this.secrets));
    const { data, error } = await this.client
      .from("studio_agent_sessions")
      .insert(sessionRow(session))
      .select()
      .single();
    if (error && error.code !== "23505") throw error;
    if (data) return mapSession(data);
    const existing = await this.findActiveSession(
      session.workflowRunId,
      session.stage,
      session.compatibilityFingerprint,
    );
    if (!existing) throw new Error("Compatible session insert did not return or persist a row");
    return existing;
  }

  async findActiveSession(
    workflowRunId: string,
    stage: string,
    compatibilityFingerprint: string,
  ): Promise<AgentSession | undefined> {
    const { data, error } = await this.client
      .from("studio_agent_sessions")
      .select()
      .eq("workflow_run_id", workflowRunId)
      .eq("stage", stage)
      .eq("compatibility_fingerprint", compatibilityFingerprint)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data) : undefined;
  }

  async findLatestActiveSession(
    workflowRunId: string,
    stage: string,
  ): Promise<AgentSession | undefined> {
    const { data, error } = await this.client
      .from("studio_agent_sessions")
      .select()
      .eq("workflow_run_id", workflowRunId)
      .eq("stage", stage)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data) : undefined;
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    const { data, error } = await this.client
      .from("studio_agent_sessions")
      .select()
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data) : undefined;
  }

  async rotateSession(
    sessionId: string,
    status: "rotated" | "closed" | "blocked" = "rotated",
  ): Promise<void> {
    const { error } = await this.client
      .from("studio_agent_sessions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active");
    if (error) throw error;
  }

  async updateSessionUsage(
    sessionId: string,
    contextTokens: number,
    costMicrousd: number,
    checkpointAccepted: boolean,
  ): Promise<AgentSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);
    const { data, error } = await this.client
      .from("studio_agent_sessions")
      .update({
        accumulated_context_tokens: session.accumulatedContextTokens + contextTokens,
        accumulated_cost_microusd: session.accumulatedCostMicrousd + costMicrousd,
        turns: session.turns + 1,
        turns_since_checkpoint: checkpointAccepted ? 0 : session.turnsSinceCheckpoint + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select()
      .single();
    if (error) throw error;
    return mapSession(data);
  }

  async createAttempt(attempt: StageAttempt): Promise<StageAttempt> {
    attempt = StageAttempt.parse(redactUnknown(attempt, this.secrets));
    const { error } = await this.client
      .from("studio_stage_attempts")
      .upsert(attemptRow(attempt), { onConflict: "idempotency_key", ignoreDuplicates: true });
    if (error) throw error;
    const persisted = await this.getAttemptByIdempotencyKey(attempt.idempotencyKey);
    if (!persisted) throw new Error("Attempt insert did not persist a row");
    return persisted;
  }

  async getAttempt(attemptId: string): Promise<StageAttempt | undefined> {
    const { data, error } = await this.client
      .from("studio_stage_attempts")
      .select()
      .eq("id", attemptId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAttempt(data) : undefined;
  }

  async getAttemptByIdempotencyKey(idempotencyKey: string): Promise<StageAttempt | undefined> {
    const { data, error } = await this.client
      .from("studio_stage_attempts")
      .select()
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAttempt(data) : undefined;
  }

  async listAttempts(workflowRunId: string): Promise<readonly StageAttempt[]> {
    const { data, error } = await this.client
      .from("studio_stage_attempts")
      .select()
      .eq("workflow_run_id", workflowRunId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapAttempt);
  }

  async claimAttempt(
    attemptId: string,
    workerId: string,
    leaseSeconds: number,
  ): Promise<AttemptClaim> {
    const { data, error } = await this.client.rpc("studio_claim_stage_attempt", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0)
      return { status: "claimed", attempt: mapAttempt(data[0]) };
    const attempt = await this.getAttempt(attemptId);
    if (!attempt) throw new Error(`Attempt ${attemptId} does not exist`);
    if (attempt.status === "accepted" && attempt.acceptedCheckpointId) {
      const checkpoint = await this.getCheckpoint(attempt.acceptedCheckpointId);
      if (!checkpoint)
        throw new Error(`Accepted checkpoint ${attempt.acceptedCheckpointId} is missing`);
      return { status: "accepted", attempt, checkpoint };
    }
    return { status: attempt.status === "reconciling" ? "reconciling" : "unavailable", attempt };
  }

  async renewLease(attemptId: string, workerId: string, leaseSeconds: number): Promise<boolean> {
    const { data, error } = await this.client.rpc("studio_renew_stage_lease", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    return Array.isArray(data) && data.length === 1;
  }

  async transitionLeasedAttempt(
    attemptId: string,
    workerId: string,
    status: Extract<StageAttemptStatus, "calling" | "validating" | "failed" | "blocked">,
    reason?: string,
  ): Promise<StageAttempt> {
    const terminal = status === "failed" || status === "blocked";
    const patch: Row = {
      status,
      updated_at: new Date().toISOString(),
      ...(reason ? { terminal_reason: reason } : {}),
      ...(terminal ? { lease_owner: null, lease_expires_at: null } : {}),
    };
    const { data, error } = await this.client
      .from("studio_stage_attempts")
      .update(patch)
      .eq("id", attemptId)
      .eq("lease_owner", workerId)
      .gt("lease_expires_at", new Date().toISOString())
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Attempt lease is absent or stale");
    return mapAttempt(data);
  }

  async markReconciliation(
    attemptId: string,
    workerId: string,
    reason: string,
    _now?: Date,
  ): Promise<StageAttempt> {
    const { data, error } = await this.client.rpc("studio_mark_attempt_reconciling", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_reason: reason,
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1)
      throw new Error("Attempt lease is absent or stale");
    return mapAttempt(data[0]);
  }

  async recordModelCall(call: ModelCall): Promise<void> {
    call = ModelCall.parse(redactUnknown(call, this.secrets));
    const { error } = await this.client.from("studio_model_calls").insert(modelCallRow(call));
    if (error) throw error;
  }

  async listModelCallEvents(callId: string): Promise<readonly ModelCall[]> {
    const { data, error } = await this.client
      .from("studio_model_calls")
      .select()
      .eq("id", callId)
      .order("sequence");
    if (error) throw error;
    return (data ?? []).map(mapModelCall);
  }

  async listModelCallsByAttempt(attemptId: string): Promise<readonly ModelCall[]> {
    const { data, error } = await this.client
      .from("studio_model_calls")
      .select()
      .eq("attempt_id", attemptId)
      .order("created_at")
      .order("sequence");
    if (error) throw error;
    return (data ?? []).map(mapModelCall);
  }

  async acceptCheckpoint(checkpoint: AgentCheckpoint, workerId: string): Promise<AgentCheckpoint> {
    checkpoint = AgentCheckpoint.parse(redactUnknown(checkpoint, this.secrets));
    const { data, error } = await this.client.rpc("studio_accept_agent_checkpoint", {
      p_attempt_id: checkpoint.attemptId,
      p_worker_id: workerId,
      p_checkpoint_id: checkpoint.id,
      p_predecessor_checkpoint_id: checkpoint.predecessorCheckpointId ?? null,
      p_state: checkpoint.state,
      p_state_sha256: checkpoint.stateSha256,
      p_input_artifacts: checkpoint.inputArtifacts,
      p_output_artifacts: checkpoint.outputArtifacts,
      p_evidence_manifest_sha256: checkpoint.evidenceManifestSha256,
      p_output_contract_sha256: checkpoint.outputContractSha256,
      p_version_envelope: checkpoint.versionEnvelope,
    });
    if (error) throw error;
    return mapCheckpoint(data);
  }

  async getCheckpoint(checkpointId: string): Promise<AgentCheckpoint | undefined> {
    const { data, error } = await this.client
      .from("studio_agent_checkpoints")
      .select()
      .eq("id", checkpointId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCheckpoint(data) : undefined;
  }

  async appendWorkflowEvent(
    workflowRunId: string,
    status: RuntimeWorkflowEvent["status"],
    reason: string,
    payload: Readonly<Record<string, unknown>> = {},
  ): Promise<RuntimeWorkflowEvent> {
    const safeReason = String(redactUnknown(reason, this.secrets));
    const safePayload = redactUnknown(payload, this.secrets) as Readonly<Record<string, unknown>>;
    const { data, error } = await this.client.rpc("studio_append_runtime_event", {
      p_run_id: workflowRunId,
      p_status: status,
      p_reason: safeReason,
      p_payload: safePayload,
    });
    if (error) throw error;
    return mapWorkflowEvent(data);
  }

  async listWorkflowEvents(workflowRunId: string): Promise<readonly RuntimeWorkflowEvent[]> {
    const { data, error } = await this.client
      .from("studio_run_events")
      .select()
      .eq("run_id", workflowRunId)
      .order("sequence");
    if (error) throw error;
    return (data ?? []).map(mapWorkflowEvent);
  }
}

export function createSupabaseRuntimeRepository(
  url: string,
  serviceRoleKey: string,
  secrets: readonly string[] = [],
): SupabaseRuntimeRepository {
  if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required");
  return new SupabaseRuntimeRepository(
    createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    [serviceRoleKey, ...secrets],
  );
}
