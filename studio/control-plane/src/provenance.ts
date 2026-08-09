import type {
  AgentCheckpoint,
  AgentSession,
  ModelCall,
  RuntimeWorkflowEvent,
  StageAttempt,
} from "./runtime-contracts.js";
import type { RuntimeRepository } from "./runtime-repository.js";

export interface AttemptProvenance {
  readonly attempt: StageAttempt;
  readonly session: AgentSession;
  readonly checkpoint?: AgentCheckpoint;
  readonly modelCalls: readonly ModelCall[];
  readonly workflowEvents: readonly RuntimeWorkflowEvent[];
}

export async function loadAttemptProvenance(
  repository: RuntimeRepository,
  attemptId: string,
): Promise<AttemptProvenance> {
  const attempt = await repository.getAttempt(attemptId);
  if (!attempt) throw new Error(`Attempt ${attemptId} does not exist`);
  const session = await repository.getSession(attempt.sessionId);
  if (!session) throw new Error(`Session ${attempt.sessionId} does not exist`);
  const checkpoint = attempt.acceptedCheckpointId
    ? await repository.getCheckpoint(attempt.acceptedCheckpointId)
    : undefined;
  return {
    attempt,
    session,
    ...(checkpoint ? { checkpoint } : {}),
    modelCalls: await repository.listModelCallsByAttempt(attemptId),
    workflowEvents: await repository.listWorkflowEvents(attempt.workflowRunId),
  };
}

export function missingProvenanceFields(provenance: AttemptProvenance): readonly string[] {
  const missing: string[] = [];
  const checkpoint = provenance.checkpoint;
  const requiredEnvelope = [
    "gitCommit",
    "openSpecChange",
    "workflow",
    "workflowVersion",
    "stage",
    "stageVersion",
    "agent",
    "agentVersion",
    "promptHash",
    "skillHash",
    "toolPolicyHash",
    "modelPolicyVersion",
    "sessionPolicyVersion",
    "securityPolicyVersion",
    "configuredModel",
    "resolvedModel",
    "provider",
    "providerResponseId",
    "outputContractHash",
  ];
  if (!checkpoint) missing.push("checkpoint");
  else
    for (const key of requiredEnvelope)
      if (!checkpoint.versionEnvelope[key]) missing.push(`checkpoint.${key}`);
  if (!provenance.attempt.idempotencyKey) missing.push("attempt.idempotencyKey");
  if (!provenance.attempt.lastLeaseOwner) missing.push("attempt.lastLeaseOwner");
  if (!provenance.attempt.lastLeaseExpiresAt) missing.push("attempt.lastLeaseExpiresAt");
  if (!provenance.attempt.inputHashes || !Object.keys(provenance.attempt.inputHashes).length) {
    missing.push("attempt.inputHashes");
  }
  if (!provenance.session.compatibilityFingerprint)
    missing.push("session.compatibilityFingerprint");
  if (provenance.attempt.resumeParentAttemptId) {
    if (!provenance.session.predecessorSessionId) missing.push("session.predecessorSessionId");
    if (!checkpoint?.predecessorCheckpointId) missing.push("checkpoint.predecessorCheckpointId");
  }
  const terminalCalls = provenance.modelCalls.filter((call) => call.sequence > 0);
  if (!terminalCalls.length) missing.push("modelCalls.terminal");
  for (const call of terminalCalls) {
    if (!call.providerResponseId && call.status === "completed")
      missing.push(`modelCall.${call.id}.responseId`);
    if (!call.estimatedCost.priceScheduleId) missing.push(`modelCall.${call.id}.priceSchedule`);
  }
  return missing;
}
