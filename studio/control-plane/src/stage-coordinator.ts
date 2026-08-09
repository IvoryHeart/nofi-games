import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ArtifactStore } from "./artifact-store.js";
import { estimateModelCost } from "./accounting.js";
import { buildExecutionEnvelope } from "./execution-envelope.js";
import { compatibilityFingerprint, hashArtifact, stageIdempotencyKey } from "./hashing.js";
import type { AgentProvider } from "./provider.js";
import { ProviderExecutionError } from "./provider.js";
import { redactString, redactUnknown } from "./redaction.js";
import type {
  AgentCheckpoint,
  AgentSession,
  ArtifactReference,
  ModelCall,
  ModelPolicy,
  PriceSchedule,
  SecurityPolicy,
  SessionPolicy,
  StageAttempt,
} from "./runtime-contracts.js";
import {
  AgentCheckpoint as AgentCheckpointSchema,
  ModelPolicy as ModelPolicySchema,
  PriceSchedule as PriceScheduleSchema,
  SecurityPolicy as SecurityPolicySchema,
  SessionPolicy as SessionPolicySchema,
} from "./runtime-contracts.js";
import type { RuntimeRepository } from "./runtime-repository.js";
import { decideSession } from "./session-policy.js";
import { validateStageOutput } from "./stage-output.js";

export const StageInputArtifact = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  uri: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mediaType: z.string().min(1).optional(),
  content: z.unknown().optional(),
});

export type StageInputArtifact = z.infer<typeof StageInputArtifact>;

export const StageExecutionRequest = z.object({
  workflowRunId: z.uuid(),
  workflow: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  workflowVersion: z.string().min(1),
  stage: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  stageVersion: z.string().min(1),
  agent: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  agentVersion: z.string().min(1),
  agentPurpose: z.string().min(1),
  stableInstructions: z.string().min(1),
  skillHash: z.string().regex(/^[a-f0-9]{64}$/),
  skillContent: z.string().min(1),
  allowedTools: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  inputArtifacts: z.array(StageInputArtifact),
  inputCheckpoint: AgentCheckpointSchema.optional(),
  requiredArtifactIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  requiredEvidenceGates: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  outputContractId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  outputContractVersion: z.string().min(1),
  gitCommit: z.string().regex(/^[a-f0-9]{40}$/),
  openSpecChange: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  generation: z.number().int().nonnegative().optional(),
  resumeParentAttemptId: z.uuid().optional(),
  projectedInputTokens: z.number().int().nonnegative().optional(),
  projectedCostMicrousd: z.number().int().nonnegative().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  modelPolicy: ModelPolicySchema,
  sessionPolicy: SessionPolicySchema,
  securityPolicy: SecurityPolicySchema,
  priceSchedule: PriceScheduleSchema,
});

export type StageExecutionRequest = z.infer<typeof StageExecutionRequest>;

export type StageExecutionResult =
  | {
      readonly status: "accepted" | "replayed";
      readonly session: AgentSession;
      readonly attempt: StageAttempt;
      readonly checkpoint: AgentCheckpoint;
      readonly calls: number;
    }
  | {
      readonly status: "blocked" | "failed" | "reconciling" | "leased-elsewhere";
      readonly reason: string;
      readonly session?: AgentSession;
      readonly attempt?: StageAttempt;
      readonly calls: number;
    };

export interface StageCoordinatorOptions {
  readonly workerId: string;
  readonly leaseSeconds?: number;
  readonly allowLive?: boolean;
  readonly workersEnabled?: boolean;
  readonly now?: () => Date;
  readonly secrets?: readonly string[];
}

export class StageCoordinator {
  readonly #leaseSeconds: number;
  readonly #now: () => Date;
  readonly #secrets: readonly string[];
  #allowLive: boolean;
  #workersEnabled: boolean;
  #executionGeneration = 0;

  constructor(
    readonly repository: RuntimeRepository,
    readonly artifacts: ArtifactStore,
    readonly provider: AgentProvider,
    readonly options: StageCoordinatorOptions,
  ) {
    this.#leaseSeconds = options.leaseSeconds ?? 120;
    this.#allowLive = options.allowLive ?? false;
    this.#workersEnabled = options.workersEnabled ?? true;
    this.#now = options.now ?? (() => new Date());
    this.#secrets = options.secrets ?? [];
  }

