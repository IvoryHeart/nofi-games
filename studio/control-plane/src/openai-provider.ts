import OpenAI from "openai";
import type { Conversation } from "openai/resources/conversations/conversations";
import type {
  Response,
  ResponseCreateParamsNonStreaming,
  Tool,
} from "openai/resources/responses/responses";
import { normalizeOpenAIUsage } from "./accounting.js";
import { canonicalJson } from "./hashing.js";
import type {
  AgentProvider,
  ExecutionEnvelope,
  ProviderConversation,
  ProviderResult,
} from "./provider.js";
import { ProviderExecutionError } from "./provider.js";
import { normalizeProviderError } from "./provider-errors.js";

export interface OpenAIClientLike {
  readonly conversations: {
    create(body?: { metadata?: Readonly<Record<string, string>> }): Promise<Conversation>;
    retrieve(conversationId: string): Promise<Conversation>;
    delete(conversationId: string): Promise<{ readonly deleted: boolean }>;
  };
  readonly responses: {
    create(parameters: ResponseCreateParamsNonStreaming): Promise<Response>;
    cancel(responseId: string): Promise<Response>;
  };
}

function providerTools(allowedTools: readonly string[]): Tool[] {
  const tools: Tool[] = [];
  if (allowedTools.includes("web-search")) tools.push({ type: "web_search" });
  return tools;
}

export class OpenAIAgentProvider implements AgentProvider {
  readonly name = "openai" as const;

  constructor(
    readonly client: OpenAIClientLike,
    readonly secrets: readonly string[] = [],
    readonly maximumDiagnosticCharacters = 4_000,
  ) {}

  async createConversation(
    metadata: Readonly<Record<string, string>>,
  ): Promise<ProviderConversation> {
    try {
      const conversation = await this.client.conversations.create({ metadata });
      return {
        id: conversation.id,
        createdAt: new Date(conversation.created_at * 1_000).toISOString(),
      };
    } catch (error) {
      throw normalizeProviderError(error, this.secrets, this.maximumDiagnosticCharacters);
    }
  }

  async conversationExists(conversationId: string): Promise<boolean> {
    try {
      await this.client.conversations.retrieve(conversationId);
      return true;
    } catch (error) {
      const normalized = normalizeProviderError(
        error,
        this.secrets,
        this.maximumDiagnosticCharacters,
      );
      if (normalized.category === "conversation-unavailable") return false;
      throw normalized;
    }
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const result = await this.client.conversations.delete(conversationId);
      return result.deleted;
    } catch (error) {
      const normalized = normalizeProviderError(
        error,
        this.secrets,
        this.maximumDiagnosticCharacters,
      );
      if (normalized.category === "conversation-unavailable") return false;
      throw normalized;
    }
  }

  async execute(envelope: ExecutionEnvelope): Promise<ProviderResult> {
    const started = performance.now();
    const stableContent = {
      type: "input_text" as const,
      text: envelope.stablePrefix,
      ...(envelope.cache.enabled ? { prompt_cache_breakpoint: { mode: "explicit" as const } } : {}),
    };
    const request: ResponseCreateParamsNonStreaming = {
      model: envelope.configuredModel,
      conversation: envelope.conversationId,
      input: [
        { role: "developer", content: [stableContent] },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: canonicalJson({
                input: envelope.input,
                allowedTools: envelope.allowedTools,
                requiredArtifacts: envelope.output.requiredArtifactIds,
                requiredEvidenceGates: envelope.output.requiredEvidenceGates,
              }),
            },
          ],
        },
      ],
      reasoning: {
        effort: envelope.reasoning.effort,
        context: envelope.reasoning.context,
      },
      text: {
        format: {
          type: "json_schema",
          name: envelope.output.contractId,
          description: `Version ${envelope.output.contractVersion} workflow-stage output`,
          strict: true,
          schema: envelope.output.schema,
        },
      },
      tools: providerTools(envelope.allowedTools),
      max_output_tokens: envelope.maxOutputTokens,
      metadata: envelope.metadata,
      prompt_cache_key: envelope.cache.key,
      ...(envelope.cache.enabled ? { prompt_cache_options: { mode: "explicit", ttl: "30m" } } : {}),
      store: true,
    };
    try {
      const response = await this.client.responses.create(request);
      let output: unknown = response.output_text;
      try {
        output = JSON.parse(response.output_text) as unknown;
      } catch {
        // Contract validation owns malformed output; preserve the exact text as evidence.
      }
      return {
        conversationId: response.conversation?.id ?? envelope.conversationId,
        responseId: response.id,
        resolvedModel: response.model,
        output,
        usage: normalizeOpenAIUsage(response.usage),
        latencyMilliseconds: Math.max(0, Math.round(performance.now() - started)),
      };
    } catch (error) {
      throw normalizeProviderError(error, this.secrets, this.maximumDiagnosticCharacters);
    }
  }

  async cancel(responseId: string): Promise<boolean> {
    try {
      await this.client.responses.cancel(responseId);
      return true;
    } catch (error) {
      const normalized = normalizeProviderError(
        error,
        this.secrets,
        this.maximumDiagnosticCharacters,
      );
      if (
        normalized.category === "provider-rejected" ||
        normalized.category === "conversation-unavailable"
      ) {
        return false;
      }
      throw normalized;
    }
  }
}

export function createOpenAIProvider(
  apiKey: string | undefined,
  maximumDiagnosticCharacters = 4_000,
): OpenAIAgentProvider {
  if (!apiKey) {
    throw new ProviderExecutionError(
      "OPENAI_API_KEY is not configured",
      "credentials-missing",
      false,
    );
  }
  return new OpenAIAgentProvider(
    new OpenAI({ apiKey }) as OpenAIClientLike,
    [apiKey],
    maximumDiagnosticCharacters,
  );
}
