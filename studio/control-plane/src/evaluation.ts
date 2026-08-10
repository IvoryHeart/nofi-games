import {
  AcceptanceDecision,
  AcceptanceGateResult,
  type EvaluationCandidate,
  type EvaluationSuite,
  type RerunLimitDisposition,
} from "./contracts.js";

export type PromotionVerdict = "promote" | "reject" | "rerun" | "human-review" | "park";

export interface PromotionDecision {
  verdict: PromotionVerdict;
  reasons: readonly string[];
  protectedMetricsPassed: boolean;
  primaryImprovement: number;
  rollbackVersion: string;
}

export interface PromotionInput {
  affectedAgent: string;
  evaluatorAgent: string;
  suite: EvaluationSuite;
  champion: EvaluationCandidate;
  challenger: EvaluationCandidate;
  gates: readonly AcceptanceGateResult[];
  rerunsUsed: number;
  rerunLimitDisposition: RerunLimitDisposition;
}

function metricValue(candidate: EvaluationCandidate, metricId: string): number {
  const value = candidate.metrics[metricId];
  if (value === undefined) {
    throw new Error(`Candidate ${candidate.version} is missing metric ${metricId}`);
  }
  return value;
}

export function decideAgentPromotion(input: PromotionInput): PromotionDecision {
  const { affectedAgent, evaluatorAgent, suite, champion, challenger } = input;
  const gates = AcceptanceGateResult.array().min(1).parse(input.gates);
  const rerunsUsed = AcceptanceDecision.shape.rerunsUsed.parse(input.rerunsUsed);
  const requiredGates = gates.filter(({ requiredForAcceptance }) => requiredForAcceptance);
  if (!requiredGates.length) {
    throw new Error("Agent promotion requires at least one acceptance-required gate");
  }
  if (suite.subject !== "agent") throw new Error("Agent promotion requires an agent eval suite");
  if (affectedAgent === evaluatorAgent) {
    throw new Error("An affected agent cannot evaluate its own challenger");
  }
  if (
    champion.repetitions < suite.minimumRepetitions ||
    challenger.repetitions < suite.minimumRepetitions
  ) {
    throw new Error(`Both candidates require ${suite.minimumRepetitions} repetitions`);
  }

  const metricIds = new Set(suite.metrics.map((metric) => metric.id));
  if (!metricIds.has(suite.primaryMetric)) {
    throw new Error(`Primary metric ${suite.primaryMetric} is not declared by the suite`);
  }

  const reasons: string[] = [];
  let protectedMetricsPassed = true;
  for (const metric of suite.metrics) {
    const championValue = metricValue(champion, metric.id);
    const challengerValue = metricValue(challenger, metric.id);
    const boundaryPassed =
      (metric.minimum === undefined || challengerValue >= metric.minimum) &&
      (metric.maximum === undefined || challengerValue <= metric.maximum);
    const regression =
      metric.direction === "higher"
        ? championValue - challengerValue
        : challengerValue - championValue;
    const regressionPassed = regression <= metric.maximumRegression;
    if (!boundaryPassed || !regressionPassed) {
      protectedMetricsPassed = false;
      reasons.push(`${metric.id} failed its boundary or regression guard`);
    }
  }

  const primaryDefinition = suite.metrics.find((metric) => metric.id === suite.primaryMetric);
  if (!primaryDefinition) throw new Error("Primary metric definition is missing");
  const championPrimary = metricValue(champion, suite.primaryMetric);
  const challengerPrimary = metricValue(challenger, suite.primaryMetric);
  const primaryImprovement =
    primaryDefinition.direction === "higher"
      ? challengerPrimary - championPrimary
      : championPrimary - challengerPrimary;
  const primaryPassed = primaryImprovement >= suite.minimumPrimaryImprovement;
  if (!primaryPassed) reasons.push("Primary quality improvement threshold was not met");
  if (!champion.evidence.length || !challenger.evidence.length) {
    reasons.push("Both candidates require evidence references");
  }

  const failedRequiredGate = requiredGates.find(({ status }) => status === "fail");
  const incompleteRequiredGate = requiredGates.find(
    ({ status }) =>
      status === "unmet" || status === "unknown" || status === "not-run-after-decisive-stop",
  );
  if (failedRequiredGate) reasons.push(`Acceptance-required gate ${failedRequiredGate.id} failed`);
  if (incompleteRequiredGate) {
    reasons.push(
      `Acceptance-required gate ${incompleteRequiredGate.id} is ${incompleteRequiredGate.status}`,
    );
  }

  const qualityEligible =
    protectedMetricsPassed &&
    primaryPassed &&
    champion.evidence.length > 0 &&
    challenger.evidence.length > 0;
  const verdict: PromotionVerdict =
    qualityEligible && requiredGates.every(({ status }) => status === "pass")
      ? "promote"
      : qualityEligible && !failedRequiredGate && incompleteRequiredGate
        ? rerunsUsed < 2
          ? "rerun"
          : input.rerunLimitDisposition
        : "reject";

  AcceptanceDecision.parse({
    verdict: verdict === "promote" ? "accept" : verdict,
    rerunsUsed,
    rerunLimitDisposition: input.rerunLimitDisposition,
    gates,
  });
  if (verdict === "promote") reasons.push("All precommitted promotion gates passed");

  return {
    verdict,
    reasons,
    protectedMetricsPassed,
    primaryImprovement,
    rollbackVersion: champion.version,
  };
}
