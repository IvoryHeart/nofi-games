import { ProviderExecutionError } from "./provider.js";
import { redactString } from "./redaction.js";

type ErrorShape = {
  readonly name?: unknown;
  readonly message?: unknown;
  readonly status?: unknown;
  readonly code?: unknown;
};

export function normalizeProviderError(
  error: unknown,
  secrets: readonly string[],
  maximumCharacters = 4_000,
): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) {
    return new ProviderExecutionError(
      redactString(error.message, secrets).slice(0, maximumCharacters),
      error.category,
      error.outcomeUncertain,
      { cause: error },
    );
  }
  const shape = error as ErrorShape;
  const status = typeof shape?.status === "number" ? shape.status : undefined;
  const code = typeof shape?.code === "string" ? shape.code : "";
  const name = typeof shape?.name === "string" ? shape.name : "";
  const rawMessage = typeof shape?.message === "string" ? shape.message : "Provider request failed";
  const message = redactString(rawMessage, secrets).slice(0, maximumCharacters);
  if (status === 401 || status === 403) {
    return new ProviderExecutionError(message, "authentication", false, { cause: error });
  }
  if (status === 404 && /conversation/i.test(rawMessage)) {
    return new ProviderExecutionError(message, "conversation-unavailable", false, { cause: error });
  }
  const transportUncertain =
    status === undefined &&
    (/timeout|connection|socket|network/i.test(`${name} ${code} ${rawMessage}`) ||
      ["ETIMEDOUT", "ECONNRESET", "ECONNABORTED"].includes(code));
  if (transportUncertain || (status !== undefined && status >= 500)) {
    return new ProviderExecutionError(message, "transport-uncertain", true, { cause: error });
  }
  if (/abort|cancel/i.test(`${name} ${code}`)) {
    return new ProviderExecutionError(message, "cancelled", false, { cause: error });
  }
  return new ProviderExecutionError(message, "provider-rejected", false, { cause: error });
}
