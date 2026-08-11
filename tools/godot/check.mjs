import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { godotBinary, godotEnvironment, root } from "./runtime.mjs";
import "./sync-sdk.mjs";

const godot = await godotBinary();
const env = godotEnvironment();

function run(args, label) {
  console.log(`Godot check: ${label}`);
  execFileSync(godot, args, { cwd: root, env, stdio: "inherit" });
}

run(
  ["--headless", "--import", "--path", join(root, "platform", "player-app")],
  "single player app",
);
run(
  ["--headless", "--import", "--path", join(root, "games", "fixtures", "contract-smoke")],
  "contract fixture import",
);
run(
  [
    "--headless",
    "--path",
    join(root, "games", "fixtures", "contract-smoke"),
    "--script",
    "res://tests/run_tests.gd",
  ],
  "contract fixture tests",
);
const fixtureBuilder = join(root, "tools", "godot", "build-fixture-pack.mjs");
console.log("Godot check: content-addressed clean-cache fixture export");
execFileSync(process.execPath, [fixtureBuilder], { cwd: root, stdio: "inherit" });
run(
  [
    "--headless",
    "--path",
    join(root, "platform", "player-app"),
    "--script",
    "res://tests/run_pack_loader_test.gd",
  ],
  "single-app pack loader",
);
