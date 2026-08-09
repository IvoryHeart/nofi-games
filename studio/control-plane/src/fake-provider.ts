import type {
  AgentProvider,
  ExecutionEnvelope,
  ProviderConversation,
  ProviderResult,
} from "./provider.js";
import { ProviderExecutionError } from "./provider.js";
import type { ProviderUsage } from "./runtime-contracts.js";

export type FakeProviderBehavior =
  | {
      readonly kind: "success";
      readonly output: unknown;
      readonly usage?: ProviderUsage;
      readonly delayMilliseconds?: number;
    }
  | { readonly kind: "malformed"; readonly output?: string }
  | { readonly kind: "conversation-loss" }
  | { readonly kind: "timeout-after-acceptance" }
  | { readonly kind: "authentication-failure" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "partial-usage"; readonly output: unknown };

export class FakeAgentProvider implements AgentProvider {
  readonly name = "fake" as const;
  readonly calls: ExecutionEnvelope[] = [];
  readonly #conversations = new Set<string>();
  readonly #behaviors: FakeProviderBehavior[];
  #conversationSequence = 0;
  #responseSequence = 0;

  constructor(
    behaviors: readonly FakeProviderBehavior[] = [],
    readonly idPrefix = "fake",
  ) {
    this.#behaviors = [...behaviors];
  }

  async createConversation(
    _metadata: Readonly<Record<string, string>> = {},
  ): Promise<ProviderConversation> {
    const id = `${this.idPrefix}-conversation-${++this.#conversationSequence}`;
    this.#conversations.add(id);
    return { id, createdAt: new Date(0).toISOString() };
  }

  async conversationExists(conversationId: string): Promise<boolean> {
    return this.#conversations.has(conversationId);
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    return this.#conversations.delete(conversationId);
  }

  loseConversation(conversationId: string): void {
    this.#conversations.delete(conversationId);
  }

  async execute(envelope: ExecutionEnvelope): Promise<ProviderResult> {
    if (!this.#conversations.has(envelope.conversationId)) {
      throw new ProviderExecutionError(
        "Provider conversation is unavailable",
        "conversation-unavailable",
        false,
      );
    }
    this.calls.push(structuredClone(envelope));
    const behavior = this.#behaviors.shift() ?? {
      kind: "success",
      output: {
        artifacts: [],
        evidence: [],
        gates: [],
        checkpoint: {
          conclusions: [],
          assumptions: [],
          unresolvedQuestions: [],
          nextAction: "continue",
        },
      },
    };
    if (behavior.kind === "conversation-loss") {
      this.loseConversation(envelope.conversationId);
      throw new ProviderExecutionError(
        "Provider conversation is unavailable",
        "conversation-unavailable",
        false,
      );
    }
    if (behavior.kind === "timeout-after-acceptance") {
      throw new ProviderExecutionError(
        "Provider request outcome is unknown",
        "transport-uncertain",
        true,
      );
    }
    if (behavior.kind === "authentication-failure") {
      throw new ProviderExecutionError("Provider authentication failed", "authentication", false);
    }
    if (behavior.kind === "cancelled") {
      throw new ProviderExecutionError("Provider request was cancelled", "cancelled", false);
    }
    if (behavior.kind === "success" && behavior.delayMilliseconds) {
      await new Promise<void>((resolve) => setTimeout(resolve, behavior.delayMilliseconds));
    }
    const output =
      behavior.kind === "malformed" ? (behavior.output ?? "{not-json") : behavior.output;
    const usage: ProviderUsage =
      behavior.kind === "partial-usage"
        ? { inputTokens: 10 }
        : behavior.kind === "success" && behavior.usage
          ? behavior.usage
          : {
              inputTokens: 100,
              cachedInputTokens: 0,
              cacheWriteTokens: 0,
              outputTokens: 20,
              reasoningTokens: 5,
            };
    return {
      conversationId: envelope.conversationId,
      responseId: `${this.idPrefix}-response-${++this.#responseSequence}`,
      resolvedModel:
        envelope.configuredModel === "gpt-5.6-terra" ? "gpt-5.6-terra" : envelope.configuredModel,
      output,
      usage,
      latencyMilliseconds: 1,
    };
  }

  async cancel(): Promise<boolean> {
    return true;
  }
}
