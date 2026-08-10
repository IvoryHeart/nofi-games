import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  AcceptanceDecision,
  AgentDefinition,
  AgentRegistry,
  StageExecutionPolicy,
} from "../src/contracts.js";

const validPolicy = {
  mode: "decision-sufficient",
  decisiveOutcome: "stop-and-report",
  unavailableGate: "record-unmet",
  retryLimit: 1,
} as const;

describe("decision-efficient execution contract", () => {
  it.each(["fail", "unmet", "unknown", "not-run-after-decisive-stop"] as const)(
    "rejects acceptance when a required gate is %s",
    (status) => {
      expect(() =>
        AcceptanceDecision.parse({
          verdict: "accept",
          rerunsUsed: 0,
          rerunLimitDisposition: "park",
          gates: [{ id: "required-evidence", requiredForAcceptance: true, status }],
        }),
      ).toThrow("must pass before acceptance");
    },
  );

  it("allows acceptance only with required gates passed", () => {
    expect(
      AcceptanceDecision.parse({
        verdict: "accept",
        rerunsUsed: 0,
        rerunLimitDisposition: "park",
        gates: [
          { id: "required-evidence", requiredForAcceptance: true, status: "pass" },
          { id: "optional-evidence", requiredForAcceptance: false, status: "unmet" },
        ],
      }).verdict,
    ).toBe("accept");
  });

  it("rejects acceptance when no gate is acceptance-required", () => {
    expect(() =>
      AcceptanceDecision.parse({
        verdict: "accept",
        rerunsUsed: 0,
        rerunLimitDisposition: "park",
        gates: [{ id: "optional-evidence", requiredForAcceptance: false, status: "pass" }],
      }),
    ).toThrow("requires at least one acceptance-required gate");
  });

  it("prohibits a third automated rerun", () => {
    expect(() =>
      AcceptanceDecision.parse({
        verdict: "rerun",
        rerunsUsed: 2,
        rerunLimitDisposition: "human-review",
        gates: [{ id: "required-evidence", requiredForAcceptance: true, status: "unknown" }],
      }),
    ).toThrow("third automated rerun is prohibited");
  });

  it.each(["human-review", "park"] as const)(
    "accepts the frozen %s disposition after the rerun limit",
    (verdict) => {
      expect(
        AcceptanceDecision.parse({
          verdict,
          rerunsUsed: 2,
          rerunLimitDisposition: verdict,
          gates: [{ id: "required-evidence", requiredForAcceptance: true, status: "unknown" }],
        }).verdict,
      ).toBe(verdict);
    },
  );

  it("rejects a terminal verdict that changes the frozen disposition", () => {
    expect(() =>
      AcceptanceDecision.parse({
        verdict: "human-review",
        rerunsUsed: 2,
        rerunLimitDisposition: "park",
        gates: [{ id: "required-evidence", requiredForAcceptance: true, status: "unknown" }],
      }),
    ).toThrow("must match the frozen rerun-limit disposition");
  });

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
