import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { z } from "zod";
import {
  ModelPolicy,
  OutputContractDefinition,
  PriceSchedule,
  SecurityPolicy,
  SessionPolicy,
} from "./runtime-contracts.js";

async function loadDirectory<T>(directory: string, schema: z.ZodType<T>): Promise<readonly T[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"));
  return Promise.all(
    files
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) =>
        schema.parse(parse(await readFile(resolve(directory, entry.name), "utf8"))),
      ),
  );
}

function uniqueById<T extends { id: string }>(
  items: readonly T[],
  kind: string,
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    if (result.has(item.id)) throw new Error(`Duplicate ${kind} policy ${item.id}`);
    result.set(item.id, item);
  }
  return result;
}

export interface RuntimePolicies {
  readonly models: ReadonlyMap<string, ModelPolicy>;
  readonly sessions: ReadonlyMap<string, SessionPolicy>;
  readonly security: ReadonlyMap<string, SecurityPolicy>;
  readonly pricing: ReadonlyMap<string, PriceSchedule>;
  readonly outputContracts: ReadonlyMap<string, OutputContractDefinition>;
}

export async function loadRuntimePolicies(root = process.cwd()): Promise<RuntimePolicies> {
  const policyRoot = resolve(root, "studio", "policies");
  const [models, sessions, security, pricing, outputContracts] = await Promise.all([
    loadDirectory(resolve(policyRoot, "model-routing"), ModelPolicy),
    loadDirectory(resolve(policyRoot, "session"), SessionPolicy),
    loadDirectory(resolve(policyRoot, "security"), SecurityPolicy),
    loadDirectory(resolve(policyRoot, "pricing"), PriceSchedule),
    loadDirectory(resolve(root, "studio", "output-contracts"), OutputContractDefinition),
  ]);
  return {
    models: uniqueById(models, "model"),
    sessions: uniqueById(sessions, "session"),
    security: uniqueById(security, "security"),
    pricing: uniqueById(pricing, "pricing"),
    outputContracts: uniqueById(outputContracts, "output contract"),
  };
}
