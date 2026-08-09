import { describe, expect, it } from "vitest";
import { EvaluationCandidate, EvaluationSuite } from "../src/contracts.js";
import {
  decideCachePolicyPromotion,
  decideModelPolicyPromotion,
  type ModelPolicyCandidate,
} from "../src/model-policy-evaluation.js";

const evidence = [
  {
    id: "policy-eval",
    kind: "test" as const,
    uri: "artifact://policy-eval",
    sha256: "a".repeat(64),
    collectedAt: "2026-08-09T00:00:00.000Z",
    summary: "Three independent policy repetitions",
  },
];

const suite = EvaluationSuite.parse({
  schemaVersion: 1,
  id: "agent-core",
  version: "1.0.0",
  subject: "agent",
  minimumRepetitions: 3,
  independentEvaluatorRequired: true,
  protectedHoldoutRequired: true,
  primaryMetric: "task-success",
  minimumPrimaryImprovement: 0.02,
  metrics: [
    {
      id: "task-success",
      direction: "higher",
      qualityGate: true,
      minimum: 0.8,
      maximumRegression: 0,
    },
    {
      id: "critical-error-rate",
      direction: "lower",
      qualityGate: true,
      maximum: 0,
      maximumRegression: 0,
    },
    {
      id: "evidence-completeness",
      direction: "higher",
      qualityGate: true,
      minimum: 0.95,
      maximumRegression: 0,
    },
    {
      id: "normalized-cost",
      direction: "lower",
      qualityGate: false,
      maximum: 1,
      maximumRegression: 0.2,
    },
  ],
});

function candidate(model: string, success: number, cost: number): ModelPolicyCandidate {
  return {
    ...EvaluationCandidate.parse({
      version: `${model}@0.1.0`,
      repetitions: 3,
      metrics: {
        "task-success": success,
        "critical-error-rate": 0,
        "evidence-completeness": 1,
        "normalized-cost": cost,
      },
      evidence,
    }),
    model,
  };
}

describe("model and cache policy evaluation", () => {
  it("promotes Sol only through independent repeated quality evidence", () => {
    expect(
      decideModelPolicyPromotion({
        affectedAgent: "researcher",
        evaluatorAgent: "agent-evaluator",
        suite,
        champion: candidate("gpt-5.6-terra", 0.82, 0.5),
        challenger: candidate("gpt-5.6-sol", 0.86, 0.7),
      }).verdict,
    ).toBe("promote");
  });

  it("requires Luna to preserve quality and cost less than Terra", () => {
    const base = {
      affectedAgent: "researcher",
      evaluatorAgent: "agent-evaluator",
      suite,
      champion: candidate("gpt-5.6-terra", 0.82, 0.5),
    };
    expect(
      decideModelPolicyPromotion({
        ...base,
        challenger: candidate("gpt-5.6-luna", 0.86, 0.4),
      }).verdict,
    ).toBe("promote");
    expect(
      decideModelPolicyPromotion({
        ...base,
        challenger: candidate("gpt-5.6-luna", 0.86, 0.5),
      }).verdict,
    ).toBe("reject");
  });

  it("enables explicit caching only when repeated cost does not regress", () => {
    const control = {
      repetitions: 3,
      protectedQualityPassed: true,
      estimatedCostsMicrousd: [100, 100, 100],
    };
    expect(
      decideCachePolicyPromotion(control, {
        repetitions: 3,
        protectedQualityPassed: true,
        estimatedCostsMicrousd: [90, 95, 90],
      }).verdict,
    ).toBe("promote");
    expect(
      decideCachePolicyPromotion(control, {
        repetitions: 3,
        protectedQualityPassed: true,
        estimatedCostsMicrousd: [120, 125, 120],
      }).verdict,
    ).toBe("reject");
  });
});
