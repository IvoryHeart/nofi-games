import { z } from "zod";
import { Identifier, Sha256 } from "./contracts.js";
import { CheckpointState, ProviderUsage } from "./runtime-contracts.js";

export const ExecutionEnvelope = z.object({
  schemaVersion: z.literal(1),
  correlationId: z.string().min(1),
  conversationId: z.string().min(1),
  configuredModel: z.string().min(1),
  modelPolicyVersion: z.string().min(1),
  stablePrefix: z.string().min(1),
  cache: z.object({
    enabled: z.boolean(),
    key: z.string().min(1),
  }),
  reasoning: z.object({
    effort: z.enum(["none", "low", "medium", "high", "xhigh"]),
    context: z.enum(["current_turn", "all_turns"]),
  }),
  input: z.object({
    artifacts: z.array(
      z.object({
        id: Identifier,
        uri: z.string().min(1),
        sha256: Sha256,
        content: z.unknown().optional(),
      }),
    ),
    checkpoint: CheckpointState.optional(),
  }),
  allowedTools: z.array(Identifier),
  output: z.object({
    contractId: Identifier,
    contractVersion: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
    requiredArtifactIds: z.array(Identifier),
    requiredEvidenceGates: z.array(Identifier),
  }),
  metadata: z.record(z.string(), z.string()),
  maxOutputTokens: z.number().int().positive(),
});

export type ExecutionEnvelope = z.infer<typeof ExecutionEnvelope>;

export interface ProviderConversation {
  readonly id: string;
  readonly createdAt: string;
}

export interface ProviderResult {
  readonly conversationId: string;
  readonly responseId: string;
  readonly resolvedModel: string;
  readonly output: unknown;
  readonly usage: ProviderUsage;
  readonly latencyMilliseconds: number;
}

export type ProviderErrorCategory =
  | "credentials-missing"
  | "authentication"
  | "conversation-unavailable"
  | "cancelled"
  | "provider-rejected"
  | "transport-uncertain";

export class ProviderExecutionError extends Error {
  constructor(
    message: string,
    readonly category: ProviderErrorCategory,
    readonly outcomeUncertain: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProviderExecutionError";
  }
}

export interface AgentProvider {
  readonly name: "fake" | "openai";
  createConversation(metadata: Readonly<Record<string, string>>): Promise<ProviderConversation>;
  conversationExists(conversationId: string): Promise<boolean>;
  deleteConversation(conversationId: string): Promise<boolean>;
  execute(envelope: ExecutionEnvelope): Promise<ProviderResult>;
  cancel(responseId: string): Promise<boolean>;
}
