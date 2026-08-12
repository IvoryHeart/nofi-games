import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { godotBinary, godotEnvironment, root } from "./runtime.mjs";
import "./sync-sdk.mjs";

const fixture = join(root, "games", "fixtures", "contract-smoke");
const artifact = join(root, ".artifacts", "packs", "contract-smoke-0.1.0.pck");
const candidate = join(root, "games", "candidates", "tide-ledger");
const candidateArtifact = join(root, ".artifacts", "packs", "tide-ledger-0.1.0.pck");
const bundled = join(
  root,
  "platform",
  "player-app",
  "catalog",
  "packs",
  "contract-smoke-0.1.0.pck",
);
const candidateBundled = join(
  root,
  "platform",
  "player-app",
  "catalog",
  "packs",
  "tide-ledger-0.1.0.pck",
);
await rm(join(fixture, ".godot"), { recursive: true, force: true });
await mkdir(dirname(artifact), { recursive: true });
await mkdir(dirname(bundled), { recursive: true });

const godot = await godotBinary();
execFileSync(godot, ["--headless", "--path", fixture, "--export-pack", "Web Pack", artifact], {
  env: godotEnvironment(),
  stdio: "inherit",
});
await cp(artifact, bundled);
await mkdir(dirname(candidateArtifact), { recursive: true });
await mkdir(dirname(candidateBundled), { recursive: true });
execFileSync(
  godot,
  ["--headless", "--path", candidate, "--export-pack", "Web Pack", candidateArtifact],
  { env: godotEnvironment(), stdio: "inherit" },
);
await cp(candidateArtifact, candidateBundled);
const hash = createHash("sha256")
  .update(await readFile(artifact))
  .digest("hex");
const candidateHash = createHash("sha256")
  .update(await readFile(candidateArtifact))
  .digest("hex");
const manifest = JSON.parse(await readFile(join(fixture, "game-pack.json"), "utf8"));
const candidateManifest = JSON.parse(await readFile(join(candidate, "game-pack.json"), "utf8"));
const catalog = {
  schemaVersion: 1,
  generatedAt: "2026-08-11T00:00:00.000Z",
  entries: [
    {
      ...manifest,
      packUrl: "https://invalid.local/fixtures/contract-smoke-0.1.0.pck",
      localPackPath: "res://catalog/packs/contract-smoke-0.1.0.pck",
      packSha256: hash,
      rolloutBasisPoints: 0,
      status: "fixture",
    },
    {
      ...candidateManifest,
      packUrl: "https://invalid.local/candidates/tide-ledger-0.1.0.pck",
      localPackPath: "res://catalog/packs/tide-ledger-0.1.0.pck",
      packSha256: candidateHash,
      rolloutBasisPoints: 10_000,
      status: "candidate",
    },
  ],
};
await writeFile(
  join(root, "platform", "player-app", "catalog", "catalog.generated.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
);
console.log(`Built hidden contract fixture ${hash}`);
console.log(`Built discoverable Tide Ledger candidate ${candidateHash}`);
