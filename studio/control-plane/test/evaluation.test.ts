import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EvaluationCandidate, EvaluationSuite } from "../src/contracts.js";
import { decideAgentPromotion } from "../src/evaluation.js";

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
const evidence = (id: string) => [
  {
    id,
    kind: "test" as const,
    uri: `artifact://${id}`,
    sha256: sha(id),
    collectedAt: "2026-08-09T00:00:00.000Z",
    summary: `${id} results`,
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
  ],
});

function candidate(
  version: string,
  taskSuccess: number,
  criticalErrorRate = 0,
): EvaluationCandidate {
  return EvaluationCandidate.parse({
    version,
    repetitions: 3,
    metrics: {
      "task-success": taskSuccess,
      "critical-error-rate": criticalErrorRate,
    },
    evidence: evidence(version.replaceAll(".", "-")),
  });
}

describe("agent champion/challenger decisions", () => {
  it("promotes only an independently evaluated quality improvement", () => {
    const decision = decideAgentPromotion({
      affectedAgent: "researcher",
      evaluatorAgent: "agent-evaluator",
      suite,
      champion: candidate("1.0.0", 0.82),
      challenger: candidate("1.1.0", 0.86),
    });
    expect(decision).toMatchObject({
      verdict: "promote",
      protectedMetricsPassed: true,
      rollbackVersion: "1.0.0",
    });
  });

  it("rejects a challenger that improves the primary metric but violates a guard", () => {
    const decision = decideAgentPromotion({
      affectedAgent: "researcher",
      evaluatorAgent: "agent-evaluator",
      suite,
      champion: candidate("1.0.0", 0.82),
      challenger: candidate("1.1.0", 0.9, 0.01),
    });
    expect(decision.verdict).toBe("reject");
    expect(decision.protectedMetricsPassed).toBe(false);
  });

  it("prevents self-evaluation", () => {
    expect(() =>
      decideAgentPromotion({
        affectedAgent: "researcher",
        evaluatorAgent: "researcher",
        suite,
        champion: candidate("1.0.0", 0.82),
        challenger: candidate("1.1.0", 0.86),
      }),
    ).toThrow("cannot evaluate its own challenger");
  });
});
