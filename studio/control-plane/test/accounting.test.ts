import { describe, expect, it } from "vitest";
import { estimateModelCost, normalizeOpenAIUsage } from "../src/accounting.js";
import { loadRuntimePolicies } from "../src/policies.js";

describe("model usage and pricing", () => {
  it("preserves complete and unavailable provider categories", () => {
    expect(
      normalizeOpenAIUsage({
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 20, cache_write_tokens: 10 },
        output_tokens: 30,
        output_tokens_details: { reasoning_tokens: 5 },
      }),
    ).toEqual({
      inputTokens: 100,
      cachedInputTokens: 20,
      cacheWriteTokens: 10,
      outputTokens: 30,
      reasoningTokens: 5,
    });
    expect(normalizeOpenAIUsage({ input_tokens: 10 })).toEqual({
      inputTokens: 10,
      cachedInputTokens: undefined,
      cacheWriteTokens: undefined,
      outputTokens: undefined,
      reasoningTokens: undefined,
    });
  });

  it("prices uncached, cached, cache-write, and output tokens in integer micro-USD", async () => {
    const schedule = (await loadRuntimePolicies()).pricing.get("openai-2026-08-09");
    if (!schedule) throw new Error("Pricing fixture missing");
    expect(
      estimateModelCost(
        "gpt-5.6-terra",
        {
          inputTokens: 200_000,
          cachedInputTokens: 20_000,
          cacheWriteTokens: 20_000,
          outputTokens: 20_000,
          reasoningTokens: 4_000,
        },
        schedule,
      ),
    ).toEqual({
      status: "priced",
      microusd: 767_500,
      priceScheduleId: "openai-2026-08-09",
      priceScheduleVersion: "0.1.0",
    });
  });

  it("applies the pinned long-context discontinuity and refuses unknowns", async () => {
    const schedule = (await loadRuntimePolicies()).pricing.get("openai-2026-08-09");
    if (!schedule) throw new Error("Pricing fixture missing");
    expect(
      estimateModelCost(
        "gpt-5.6-terra",
        {
          inputTokens: 300_000,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: 10_000,
        },
        schedule,
      ),
    ).toMatchObject({ status: "priced", microusd: 1_725_000 });
    expect(estimateModelCost("unknown", {}, schedule)).toMatchObject({
      status: "unpriced",
      reason: "unknown-model",
    });
    expect(estimateModelCost("gpt-5.6-terra", { inputTokens: 10 }, schedule)).toMatchObject({
      status: "unpriced",
      reason: "missing-usage",
    });
  });
});
