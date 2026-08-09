const defaultSecretNamePatterns = [
  /(?:^|_)(?:api_?)?key$/i,
  /secret/i,
  /token/i,
  /password/i,
  /private/i,
  /service_role/i,
];

export function collectSecretValues(
  environment: Readonly<Record<string, string | undefined>>,
  patterns: readonly RegExp[] = defaultSecretNamePatterns,
): readonly string[] {
  return [
    ...new Set(
      Object.entries(environment)
        .filter(
          ([name, value]) =>
            value !== undefined &&
            value.length >= 4 &&
            patterns.some((pattern) => pattern.test(name)),
        )
        .map(([, value]) => value as string),
    ),
  ].sort((left, right) => right.length - left.length);
}

function encodings(secret: string): readonly string[] {
  return [...new Set([secret, encodeURIComponent(secret), Buffer.from(secret).toString("base64")])]
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);
}

export function redactString(
  value: string,
  secrets: readonly string[],
  replacement = "[REDACTED]",
): string {
  let redacted = value;
  const candidates = [...new Set(secrets.flatMap(encodings))].sort(
    (left, right) => right.length - left.length,
  );
  for (const candidate of candidates) redacted = redacted.split(candidate).join(replacement);
  return redacted;
}

export function redactUnknown(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, secrets));
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, secrets),
      ...(value.cause === undefined ? {} : { cause: redactUnknown(value.cause, secrets) }),
    };
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactUnknown(item, secrets)]),
    );
  }
  return value;
}