  disableLiveExecution(): void {
    this.#allowLive = false;
    this.#workersEnabled = false;
    this.#executionGeneration += 1;
  }

  async executeStage(request: StageExecutionRequest): Promise<StageExecutionResult> {
    request = this.#sanitizeRequest(request);
    if (!this.#workersEnabled)
      return { status: "blocked", reason: "worker-claims-disabled", calls: 0 };
    if (this.provider.name === "openai" && (!this.#allowLive || !request.modelPolicy.liveEnabled)) {
      return { status: "blocked", reason: "live-provider-disabled", calls: 0 };
    }
    const executionGeneration = this.#executionGeneration;
    await this.#verifyCheckpointArtifacts(request.inputCheckpoint);
    const persistedInputArtifacts = await Promise.all(
      request.inputArtifacts.map((artifact) =>
        artifact.content === undefined
          ? Promise.resolve({
              id: artifact.id,
              uri: artifact.uri,
              sha256: artifact.sha256,
              mediaType: artifact.mediaType ?? "application/octet-stream",
            })
          : this.artifacts.put(
              artifact.id,
              artifact.content,
              artifact.mediaType ?? "application/json",
            ),
      ),
    );
    const inputHashes = Object.fromEntries(
      request.inputArtifacts.map((artifact) => [artifact.id, artifact.sha256]),
    );
    const outputContractHash = hashArtifact({
      id: request.outputContractId,
      version: request.outputContractVersion,
      artifacts: [...request.requiredArtifactIds].sort(),
      gates: [...request.requiredEvidenceGates].sort(),
    });
    const toolPolicyHash = hashArtifact([...request.allowedTools].sort());
    const promptHash = hashArtifact({
      stableInstructions: request.stableInstructions,
      agentPurpose: request.agentPurpose,
      skillContent: request.skillContent,
    });
    const fingerprintInput = {
      agent: request.agent,
      agentVersion: request.agentVersion,
      promptHash,
      skillHash: request.skillHash,
      workflow: request.workflow,
      workflowVersion: request.workflowVersion,
      stage: request.stage,
      stageVersion: request.stageVersion,
      inputHashes,
      ...(request.inputCheckpoint
        ? { acceptedCheckpointHash: request.inputCheckpoint.stateSha256 }
        : {}),
      outputContractHash,
      toolPolicyHash,
      modelPolicyVersion: request.modelPolicy.version,
      sessionPolicyVersion: request.sessionPolicy.version,
      securityPolicyVersion: request.securityPolicy.version,
    };
    const fingerprint = compatibilityFingerprint(fingerprintInput);
    const idempotencyKey = stageIdempotencyKey({
      ...fingerprintInput,
      workflowRunId: request.workflowRunId,
      generation: request.generation ?? 0,
    });
    const existingAttempt = await this.repository.getAttemptByIdempotencyKey(idempotencyKey);
    if (existingAttempt?.status === "accepted" && existingAttempt.acceptedCheckpointId) {
      const checkpoint = await this.repository.getCheckpoint(existingAttempt.acceptedCheckpointId);
      const session = await this.repository.getSession(existingAttempt.sessionId);
      if (!checkpoint || !session) throw new Error("Accepted attempt provenance is incomplete");
      return { status: "replayed", session, attempt: existingAttempt, checkpoint, calls: 0 };
    }

    let session = await this.repository.findActiveSession(
      request.workflowRunId,
      request.stage,
      fingerprint,
    );
    let predecessorSessionId: string | undefined;
    if (!session) {
      const latestSession = await this.repository.findLatestActiveSession(
        request.workflowRunId,
        request.stage,
      );
      if (latestSession?.status === "active") {
        predecessorSessionId = latestSession.id;
        await this.repository.rotateSession(latestSession.id);
      }
    }
    const conversationAvailable = session?.providerConversationId
      ? await this.provider.conversationExists(session.providerConversationId)
      : session === undefined;
    const decision = decideSession(session, request.sessionPolicy, {
      providerConversationAvailable: conversationAvailable,
      ...(request.projectedInputTokens === undefined
        ? {}
        : { projectedInputTokens: request.projectedInputTokens }),
      ...(request.projectedCostMicrousd === undefined
        ? {}
        : { projectedCostMicrousd: request.projectedCostMicrousd }),
      now: this.#now(),
    });
    if (decision.action === "stop") {
      if (session) await this.repository.rotateSession(session.id, "blocked");
      await this.repository.appendWorkflowEvent(
        request.workflowRunId,
        "failed",
        decision.reason.startsWith("hard-") ? "budget-exhausted" : "session-policy-stop",
        {
          reason: decision.reason,
          resumable: Boolean(request.inputCheckpoint ?? session?.latestCheckpointId),
        },
      );
      return {
        status: "blocked",
        reason: decision.reason,
        ...(session ? { session } : {}),
        calls: 0,
      };
    }
    if (decision.action === "rotate" && !request.inputCheckpoint && !session?.latestCheckpointId) {
      return {
        status: "blocked",
        reason: `${decision.reason}: checkpoint-required-before-rotation`,
        ...(session ? { session } : {}),
        calls: 0,
      };
    }
    if (decision.action === "rotate" && session) {
      predecessorSessionId = session.id;
      await this.repository.rotateSession(session.id);
      session = undefined;
    }
    if (!session) {
      const conversation = await this.provider.createConversation({
        workflow_run_id: request.workflowRunId,
        stage: request.stage,
        agent: request.agent,
      });
      const now = this.#now().toISOString();
      session = await this.repository.createSession({
        schemaVersion: 1,
        id: randomUUID(),
        workflowRunId: request.workflowRunId,
        workflow: request.workflow,
        workflowVersion: request.workflowVersion,
        stage: request.stage,
        agent: request.agent,
        agentVersion: request.agentVersion,
        provider: this.provider.name,
        providerConversationId: conversation.id,
        compatibilityFingerprint: fingerprint,
        modelPolicyVersion: request.modelPolicy.version,
        sessionPolicyVersion: request.sessionPolicy.version,
        securityPolicyVersion: request.securityPolicy.version,
        ...(predecessorSessionId ? { predecessorSessionId } : {}),
        status: "active",
        accumulatedContextTokens: 0,
        accumulatedCostMicrousd: 0,
        turns: 0,
        turnsSinceCheckpoint: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const now = this.#now().toISOString();
    const attempt = await this.repository.createAttempt({
      schemaVersion: 1,
      id: existingAttempt?.id ?? randomUUID(),
      idempotencyKey,
      workflowRunId: request.workflowRunId,
      stage: request.stage,
      stageVersion: request.stageVersion,
      sessionId: session.id,
      generation: request.generation ?? 0,
      inputHashes,
      outputContractHash,
      status: existingAttempt?.status ?? "planned",
      ...((request.resumeParentAttemptId ?? request.inputCheckpoint?.attemptId)
        ? {
            resumeParentAttemptId:
              request.resumeParentAttemptId ?? request.inputCheckpoint?.attemptId,
          }
        : {}),
      createdAt: existingAttempt?.createdAt ?? now,
      updatedAt: now,
    });
    const claim = await this.repository.claimAttempt(
      attempt.id,
      this.options.workerId,
      this.#leaseSeconds,
      this.#now(),
    );
    if (claim.status === "accepted") {
      return {
        status: "replayed",
        session,
        attempt: claim.attempt,
        checkpoint: claim.checkpoint,
        calls: 0,
      };
    }
    if (claim.status !== "claimed") {
      return {
        status: claim.status === "reconciling" ? "reconciling" : "leased-elsewhere",
        reason: claim.status,
        session,
        attempt: claim.attempt,
        calls: 0,
      };
    }

    let calls = 0;
    let validationErrors: string[] = [];
    for (let repair = 0; repair <= request.sessionPolicy.budget.maxRetries; repair += 1) {
      const callId = randomUUID();
      const correlationId = `${attempt.id}:${repair}`;
      const callCreatedAt = this.#now().toISOString();
      await this.repository.recordModelCall(
        this.#modelCallStart(callId, correlationId, attempt, session, request, callCreatedAt),
      );
      await this.repository.transitionLeasedAttempt(
        attempt.id,
        this.options.workerId,
        "calling",
        undefined,
        this.#now(),
      );
      calls += 1;
      const envelope = buildExecutionEnvelope(
        request,
        session,
        correlationId,
        request.inputCheckpoint,
        validationErrors,
      );
      const providerExecution = await this.#executeWithLeaseRenewal(attempt.id, () =>
        this.provider.execute(envelope),
      );
      if (!providerExecution.ok) {
        const error = providerExecution.error;
        const normalized =
          error instanceof ProviderExecutionError
            ? error
            : new ProviderExecutionError("Provider call failed", "provider-rejected", false, {
                cause: error,
              });
        const safeDiagnostic = redactString(normalized.message, this.#secrets).slice(
          0,
          request.securityPolicy.maximumDiagnosticCharacters,
        );
        await this.repository.recordModelCall({
          schemaVersion: 1,
          id: callId,
          sequence: 1,
          attemptId: attempt.id,
          sessionId: session.id,
          provider: this.provider.name,
          configuredModel: request.modelPolicy.champion.model,
          modelPolicyVersion: request.modelPolicy.version,
          providerConversationId: session.providerConversationId,
          correlationId,
          status: normalized.outcomeUncertain
            ? "reconciliation-required"
            : normalized.category === "cancelled"
              ? "cancelled"
              : "failed",
          usage: {},
          estimatedCost: {
            status: "unpriced",
            reason: "missing-usage",
            priceScheduleId: request.priceSchedule.id,
            priceScheduleVersion: request.priceSchedule.version,
          },
          diagnostic: safeDiagnostic,
          createdAt: callCreatedAt,
          completedAt: this.#now().toISOString(),
        });
        if (!providerExecution.leaseMaintained) {
          return {
            status: "leased-elsewhere",
            reason: "lease-lost-during-provider-call",
            session,
            attempt: (await this.repository.getAttempt(attempt.id)) ?? attempt,
            calls,
          };
        }
        if (normalized.outcomeUncertain) {
          const reconciling = await this.repository.markReconciliation(
            attempt.id,
            this.options.workerId,
            safeDiagnostic,
            this.#now(),
          );
          return {
            status: "reconciling",
            reason: safeDiagnostic,
            session,
            attempt: reconciling,
            calls,
          };
        }
        const failed = await this.repository.transitionLeasedAttempt(
          attempt.id,
          this.options.workerId,
          "failed",
          safeDiagnostic,
          this.#now(),
        );
        return { status: "failed", reason: safeDiagnostic, session, attempt: failed, calls };
      }

      const result = providerExecution.value;

      const cost = estimateModelCost(result.resolvedModel, result.usage, request.priceSchedule);
      await this.repository.recordModelCall({
        schemaVersion: 1,
        id: callId,
        sequence: 1,
        attemptId: attempt.id,
        sessionId: session.id,
        provider: this.provider.name,
        configuredModel: request.modelPolicy.champion.model,
        resolvedModel: result.resolvedModel,
        modelPolicyVersion: request.modelPolicy.version,
        providerConversationId: result.conversationId,
        providerResponseId: result.responseId,
        correlationId,
        status: "completed",
        usage: result.usage,
        estimatedCost: cost,
        latencyMilliseconds: result.latencyMilliseconds,
        createdAt: callCreatedAt,
        completedAt: this.#now().toISOString(),
      });
      session = await this.repository.updateSessionUsage(
        session.id,
        result.usage.inputTokens ?? 0,
        cost.status === "priced" ? cost.microusd : 0,
        false,
      );
      if (!providerExecution.leaseMaintained) {
        return {
          status: "leased-elsewhere",
          reason: "lease-lost-during-provider-call",
          session,
          attempt: (await this.repository.getAttempt(attempt.id)) ?? attempt,
          calls,
        };
      }
      if (!this.#workersEnabled || executionGeneration !== this.#executionGeneration) {
        const reconciling = await this.repository.markReconciliation(
          attempt.id,
          this.options.workerId,
          "runtime-disabled-during-provider-call",
          this.#now(),
        );
        return {
          status: "reconciling",
          reason: "runtime-disabled-during-provider-call",
          session,
          attempt: reconciling,
          calls,
        };
      }
      await this.repository.transitionLeasedAttempt(
        attempt.id,
        this.options.workerId,
        "validating",
        undefined,
        this.#now(),
      );

      let output;
      try {
        output = validateStageOutput(
          redactUnknown(result.output, this.#secrets),
          request.requiredArtifactIds,
          request.requiredEvidenceGates,
        );
      } catch (error) {
        validationErrors = [
          error instanceof Error ? error.message : "Structured output validation failed",
        ];
        if (repair >= request.sessionPolicy.budget.maxRetries) {
          const failed = await this.repository.transitionLeasedAttempt(
            attempt.id,
            this.options.workerId,
            "failed",
            validationErrors[0],
            this.#now(),
          );
          return {
            status: "failed",
            reason: validationErrors[0] ?? "validation-failed",
            session,
            attempt: failed,
            calls,
          };
        }
        const hardReached =
          session.accumulatedContextTokens >= request.sessionPolicy.budget.hardContextTokens ||
          session.accumulatedCostMicrousd >= request.sessionPolicy.budget.hardCostMicrousd;
        if (hardReached) {
          await this.repository.appendWorkflowEvent(
            request.workflowRunId,
            "failed",
            "budget-exhausted",
            {
              reason: "budget-exhausted-before-repair",
              resumable: Boolean(request.inputCheckpoint),
            },
          );
          const blocked = await this.repository.transitionLeasedAttempt(
            attempt.id,
            this.options.workerId,
            "blocked",
            "budget-exhausted-before-repair",
            this.#now(),
          );
          return {
            status: "blocked",
            reason: "budget-exhausted-before-repair",
            session,
            attempt: blocked,
            calls,
          };
        }
        continue;
      }

      const outputArtifacts = await Promise.all(
        output.artifacts.map((artifact) =>
          this.artifacts.put(artifact.id, artifact.content, artifact.mediaType),
        ),
      );
      const evidenceArtifacts = await Promise.all(
        output.evidence.map((evidence) =>
          this.artifacts.put(`evidence-${evidence.id}`, evidence.content, "application/json"),
        ),
      );
      const retainedEvidence = output.evidence.map((evidence, index) => ({
        id: evidence.id,
        kind: evidence.kind,
        sourceUri: evidence.uri,
        uri: evidenceArtifacts[index]!.uri,
        sha256: evidenceArtifacts[index]!.sha256,
        collectedAt: evidence.collectedAt,
        summary: evidence.summary,
      }));
      const evidenceManifest = await this.artifacts.put(
        "runtime-evidence-manifest",
        retainedEvidence,
        "application/json",
      );
      const checkpoint: AgentCheckpoint = {
        schemaVersion: 1,
        id: randomUUID(),
        sessionId: session.id,
        attemptId: attempt.id,
        ...(request.inputCheckpoint ? { predecessorCheckpointId: request.inputCheckpoint.id } : {}),
        state: output.checkpoint,
        stateSha256: hashArtifact(output.checkpoint),
        inputArtifacts: persistedInputArtifacts,
        outputArtifacts: [...outputArtifacts, ...evidenceArtifacts, evidenceManifest],
        evidenceManifestSha256: evidenceManifest.sha256,
        outputContractSha256: outputContractHash,
        versionEnvelope: {
          gitCommit: request.gitCommit,
          openSpecChange: request.openSpecChange,
          workflow: request.workflow,
          workflowVersion: request.workflowVersion,
          stage: request.stage,
          stageVersion: request.stageVersion,
          agent: request.agent,
          agentVersion: request.agentVersion,
          promptHash,
          skillHash: request.skillHash,
          toolPolicyHash,
          modelPolicyVersion: request.modelPolicy.version,
          sessionPolicyVersion: request.sessionPolicy.version,
          securityPolicyVersion: request.securityPolicy.version,
          configuredModel: request.modelPolicy.champion.model,
          resolvedModel: result.resolvedModel,
          provider: this.provider.name,
          providerResponseId: result.responseId,
          outputContractHash,
        },
        createdAt: this.#now().toISOString(),
      };
      if (!this.#workersEnabled || executionGeneration !== this.#executionGeneration) {
        const reconciling = await this.repository.markReconciliation(
          attempt.id,
          this.options.workerId,
          "runtime-disabled-before-checkpoint-acceptance",
          this.#now(),
        );
        return {
          status: "reconciling",
          reason: "runtime-disabled-before-checkpoint-acceptance",
          session,
          attempt: reconciling,
          calls,
        };
      }
      const accepted = await this.repository.acceptCheckpoint(
        checkpoint,
        this.options.workerId,
        this.#now(),
      );
      return {
        status: "accepted",
        session: (await this.repository.getSession(session.id)) ?? session,
        attempt: (await this.repository.getAttempt(attempt.id)) ?? attempt,
        checkpoint: accepted,
        calls,
      };
    }
    throw new Error("Stage repair loop ended without a terminal result");
  }

  #modelCallStart(
    id: string,
    correlationId: string,
    attempt: StageAttempt,
    session: AgentSession,
    request: StageExecutionRequest,
    createdAt: string,
  ): ModelCall {
    return {
      schemaVersion: 1,
      id,
      sequence: 0,
      attemptId: attempt.id,
      sessionId: session.id,
      provider: this.provider.name,
      configuredModel: request.modelPolicy.champion.model,
      modelPolicyVersion: request.modelPolicy.version,
      ...(session.providerConversationId
        ? { providerConversationId: session.providerConversationId }
        : {}),
      correlationId,
      status: "started",
      usage: {},
      estimatedCost: {
        status: "unpriced",
        reason: "missing-usage",
        priceScheduleId: request.priceSchedule.id,
        priceScheduleVersion: request.priceSchedule.version,
      },
      createdAt,
    };
  }

  async #executeWithLeaseRenewal<T>(
    attemptId: string,
    execute: () => Promise<T>,
  ): Promise<
    | { readonly ok: true; readonly value: T; readonly leaseMaintained: boolean }
    | { readonly ok: false; readonly error: unknown; readonly leaseMaintained: boolean }
  > {
    let leaseMaintained = true;
    let renewal = Promise.resolve();
    const intervalMilliseconds = Math.max(10, Math.floor((this.#leaseSeconds * 1_000) / 3));
    const timer = setInterval(() => {
      renewal = renewal
        .then(async () => {
          const renewed = await this.repository.renewLease(
            attemptId,
            this.options.workerId,
            this.#leaseSeconds,
            this.#now(),
          );
          if (!renewed) leaseMaintained = false;
        })
        .catch(() => {
          leaseMaintained = false;
        });
    }, intervalMilliseconds);
    timer.unref();
    let outcome:
      { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };
    try {
      outcome = { ok: true, value: await execute() };
    } catch (error) {
      outcome = { ok: false, error };
    } finally {
      clearInterval(timer);
      await renewal;
    }
    return { ...outcome, leaseMaintained };
  }

  async #verifyCheckpointArtifacts(checkpoint: AgentCheckpoint | undefined): Promise<void> {
    if (!checkpoint) return;
    for (const reference of [...checkpoint.inputArtifacts, ...checkpoint.outputArtifacts]) {
      if (!(await this.artifacts.has(reference))) {
        throw new Error(`Required checkpoint artifact ${reference.id} is missing`);
      }
    }
  }

  #sanitizeRequest(request: StageExecutionRequest): StageExecutionRequest {
    const sanitized = StageExecutionRequest.parse(redactUnknown(request, this.#secrets));
    return {
      ...sanitized,
      inputArtifacts: sanitized.inputArtifacts.map((artifact) =>
        artifact.content === undefined
          ? artifact
          : { ...artifact, sha256: hashArtifact(artifact.content) },
      ),
    };
  }
}
