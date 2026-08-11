import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function filesBeneath(relativeDirectory) {
  const directory = resolve(repositoryRoot, relativeDirectory);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesBeneath(relative(repositoryRoot, path))));
    } else if (entry.isFile() && !entry.name.endsWith(".tsbuildinfo")) {
      files.push(relative(repositoryRoot, path));
    }
  }
  return files;
}

for (const retiredRoot of [
  "agents/skills",
  "evals",
  "studio",
  "openspec/schemas",
  "openspec/specs/evidence-ledger",
]) {
  for (const file of await filesBeneath(retiredRoot)) {
    failures.push(`retired execution file exists: ${file}`);
  }
}

for (const retiredFile of [
  "agents/registry.yaml",
  "tools/validate-evals.ts",
  "tools/validate-premises.mjs",
  "tools/validate-skills.mjs",
  "tools/validate-workflows.ts",
]) {
  try {
    await readFile(resolve(repositoryRoot, retiredFile));
    failures.push(`retired execution file exists: ${retiredFile}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const packageManifest = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
for (const script of [
  "studio:demo",
  "skills:validate",
  "premises:validate",
  "evals:validate",
  "workflows:validate",
]) {
  if (packageManifest.scripts?.[script]) failures.push(`retired package script exists: ${script}`);
}
for (const dependency of ["vitest", "yaml"]) {
  if (packageManifest.devDependencies?.[dependency] || packageManifest.dependencies?.[dependency]) {
    failures.push(`retired direct dependency exists: ${dependency}`);
  }
}

const forbiddenDatabaseNames = [
  "studio_workflow_runs",
  "studio_run_events",
  "studio_evidence",
  "studio_agent_versions",
  "studio_agent_evaluations",
  "studio_agent_sessions",
  "studio_stage_attempts",
  "studio_agent_checkpoints",
  "studio_model_calls",
  "studio_claim_stage_attempt",
  "studio_renew_stage_lease",
  "studio_accept_agent_checkpoint",
  "studio_reject_runtime_record_mutation",
  "studio-evidence",
];

for (const file of await filesBeneath("supabase/migrations")) {
  if (!file.endsWith(".sql")) continue;
  const sql = await readFile(resolve(repositoryRoot, file), "utf8");
  for (const name of forbiddenDatabaseNames) {
    if (sql.includes(name)) failures.push(`forbidden database object ${name} exists in ${file}`);
  }
}

if (failures.length) {
  throw new Error(`Studio foundation validation failed:\n${failures.join("\n")}`);
}

console.log(
  "Studio foundation valid: product substrate present without prototype execution machinery",
);
