import type {
  AgentCheckpoint,
  AgentSession,
  ModelCall,
  RuntimeWorkflowEvent,
  StageAttempt,
  StageAttemptStatus,
} from "./runtime-contracts.js";

export type AttemptClaim =
  | { readonly status: "claimed"; readonly attempt: StageAttempt }
  | {
      readonly status: "accepted";
      readonly attempt: StageAttempt;
      readonly checkpoint: AgentCheckpoint;
    }
  | { readonly status: "reconciling" | "unavailable"; readonly attempt: StageAttempt };

export interface RuntimeRepository {
  createSession(session: AgentSession): Promise<AgentSession>;
  findActiveSession(
    workflowRunId: string,
    stage: string,
    compatibilityFingerprint: string,
  ): Promise<AgentSession | undefined>;
  findLatestActiveSession(workflowRunId: string, stage: string): Promise<AgentSession | undefined>;
  getSession(sessionId: string): Promise<AgentSession | undefined>;
  rotateSession(sessionId: string, status?: "rotated" | "closed" | "blocked"): Promise<void>;
  updateSessionUsage(
    sessionId: string,
    contextTokens: number,
    costMicrousd: number,
    checkpointAccepted: boolean,
  ): Promise<AgentSession>;

  createAttempt(attempt: StageAttempt): Promise<StageAttempt>;
  getAttempt(attemptId: string): Promise<StageAttempt | undefined>;
  getAttemptByIdempotencyKey(idempotencyKey: string): Promise<StageAttempt | undefined>;
  listAttempts(workflowRunId: string): Promise<readonly StageAttempt[]>;
  claimAttempt(
    attemptId: string,
    workerId: string,
    leaseSeconds: number,
    now?: Date,
  ): Promise<AttemptClaim>;
  renewLease(
    attemptId: string,
    workerId: string,
    leaseSeconds: number,
    now?: Date,
  ): Promise<boolean>;
  transitionLeasedAttempt(
    attemptId: string,
    workerId: string,
    status: Extract<StageAttemptStatus, "calling" | "validating" | "failed" | "blocked">,
    reason?: string,
    now?: Date,
  ): Promise<StageAttempt>;
  markReconciliation(
    attemptId: string,
    workerId: string,
    reason: string,
    now?: Date,
  ): Promise<StageAttempt>;

  recordModelCall(call: ModelCall): Promise<void>;
  listModelCallEvents(callId: string): Promise<readonly ModelCall[]>;
  listModelCallsByAttempt(attemptId: string): Promise<readonly ModelCall[]>;
  acceptCheckpoint(
    checkpoint: AgentCheckpoint,
    workerId: string,
    now?: Date,
  ): Promise<AgentCheckpoint>;
  getCheckpoint(checkpointId: string): Promise<AgentCheckpoint | undefined>;
  appendWorkflowEvent(
    workflowRunId: string,
    status: RuntimeWorkflowEvent["status"],
    reason: string,
    payload?: Readonly<Record<string, unknown>>,
  ): Promise<RuntimeWorkflowEvent>;
  listWorkflowEvents(workflowRunId: string): Promise<readonly RuntimeWorkflowEvent[]>;
}
