import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localRoot = join(root, ".tools", "godot", "4.7.1");
const platformBinary =
  process.platform === "darwin"
    ? join(localRoot, "godot.app", "Contents", "MacOS", "Godot")
    : join(localRoot, "godot");

export async function godotBinary() {
  const binary = process.env.GODOT_BIN || platformBinary;
  try {
    await access(binary);
  } catch {
    throw new Error(`Godot is unavailable at ${binary}. Run pnpm bootstrap first.`);
  }
  return binary;
}

export function godotEnvironment() {
  return {
    ...process.env,
    XDG_DATA_HOME: join(root, ".tools", "godot", "data"),
    XDG_CONFIG_HOME: join(root, ".tools", "godot", "config"),
    XDG_CACHE_HOME: join(root, ".tools", "godot", "cache"),
  };
}
