import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { godotBinary, godotEnvironment, root } from "./runtime.mjs";
import "./sync-sdk.mjs";

execFileSync(process.execPath, [join(root, "tools", "godot", "build-fixture-pack.mjs")], {
  cwd: root,
  stdio: "inherit",
});

const output = join(root, "dist", "player");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const godot = await godotBinary();
execFileSync(
  godot,
  [
    "--headless",
    "--path",
    join(root, "platform", "player-app"),
    "--export-release",
    "Web",
    join(output, "index.html"),
  ],
  { env: godotEnvironment(), stdio: "inherit" },
);
