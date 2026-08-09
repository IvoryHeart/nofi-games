import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { godotBinary, godotEnvironment, root } from "./runtime.mjs";
import "./sync-sdk.mjs";

const gameId = process.argv[2];
if (!gameId) throw new Error("Usage: pnpm game:test -- <game-id>");

let project;
for (const group of ["fixtures", "candidates", "promoted"]) {
  const candidate = join(root, "games", group, gameId);
  try {
    await access(join(candidate, "project.godot"));
    project = candidate;
    break;
  } catch {}
}
if (!project) throw new Error(`Unknown game: ${gameId}`);

const godot = await godotBinary();
execFileSync(godot, ["--headless", "--import", "--path", project], {
  env: godotEnvironment(),
  stdio: "inherit",
});
try {
  await access(join(project, "tests", "run_tests.gd"));
  execFileSync(godot, ["--headless", "--path", project, "--script", "res://tests/run_tests.gd"], {
    env: godotEnvironment(),
    stdio: "inherit",
  });
} catch (error) {
  if (error.code === "ENOENT") throw new Error(`Game has no headless test runner: ${gameId}`);
  throw error;
}
