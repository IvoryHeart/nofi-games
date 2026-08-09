import { z } from "zod";
import { Identifier, IsoDateTime, Sha256 } from "./contracts.js";

export const Semver = z.string().regex(/^\d+\.\d+\.\d+$/);
export const ProviderName = z.enum(["fake", "openai"]);

export const SessionBudget = z
  .object({
    softContextTokens: z.number().int().positive(),
    hardContextTokens: z.number().int().positive(),
    softCostMicrousd: z.number().int().nonnegative(),
    hardCostMicrousd: z.number().int().positive(),
    maxIdleSeconds: z.number().int().positive(),
    maxTurns: z.number().int().positive(),
    maxTurnsBetweenCheckpoints: z.number().int().positive(),
    maxRetries: z.number().int().nonnegative(),
    maxDurationSeconds: z.number().int().positive(),
  })
  .refine((value) => value.softContextTokens < value.hardContextTokens, {
    message: "softContextTokens must be below hardContextTokens",
  })
  .refine((value) => value.softCostMicrousd < value.hardCostMicrousd, {
    message: "softCostMicrousd must be below hardCostMicrousd",
  });

export type SessionBudget = z.infer<typeof SessionBudget>;

export const SessionPolicy = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: Semver,
  rotateBetweenStages: z.boolean(),
  checkpointAtStageBoundary: z.literal(true),
  budget: SessionBudget,
});

export type SessionPolicy = z.infer<typeof SessionPolicy>;

export const ModelEscalationReason = z.enum([
  "protected-evaluation-failure",
  "bounded-repair-exhausted",
  "approved-complexity-class",
]);

export const ModelPolicy = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: Semver,
  provider: z.literal("openai"),
  champion: z.object({
    model: z.string().min(1),
    reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh"]),
    reasoningContext: z.enum(["current_turn", "all_turns"]),
  }),
  promptCaching: z.object({
    enabled: z.boolean(),
    prefixVersion: Identifier,
  }),
  escalation: z
    .object({
      enabled: z.boolean(),
      model: z.string().min(1),
      allowedReasons: z.array(ModelEscalationReason),
      maximumPerAttempt: z.number().int().nonnegative(),
    })
    .optional(),
  challengers: z.array(
    z.object({
      model: z.string().min(1),
      enabled: z.boolean(),
      requiresLowerCost: z.boolean(),
    }),
  ),
  evaluationSuite: Identifier,
  liveEnabled: z.boolean(),
});

export type ModelPolicy = z.infer<typeof ModelPolicy>;

export const SecurityPolicy = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: Semver,
  secretEnvironmentPatterns: z.array(z.string().min(1)),
  retainRawPrompts: z.literal(false),
  retainRawResponses: z.literal(false),
  maximumDiagnosticCharacters: z.number().int().positive(),
});

export type SecurityPolicy = z.infer<typeof SecurityPolicy>;

export const OutputContractDefinition = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: Semver,
  description: z.string().min(1),
  requiredFields: z.array(Identifier).min(1),
  additionalProperties: z.literal(false),
});

export type OutputContractDefinition = z.infer<typeof OutputContractDefinition>;

export const PriceRate = z.object({
  inputMicrousdPerMillion: z.number().int().nonnegative(),
  cachedInputMicrousdPerMillion: z.number().int().nonnegative(),
  cacheWriteMicrousdPerMillion: z.number().int().nonnegative().optional(),
  outputMicrousdPerMillion: z.number().int().nonnegative(),
  longContext: z
    .object({
      aboveInputTokens: z.number().int().positive(),
      inputMultiplierBasisPoints: z.number().int().min(10_000),
      outputMultiplierBasisPoints: z.number().int().min(10_000),
    })
    .optional(),
});

export const PriceSchedule = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: Semver,
  provider: z.literal("openai"),
  sourceUrl: z.string().url(),
  retrievedAt: IsoDateTime,
  effectiveAt: IsoDateTime,
  models: z.record(z.string().min(1), PriceRate),
});

export type PriceSchedule = z.infer<typeof PriceSchedule>;

const OptionalTokenCount = z.number().int().nonnegative().optional();

export const ProviderUsage = z.object({
  inputTokens: OptionalTokenCount,
  cachedInputTokens: OptionalTokenCount,
  cacheWriteTokens: OptionalTokenCount,
  outputTokens: OptionalTokenCount,
  reasoningTokens: OptionalTokenCount,
});

export type ProviderUsage = z.infer<typeof ProviderUsage>;

