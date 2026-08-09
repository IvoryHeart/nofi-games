import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { godotBinary, godotEnvironment, root } from "./runtime.mjs";
import "./sync-sdk.mjs";

const fixture = join(root, "games", "fixtures", "contract-smoke");
const artifact = join(root, ".artifacts", "packs", "contract-smoke-0.1.0.pck");
const bundled = join(
  root,
  "platform",
  "player-app",
  "catalog",
  "packs",
  "contract-smoke-0.1.0.pck",
);
await mkdir(dirname(artifact), { recursive: true });
await mkdir(dirname(bundled), { recursive: true });

const godot = await godotBinary();
execFileSync(godot, ["--headless", "--path", fixture, "--export-pack", "Web Pack", artifact], {
  env: godotEnvironment(),
  stdio: "inherit",
});
await cp(artifact, bundled);
const hash = createHash("sha256")
  .update(await readFile(artifact))
  .digest("hex");
const manifest = JSON.parse(await readFile(join(fixture, "game-pack.json"), "utf8"));
const catalog = {
  schemaVersion: 1,
  generatedAt: "2026-08-09T00:00:00.000Z",
  entries: [
    {
      ...manifest,
      packUrl: "https://invalid.local/fixtures/contract-smoke-0.1.0.pck",
      localPackPath: "res://catalog/packs/contract-smoke-0.1.0.pck",
      packSha256: hash,
      rolloutBasisPoints: 0,
      status: "fixture",
    },
  ],
};
await writeFile(
  join(root, "platform", "player-app", "catalog", "catalog.generated.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
);
console.log(`Built hidden contract fixture ${hash}`);
