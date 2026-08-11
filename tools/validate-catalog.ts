import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Catalog } from "./catalog-contract.js";

const generated = resolve("platform/player-app/catalog/catalog.generated.json");
const base = resolve("platform/player-app/catalog/catalog.base.json");
const path = await access(generated).then(
  () => generated,
  () => base,
);
const catalog = Catalog.parse(JSON.parse(await readFile(path, "utf8")));
const identities = new Set<string>();
for (const entry of catalog.entries) {
  const identity = `${entry.id}@${entry.version}`;
  if (identities.has(identity)) throw new Error(`Duplicate catalog identity: ${identity}`);
  identities.add(identity);
  if (entry.status === "fixture" && entry.discoverable) {
    throw new Error(`Fixture cannot be discoverable: ${identity}`);
  }
}
console.log(`Catalog valid: ${catalog.entries.length} entries (${path})`);
