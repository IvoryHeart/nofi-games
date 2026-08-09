import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WorkflowRun } from "../src/contracts.js";
import { InMemoryRunLedger } from "../src/ledger.js";
import { currentStatus, transitionRun } from "../src/workflow.js";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function plannedRun(): WorkflowRun {
  return WorkflowRun.parse({
    schemaVersion: 1,
    id: randomUUID(),
    workflow: "research-to-game",
    workflowVersion: "0.1.0",
    gitCommit: "a".repeat(40),
    openSpecChange: "test-change",
    agentVersions: { researcher: "0.1.0" },
    modelVersions: { researcher: "test-model" },
    skillHashes: { researcher: sha("skill") },
    inputHashes: { request: sha("request") },
    outputHashes: {},
    evaluationSuiteVersion: "0.1.0",
    events: [
      {
        sequence: 0,
        status: "planned",
        at: "2026-08-09T00:00:00.000Z",
        reason: "Test setup",
      },
    ],
    evidence: [],
  });
}

describe("workflow transitions", () => {
  it("follows the evidence-gated lifecycle", () => {
    let run = plannedRun();
    run = transitionRun(run, "running", "Pinned inputs", new Date("2026-08-09T00:01:00Z"));
    run = transitionRun(run, "evaluating", "Output ready", new Date("2026-08-09T00:02:00Z"));
    run = transitionRun(run, "completed", "Evaluation passed", new Date("2026-08-09T00:03:00Z"));
    expect(currentStatus(run)).toBe("completed");
    expect(run.events.map((event) => event.sequence)).toEqual([0, 1, 2, 3]);
  });

  it("rejects an unevaluated completion", () => {
    const run = transitionRun(plannedRun(), "running", "Started");
    expect(() => transitionRun(run, "completed", "Trust me")).toThrow(
      "Invalid workflow transition",
    );
  });
});

describe("run ledger", () => {
  it("is append-only by event sequence", async () => {
    const ledger = new InMemoryRunLedger();
    const run = plannedRun();
    await ledger.append(run);
    await expect(ledger.append(run)).rejects.toThrow("must append a new event");
  });
});
