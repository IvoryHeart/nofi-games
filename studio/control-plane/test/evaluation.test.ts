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

const requiredGate = (
  status: "pass" | "fail" | "unmet" | "unknown" | "not-run-after-decisive-stop" = "pass",
) => [{ id: "independent-review", requiredForAcceptance: true, status }] as const;

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
      gates: requiredGate(),
      rerunsUsed: 0,
      rerunLimitDisposition: "park",
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
      gates: requiredGate(),
      rerunsUsed: 0,
      rerunLimitDisposition: "park",
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
        gates: requiredGate(),
        rerunsUsed: 0,
        rerunLimitDisposition: "park",
      }),
    ).toThrow("cannot evaluate its own challenger");
  });

  it.each(["unmet", "unknown", "not-run-after-decisive-stop"] as const)(
    "returns rerun rather than promotion when a required gate is %s",
    (status) => {
      const decision = decideAgentPromotion({
        affectedAgent: "researcher",
        evaluatorAgent: "agent-evaluator",
        suite,
        champion: candidate("1.0.0", 0.82),
        challenger: candidate("1.1.0", 0.86),
        gates: requiredGate(status),
        rerunsUsed: 0,
        rerunLimitDisposition: "park",
      });
      expect(decision.verdict).toBe("rerun");
    },
  );

  it("rejects promotion when a required gate fails", () => {
    const decision = decideAgentPromotion({
      affectedAgent: "researcher",
      evaluatorAgent: "agent-evaluator",
      suite,
      champion: candidate("1.0.0", 0.82),
      challenger: candidate("1.1.0", 0.86),
      gates: requiredGate("fail"),
      rerunsUsed: 0,
      rerunLimitDisposition: "park",
    });
    expect(decision.verdict).toBe("reject");
  });

  it.each(["human-review", "park"] as const)(
    "uses the frozen %s disposition after the second unresolved rerun",
    (rerunLimitDisposition) => {
      const decision = decideAgentPromotion({
        affectedAgent: "researcher",
        evaluatorAgent: "agent-evaluator",
        suite,
        champion: candidate("1.0.0", 0.82),
        challenger: candidate("1.1.0", 0.86),
        gates: requiredGate("unknown"),
        rerunsUsed: 2,
        rerunLimitDisposition,
      });
      expect(decision.verdict).toBe(rerunLimitDisposition);
    },
  );
});
