import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { TaskClass, WorkflowDefinition, WorkflowStage } from "../src/contracts.js";

const validStage = {
  id: "game-build",
  agent: "game-builder",
  skill: "build-godot-game",
  taskClass: "bounded-implementation",
  dependsOn: [],
  consumes: ["selected-spec"],
  produces: ["game-pack"],
  gates: ["contract-tests"],
  mutatesSource: true,
  mayPublishPreview: false,
  mayPublishProduction: false,
} as const;

const validWorkflow = {
  schemaVersion: 2,
  id: "test-workflow",
  version: "0.2.0",
  trigger: "manual",
  rollbackRequired: true,
  stages: [
    validStage,
    {
      ...validStage,
      id: "stage-two",
      taskClass: "high-judgment",
      dependsOn: ["game-build"],
      consumes: ["game-pack"],
      produces: ["evaluation-results"],
      gates: ["independent-evaluator"],
      mutatesSource: false,
    },
  ],
} as const;

const { taskClass: _taskClass, ...missingTaskClass } = validStage;
const invalidTaskClassFixtures: readonly [string, unknown][] = [
  ["missing taskClass", missingTaskClass],
  ["balanced", { ...validStage, taskClass: "balanced" }],
  ["bounded", { ...validStage, taskClass: "bounded" }],
  ["model identifier", { ...validStage, taskClass: "gpt-5.6-luna" }],
];

describe("workflow task-class contract", () => {
  it("accepts exactly both supported task classes", () => {
    expect(TaskClass.parse("bounded-implementation")).toBe("bounded-implementation");
    expect(TaskClass.parse("high-judgment")).toBe("high-judgment");
  });

  it.each(invalidTaskClassFixtures)("rejects %s", (_caseName, fixture) => {
    expect(() => WorkflowStage.parse(fixture)).toThrow();
  });

  it("rejects schema version 1 at the new workflow-definition boundary", () => {
    expect(() => WorkflowDefinition.parse({ ...validWorkflow, schemaVersion: 1 })).toThrow();
    expect(WorkflowDefinition.parse(validWorkflow).schemaVersion).toBe(2);
  });
});

const workflowFiles = [
  "research-to-game.yaml",
  "game-improvement.yaml",
  "agent-evolution.yaml",
] as const;

const expectedStageClasses = [
  ["research-to-game", "opportunity-research", "high-judgment"],
  ["research-to-game", "concept-design", "high-judgment"],
  ["research-to-game", "game-build", "bounded-implementation"],
  ["research-to-game", "independent-game-evaluation", "high-judgment"],
  ["research-to-game", "controlled-release", "bounded-implementation"],
  ["game-improvement", "gameplay-analysis", "high-judgment"],
  ["game-improvement", "experiment-build", "bounded-implementation"],
  ["game-improvement", "experiment-evaluation", "high-judgment"],
  ["game-improvement", "experiment-release", "bounded-implementation"],
  ["agent-evolution", "improvement-observation", "high-judgment"],
  ["agent-evolution", "challenger-build", "bounded-implementation"],
  ["agent-evolution", "independent-agent-evaluation", "high-judgment"],
  ["agent-evolution", "agent-canary", "bounded-implementation"],
] as const;

describe("workflow manifest task-class matrix", () => {
  it("matches the exact versioned stage matrix and challenger gate", async () => {
    const workflows = await Promise.all(
      workflowFiles.map(async (file) =>
        WorkflowDefinition.parse(
          parse(await readFile(resolve(process.cwd(), "studio/workflows", file), "utf8")),
        ),
      ),
    );

    expect(workflows).toHaveLength(3);
    expect(
      workflows.every(({ schemaVersion, version }) => schemaVersion === 2 && version === "0.2.0"),
    ).toBe(true);

    const actualStageClasses = workflows.flatMap(({ id, stages }) =>
      stages.map(({ id: stageId, taskClass }) => [id, stageId, taskClass]),
    );
    expect(actualStageClasses).toEqual(expectedStageClasses);
    expect(actualStageClasses).toHaveLength(13);

    const challenger = workflows
      .find(({ id }) => id === "agent-evolution")
      ?.stages.find(({ id }) => id === "challenger-build");
    expect(challenger?.gates).toContain("mechanically-verifiable-edit");
  });
});
