import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

const requiredHeadings = [
  "## Desired outcome",
  "## Required capabilities",
  "## Existing capabilities and evidence",
  "## Alternatives and rejection reasons",
  "## Selected repository-owned boundary",
  "## Assumptions and disconfirming signals",
  "## Decision, validation, and rollback",
];

const changesRoot = resolve("openspec/changes");
const failures = [];
let checked = 0;

for (const entry of await readdir(changesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const changeRoot = resolve(changesRoot, entry.name);
  const metadataSource = await readFile(resolve(changeRoot, ".openspec.yaml"), "utf8").catch(
    () => "",
  );
  if (!metadataSource) continue;
  const metadata = YAML.parse(metadataSource);
  if (metadata.schema !== "system-change") continue;
  checked += 1;
  const premise = await readFile(resolve(changeRoot, "strategic-premise.md"), "utf8").catch(
    () => "",
  );
  if (!premise) {
    failures.push(`${entry.name}: missing strategic-premise.md`);
    continue;
  }
  for (const heading of requiredHeadings) {
    if (!premise.includes(heading)) failures.push(`${entry.name}: missing ${heading}`);
  }
}

if (!checked) failures.push("No system-change premises were checked");
if (failures.length)
  throw new Error(`Strategic premise validation failed:\n${failures.join("\n")}`);
console.log(`Strategic premises valid: ${checked} system changes`);