export const EstimatedCost = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("priced"),
    microusd: z.number().int().nonnegative(),
    priceScheduleId: Identifier,
    priceScheduleVersion: Semver,
  }),
  z.object({
    status: z.literal("unpriced"),
    reason: z.enum(["unknown-model", "missing-usage"]),
    priceScheduleId: Identifier,
    priceScheduleVersion: Semver,
  }),
]);

export type EstimatedCost = z.infer<typeof EstimatedCost>;

export const ArtifactReference = z.object({
  id: Identifier,
  uri: z.string().min(1),
  sha256: Sha256,
  mediaType: z.string().min(1),
});

export type ArtifactReference = z.infer<typeof ArtifactReference>;

export const AgentSessionStatus = z.enum(["active", "rotated", "closed", "blocked"]);

export const AgentSession = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  workflowRunId: z.uuid(),
  workflow: Identifier,
  workflowVersion: Semver,
  stage: Identifier,
  agent: Identifier,
  agentVersion: Semver,
  provider: ProviderName,
  providerConversationId: z.string().min(1).optional(),
  compatibilityFingerprint: Sha256,
  modelPolicyVersion: Semver,
  sessionPolicyVersion: Semver,
  securityPolicyVersion: Semver,
  predecessorSessionId: z.uuid().optional(),
  latestCheckpointId: z.uuid().optional(),
  status: AgentSessionStatus,
  accumulatedContextTokens: z.number().int().nonnegative(),
  accumulatedCostMicrousd: z.number().int().nonnegative(),
  turns: z.number().int().nonnegative(),
  turnsSinceCheckpoint: z.number().int().nonnegative(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export type AgentSession = z.infer<typeof AgentSession>;

export const StageAttemptStatus = z.enum([
  "planned",
  "leased",
  "calling",
  "reconciling",
  "validating",
  "accepted",
  "failed",
  "blocked",
  "abandoned",
]);

export type StageAttemptStatus = z.infer<typeof StageAttemptStatus>;

export const StageAttempt = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  idempotencyKey: Sha256,
  workflowRunId: z.uuid(),
  stage: Identifier,
  stageVersion: Semver,
  sessionId: z.uuid(),
  generation: z.number().int().nonnegative(),
  inputHashes: z.record(Identifier, Sha256),
  outputContractHash: Sha256,
  status: StageAttemptStatus,
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: IsoDateTime.optional(),
  lastLeaseOwner: z.string().min(1).optional(),
  lastLeaseExpiresAt: IsoDateTime.optional(),
  acceptedCheckpointId: z.uuid().optional(),
  resumeParentAttemptId: z.uuid().optional(),
  terminalReason: z.string().min(1).optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export type StageAttempt = z.infer<typeof StageAttempt>;

export const CheckpointState = z.object({
  conclusions: z.array(z.string()),
  assumptions: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
  nextAction: z.string().min(1),
});

export const AgentCheckpoint = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  sessionId: z.uuid(),
  attemptId: z.uuid(),
  predecessorCheckpointId: z.uuid().optional(),
  state: CheckpointState,
  stateSha256: Sha256,
  inputArtifacts: z.array(ArtifactReference),
  outputArtifacts: z.array(ArtifactReference),
  evidenceManifestSha256: Sha256,
  outputContractSha256: Sha256,
  versionEnvelope: z.record(z.string(), z.string()),
  createdAt: IsoDateTime,
});

export type AgentCheckpoint = z.infer<typeof AgentCheckpoint>;

export const ModelCallStatus = z.enum([
  "started",
  "completed",
  "failed",
  "reconciliation-required",
  "cancelled",
]);

export const ModelCall = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  sequence: z.number().int().nonnegative(),
  attemptId: z.uuid(),
  sessionId: z.uuid(),
  provider: ProviderName,
  configuredModel: z.string().min(1),
  resolvedModel: z.string().min(1).optional(),
  modelPolicyVersion: Semver,
  providerConversationId: z.string().min(1).optional(),
  providerResponseId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  status: ModelCallStatus,
  usage: ProviderUsage,
  estimatedCost: EstimatedCost,
  latencyMilliseconds: z.number().int().nonnegative().optional(),
  diagnostic: z.string().optional(),
  createdAt: IsoDateTime,
  completedAt: IsoDateTime.optional(),
});

export type ModelCall = z.infer<typeof ModelCall>;

export const RuntimeWorkflowEvent = z.object({
  runId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  status: z.enum(["planned", "running", "evaluating", "completed", "failed", "rolled-back"]),
  reason: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: IsoDateTime,
});

export type RuntimeWorkflowEvent = z.infer<typeof RuntimeWorkflowEvent>;
