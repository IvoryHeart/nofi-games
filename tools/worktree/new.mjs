import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rawArguments = process.argv.slice(2);
const [targetArgument, branch] = rawArguments[0] === "--" ? rawArguments.slice(1) : rawArguments;

if (!targetArgument || !branch) {
  console.error("Usage: pnpm worktree:new -- <sibling-path> agent/<harness>/<change>/<task>");
  process.exit(2);
}

const target = resolve(root, targetArgument);
if (dirname(target) !== dirname(root)) {
  throw new Error(`Worktree must be a sibling of ${root}: ${target}`);
}
if (!/^agent\/(codex|claude-code)\/[^/]+\/[^/]+$/.test(branch)) {
  throw new Error(`Invalid agent worktree branch: ${branch}`);
}

execFileSync("git", ["worktree", "add", "-b", branch, target], {
  cwd: root,
  stdio: "inherit",
});

try {
  execFileSync("corepack", ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"], {
    cwd: target,
    stdio: "inherit",
  });
} catch (error) {
  console.error(`Dependency setup failed; the worktree remains at ${target} for inspection.`);
  throw error;
}

console.log(`Worktree ready at ${target}`);
