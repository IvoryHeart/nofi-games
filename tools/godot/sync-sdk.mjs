import { access, cp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./runtime.mjs";

const source = join(root, "platform", "godot-sdk", "addons", "nofi_sdk");
const projects = [join(root, "platform", "player-app")];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const group of ["fixtures", "candidates", "promoted"]) {
  const groupPath = join(root, "games", group);
  if (!(await exists(groupPath))) continue;
  for (const entry of await readdir(groupPath, { withFileTypes: true })) {
    if (entry.isDirectory() && (await exists(join(groupPath, entry.name, "project.godot")))) {
      projects.push(join(groupPath, entry.name));
    }
  }
}

for (const project of projects) {
  const destination = join(project, "addons", "nofi_sdk");
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
  console.log(`Synced SDK -> ${project}`);
}
