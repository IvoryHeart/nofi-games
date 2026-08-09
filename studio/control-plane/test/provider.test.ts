import type { Conversation } from "openai/resources/conversations/conversations";
import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";
import { FakeAgentProvider } from "../src/fake-provider.js";
import {
  createOpenAIProvider,
  OpenAIAgentProvider,
  type OpenAIClientLike,
} from "../src/openai-provider.js";
import type { ExecutionEnvelope } from "../src/provider.js";
import { ProviderExecutionError } from "../src/provider.js";

function envelope(conversationId: string, cacheEnabled = true): ExecutionEnvelope {
  return {
    schemaVersion: 1,
    correlationId: "correlation-1",
    conversationId,
    configuredModel: "gpt-5.6-terra",
    modelPolicyVersion: "0.1.0",
    stablePrefix: "Stable role and skill prefix",
    cache: { enabled: cacheEnabled, key: "stable-prefix-hash" },
    reasoning: { effort: "medium", context: "all_turns" },
    input: { artifacts: [] },
    allowedTools: ["web-search", "evidence-store"],
    output: {
      contractId: "artifact-envelope",
      contractVersion: "0.1.0",
      schema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
        additionalProperties: false,
      },
      requiredArtifactIds: [],
      requiredEvidenceGates: [],
    },
    metadata: { run_id: "run-1" },
    maxOutputTokens: 1_000,
  };
}

function response(conversationId: string): Response {
  return {
    id: "response-1",
    conversation: { id: conversationId },
    model: "gpt-5.6-terra",
    output_text: '{"ok":true}',
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 20, cache_write_tokens: 10 },
      output_tokens: 30,
      output_tokens_details: { reasoning_tokens: 5 },
      total_tokens: 130,
    },
  } as unknown as Response;
}

function client(overrides: { executeError?: unknown } = {}): {
  client: OpenAIClientLike;
  requests: ResponseCreateParamsNonStreaming[];
} {
  const requests: ResponseCreateParamsNonStreaming[] = [];
  const conversation = {
    id: "conversation-1",
    created_at: 0,
    metadata: {},
    object: "conversation",
  } as unknown as Conversation;
  return {
    requests,
    client: {
      conversations: {
        create: async () => conversation,
        retrieve: async () => conversation,
        delete: async () => ({ deleted: true }),
      },
      responses: {
        create: async (request) => {
          requests.push(request);
          if (overrides.executeError) throw overrides.executeError;
          return response(conversation.id);
        },
        cancel: async () => response(conversation.id),
      },
    },
  };
}

describe("provider boundary", () => {
  it("blocks missing credentials before constructing a remote client", () => {
    expect(() => createOpenAIProvider(undefined)).toThrow(ProviderExecutionError);
    try {
      createOpenAIProvider(undefined);
    } catch (error) {
      expect(error).toMatchObject({ category: "credentials-missing", outcomeUncertain: false });
    }
  });

  it("uses Conversations, persisted reasoning, structured output, and an explicit cache boundary", async () => {
    const mock = client();
    const provider = new OpenAIAgentProvider(mock.client);
    const conversation = await provider.createConversation({ run_id: "run-1" });
    const result = await provider.execute(envelope(conversation.id));
    expect(result.output).toEqual({ ok: true });
    expect(result.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 20,
      cacheWriteTokens: 10,
      outputTokens: 30,
      reasoningTokens: 5,
    });
    const request = mock.requests[0];
    expect(request?.conversation).toBe(conversation.id);
    expect(request?.reasoning).toMatchObject({ effort: "medium", context: "all_turns" });
    expect(request?.text?.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request?.prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" });
    expect(request?.tools).toEqual([{ type: "web_search" }]);
    expect(JSON.stringify(request)).not.toContain("OPENAI_API_KEY");
  });

  it("matches the fake provider result boundary", async () => {
    const fake = new FakeAgentProvider([{ kind: "success", output: { ok: true } }]);
    const fakeConversation = await fake.createConversation({});
    const fakeResult = await fake.execute(envelope(fakeConversation.id, false));
    const mock = client();
    const openai = new OpenAIAgentProvider(mock.client);
    const openaiResult = await openai.execute(envelope("conversation-1", false));
    expect(Object.keys(fakeResult).sort()).toEqual(Object.keys(openaiResult).sort());
  });

  it("deletes disposable conversations through both adapters", async () => {
    const fake = new FakeAgentProvider();
    const fakeConversation = await fake.createConversation({});
    expect(await fake.deleteConversation(fakeConversation.id)).toBe(true);
    expect(await fake.conversationExists(fakeConversation.id)).toBe(false);
    const mock = client();
    const openai = new OpenAIAgentProvider(mock.client);
    expect(await openai.deleteConversation("conversation-1")).toBe(true);
  });

  it("redacts secrets and marks transport timeouts for reconciliation", async () => {
    const secret = "sk-secret-canary";
    const timeout = Object.assign(new Error(`socket timeout ${secret}`), { code: "ETIMEDOUT" });
    const mock = client({ executeError: timeout });
    const provider = new OpenAIAgentProvider(mock.client, [secret]);
    await expect(provider.execute(envelope("conversation-1"))).rejects.toMatchObject({
      category: "transport-uncertain",
      outcomeUncertain: true,
    });
    await provider.execute(envelope("conversation-1")).catch((error: unknown) => {
      expect(String(error)).not.toContain(secret);
    });
  });
});
