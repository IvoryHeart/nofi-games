import type { EstimatedCost, PriceSchedule, ProviderUsage } from "./runtime-contracts.js";

type OpenAIUsageShape =
  | {
      readonly input_tokens?: unknown;
      readonly output_tokens?: unknown;
      readonly input_tokens_details?: {
        readonly cached_tokens?: unknown;
        readonly cache_write_tokens?: unknown;
      } | null;
      readonly output_tokens_details?: { readonly reasoning_tokens?: unknown } | null;
    }
  | null
  | undefined;

const token = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;

export function normalizeOpenAIUsage(usage: OpenAIUsageShape): ProviderUsage {
  return {
    inputTokens: token(usage?.input_tokens),
    cachedInputTokens: token(usage?.input_tokens_details?.cached_tokens),
    cacheWriteTokens: token(usage?.input_tokens_details?.cache_write_tokens),
    outputTokens: token(usage?.output_tokens),
    reasoningTokens: token(usage?.output_tokens_details?.reasoning_tokens),
  };
}

function roundedMicrousd(numerator: bigint): number {
  const value = (numerator + 500_000n) / 1_000_000n;
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Estimated cost exceeds safe integer range");
  return Number(value);
}

export function estimateModelCost(
  model: string,
  usage: ProviderUsage,
  schedule: PriceSchedule,
): EstimatedCost {
  const rate = schedule.models[model];
  if (!rate) {
    return {
      status: "unpriced",
      reason: "unknown-model",
      priceScheduleId: schedule.id,
      priceScheduleVersion: schedule.version,
    };
  }
  const { inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens } = usage;
  if (
    inputTokens === undefined ||
    cachedInputTokens === undefined ||
    outputTokens === undefined ||
    (rate.cacheWriteMicrousdPerMillion !== undefined && cacheWriteTokens === undefined)
  ) {
    return {
      status: "unpriced",
      reason: "missing-usage",
      priceScheduleId: schedule.id,
      priceScheduleVersion: schedule.version,
    };
  }
  const writes = cacheWriteTokens ?? 0;
  const uncached = inputTokens - cachedInputTokens - writes;
  if (uncached < 0) {
    return {
      status: "unpriced",
      reason: "missing-usage",
      priceScheduleId: schedule.id,
      priceScheduleVersion: schedule.version,
    };
  }
  const longContext = rate.longContext;
  const long = longContext !== undefined && inputTokens > longContext.aboveInputTokens;
  const inputMultiplier = BigInt(long ? longContext.inputMultiplierBasisPoints : 10_000);
  const outputMultiplier = BigInt(long ? longContext.outputMultiplierBasisPoints : 10_000);
  const inputNumerator =
    (BigInt(uncached) * BigInt(rate.inputMicrousdPerMillion) +
      BigInt(cachedInputTokens) * BigInt(rate.cachedInputMicrousdPerMillion) +
      BigInt(writes) * BigInt(rate.cacheWriteMicrousdPerMillion ?? rate.inputMicrousdPerMillion)) *
    inputMultiplier;
  const outputNumerator =
    BigInt(outputTokens) * BigInt(rate.outputMicrousdPerMillion) * outputMultiplier;
  return {
    status: "priced",
    microusd: roundedMicrousd((inputNumerator + outputNumerator) / 10_000n),
    priceScheduleId: schedule.id,
    priceScheduleVersion: schedule.version,
  };
}
