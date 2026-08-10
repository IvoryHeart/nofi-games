import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { AgentDefinition, AgentRegistry, StageExecutionPolicy } from "../src/contracts.js";

const validPolicy = {
  mode: "decision-sufficient",
  decisiveOutcome: "stop-and-report",
  unavailableGate: "record-unmet",
  retryLimit: 1,
} as const;

describe("decision-efficient execution contract", () => {
  it("accepts only the bounded stage policy", () => {
    expect(StageExecutionPolicy.parse(validPolicy)).toEqual(validPolicy);
    expect(() => StageExecutionPolicy.parse({ ...validPolicy, mode: "exhaustive" })).toThrow();
    expect(() =>
      StageExecutionPolicy.parse({ ...validPolicy, decisiveOutcome: "continue" }),
    ).toThrow();
    expect(() =>
      StageExecutionPolicy.parse({ ...validPolicy, unavailableGate: "simulate" }),
    ).toThrow();
    expect(() => StageExecutionPolicy.parse({ ...validPolicy, retryLimit: 3 })).toThrow();
    expect(() => StageExecutionPolicy.parse({ ...validPolicy, tokenBudget: 1_000_000 })).toThrow();
  });

  it("requires the policy on every versioned agent", async () => {
    const registry = AgentRegistry.parse(parse(await readFile("agents/registry.yaml", "utf8")));
    expect(registry.schemaVersion).toBe(2);
    expect(registry.agents).toHaveLength(8);
    expect(registry.agents.every(({ version }) => version === "0.2.0")).toBe(true);
    expect(
      registry.agents.every(({ executionPolicy }) => executionPolicy === "decision-sufficient-v1"),
    ).toBe(true);
  });

  it("rejects an agent that omits or renames the policy", () => {
    const validAgent = {
      schemaVersion: 2,
      id: "test-agent",
      version: "0.2.0",
      purpose: "Exercise the decision-efficient execution contract.",
      skill: "evaluate-game",
      allowedTools: ["filesystem"],
      evaluationSuite: "agent-core",
      executionPolicy: "decision-sufficient-v1",
      mayPromoteSelf: false,
    } as const;
    expect(AgentDefinition.parse(validAgent)).toEqual(validAgent);
    const { executionPolicy: _executionPolicy, ...missing } = validAgent;
    expect(() => AgentDefinition.parse(missing)).toThrow();
    expect(() =>
      AgentDefinition.parse({ ...validAgent, executionPolicy: "exhaustive-v1" }),
    ).toThrow();
    expect(() => AgentDefinition.parse({ ...validAgent, modelRouter: "automatic" })).toThrow();
  });
});
