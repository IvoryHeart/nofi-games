import { createHash, randomUUID } from "node:crypto";
import { WorkflowRun } from "./contracts.js";
import { InMemoryRunLedger } from "./ledger.js";
import { transitionRun } from "./workflow.js";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const now = new Date().toISOString();

let run = WorkflowRun.parse({
  schemaVersion: 1,
  id: randomUUID(),
  workflow: "research-to-game",
  workflowVersion: "0.1.0",
  gitCommit: "0".repeat(40),
  openSpecChange: "scaffold-demo",
  agentVersions: { researcher: "0.1.0" },
  modelVersions: { researcher: "unconfigured" },
  skillHashes: { researcher: hash("research-game-opportunities@0.1.0") },
  inputHashes: { request: hash("discover an opportunity") },
  outputHashes: {},
  evaluationSuiteVersion: "0.1.0",
  events: [{ sequence: 0, status: "planned", at: now, reason: "Demo created" }],
  evidence: [],
});

const ledger = new InMemoryRunLedger();
await ledger.append(run);
run = transitionRun(run, "running", "Inputs and versions are pinned");
await ledger.append(run);
run = transitionRun(run, "evaluating", "Research brief produced");
await ledger.append(run);
run = transitionRun(run, "completed", "Contract demonstration passed");
await ledger.append(run);

console.log(JSON.stringify(await ledger.get(run.id), null, 2));
