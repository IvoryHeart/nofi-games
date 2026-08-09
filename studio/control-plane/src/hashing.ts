import { createHash } from "node:crypto";
import { z } from "zod";
import { Identifier, Sha256 } from "./contracts.js";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

function normalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, item]) => [key, normalize(item)]));
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashArtifact(value: unknown): string {
  return sha256(canonicalJson(value));
}

export const CompatibilityInput = z.object({
  agent: Identifier,
  agentVersion: z.string().min(1),
  promptHash: Sha256,
  skillHash: Sha256,
  workflow: Identifier,
  workflowVersion: z.string().min(1),
  stage: Identifier,
  stageVersion: z.string().min(1),
  inputHashes: z.record(Identifier, Sha256),
  acceptedCheckpointHash: Sha256.optional(),
  outputContractHash: Sha256,
  toolPolicyHash: Sha256,
  modelPolicyVersion: z.string().min(1),
  sessionPolicyVersion: z.string().min(1),
  securityPolicyVersion: z.string().min(1),
});

export type CompatibilityInput = z.infer<typeof CompatibilityInput>;

export function compatibilityFingerprint(input: CompatibilityInput): string {
  return hashArtifact(CompatibilityInput.parse(input));
}

export const IdempotencyInput = CompatibilityInput.extend({
  workflowRunId: z.uuid(),
  generation: z.number().int().nonnegative(),
});

export type IdempotencyInput = z.infer<typeof IdempotencyInput>;

export function stageIdempotencyKey(input: IdempotencyInput): string {
  return hashArtifact(IdempotencyInput.parse(input));
}
