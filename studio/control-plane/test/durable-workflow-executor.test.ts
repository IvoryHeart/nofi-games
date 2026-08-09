import { describe, expect, it } from "vitest";
import { WorkflowDefinition } from "../src/contracts.js";
import { runnableWorkflowStages } from "../src/durable-workflow-executor.js";

const baseStage = {
  agent: "researcher",
  skill: "research-game-opportunities",
  consumes: ["research-question"],
  produces: ["market-brief"],
  gates: ["source-provenance"],
  modelPolicy: "terra-champion",
  sessionPolicy: "bounded-workstream",
  securityPolicy: "studio-redaction",
  outputContract: "artifact-envelope",
  workstreamBoundary: "new" as const,
  mutatesSource: false,
  mayPublishPreview: false,
  mayPublishProduction: false,
};

const workflow = WorkflowDefinition.parse({
  schemaVersion: 1,
  id: "two-stage",
  version: "0.1.0",
  trigger: "manual",
  rollbackRequired: true,
  stages: [
    { ...baseStage, id: "research", dependsOn: [] },
    {
      ...baseStage,
      id: "design",
      agent: "game-designer",
      skill: "design-game-concept",
      dependsOn: ["research"],
      consumes: ["market-brief"],
      produces: ["selected-spec"],
    },
  ],
});

describe("durable workflow dependencies", () => {
  it("unlocks only from accepted dependencies and never schedules a completed stage", () => {
    expect(runnableWorkflowStages(workflow, new Set()).map((stage) => stage.id)).toEqual([
      "research",
    ]);
    expect(
      runnableWorkflowStages(workflow, new Set(["research"])).map((stage) => stage.id),
    ).toEqual(["design"]);
    expect(runnableWorkflowStages(workflow, new Set(["research", "design"]))).toEqual([]);
  });
});
