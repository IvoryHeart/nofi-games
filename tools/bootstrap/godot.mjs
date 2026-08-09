import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const version = "4.7.1";
const release = `${version}-stable`;
const toolsRoot = join(root, ".tools", "godot");
const installRoot = join(toolsRoot, version);
const downloadsRoot = join(toolsRoot, "downloads");
const localBinary = join(installRoot, process.platform === "darwin" ? "godot.app" : "godot");
const templatesRoot = join(toolsRoot, "data", "godot", "export_templates", `${version}.stable`);

const artifacts = {
  linux: {
    name: `Godot_v${release}_linux.x86_64.zip`,
    sha512:
      "4ccdab7a48eeccbe8819a2fc1f6262f8d72065d98601bcb3743fcbd7ebd39f373758a788ee3293a05ec5b2c48538266c437404312e372225cd2df273945a2de9",
  },
  darwin: {
    name: `Godot_v${release}_macos.universal.zip`,
    sha512:
      "a5c6443e193829de9a3237b57ef5e01c23839888900e241543da0dd4bac1050125e19469f0cca9a9958ac346070d98cab8e5d6aee16b181c6d06cda86bd07224",
  },
};

const templates = {
  name: `Godot_v${release}_export_templates.tpz`,
  sha512:
    "afcc83d8d3d298038f19c58744a0d660fa75dd4baa33cb55d1011bb2565a2a8c2381728924564cb909e37c205a23f21b521b23bd057993afd43ae4da0b2f9d47",
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha512(path) {
  const data = await import("node:fs/promises").then(({ readFile }) => readFile(path));
  return createHash("sha512").update(data).digest("hex");
}

async function download(artifact) {
  await mkdir(downloadsRoot, { recursive: true });
  const destination = join(downloadsRoot, artifact.name);
  if (await exists(destination)) {
    if ((await sha512(destination)) === artifact.sha512) return destination;
    await rm(destination);
  }

  const url = `https://github.com/godotengine/godot/releases/download/${release}/${artifact.name}`;
  console.log(`Downloading ${artifact.name}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Godot download failed: ${response.status} ${response.statusText}`);
  }
  await finished(Readable.fromWeb(response.body).pipe(createWriteStream(destination)));
  const actual = await sha512(destination);
  if (actual !== artifact.sha512) {
    await rm(destination);
    throw new Error(`Checksum mismatch for ${artifact.name}`);
  }
  return destination;
}

async function installBinary() {
  if (await exists(localBinary)) return;
  const artifact = artifacts[process.platform];
  if (!artifact) throw new Error(`Unsupported bootstrap platform: ${process.platform}`);
  const archive = await download(artifact);
  const staging = join(toolsRoot, `staging-${version}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  execFileSync("unzip", ["-q", "-o", archive, "-d", staging], { stdio: "inherit" });
  await mkdir(installRoot, { recursive: true });

  if (process.platform === "darwin") {
    await rename(join(staging, "Godot.app"), localBinary);
  } else {
    const entries = await readdir(staging);
    const extracted = entries.find((name) => name.startsWith("Godot_v") && !name.endsWith(".zip"));
    if (!extracted) throw new Error("Godot executable was not found in the archive");
    await rename(join(staging, extracted), localBinary);
    await chmod(localBinary, 0o755);
  }
  await rm(staging, { recursive: true, force: true });
}

async function installTemplates() {
  if (await exists(join(templatesRoot, "web_release.zip"))) return;
  const archive = await download(templates);
  const staging = join(toolsRoot, `template-staging-${version}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  execFileSync("unzip", ["-q", "-o", archive, "-d", staging], { stdio: "inherit" });
  await rm(templatesRoot, { recursive: true, force: true });
  await mkdir(dirname(templatesRoot), { recursive: true });
  await cp(join(staging, "templates"), templatesRoot, { recursive: true });
  await rm(staging, { recursive: true, force: true });
}

await installBinary();
await installTemplates();
console.log(`Godot ${version} ready at ${localBinary}`);
