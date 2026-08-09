import type { EvaluationCandidate, EvaluationSuite } from "./contracts.js";
import { decideAgentPromotion, type PromotionDecision } from "./evaluation.js";

export interface ModelPolicyCandidate extends EvaluationCandidate {
  readonly model: string;
}

export interface ModelPolicyDecision extends PromotionDecision {
  readonly model: string;
  readonly costReduced: boolean;
}

export function decideModelPolicyPromotion(input: {
  readonly affectedAgent: string;
  readonly evaluatorAgent: string;
  readonly suite: EvaluationSuite;
  readonly champion: ModelPolicyCandidate;
  readonly challenger: ModelPolicyCandidate;
}): ModelPolicyDecision {
  const base = decideAgentPromotion(input);
  const championCost = input.champion.metrics["normalized-cost"];
  const challengerCost = input.challenger.metrics["normalized-cost"];
  if (championCost === undefined || challengerCost === undefined) {
    throw new Error("Model policy evaluation requires normalized-cost");
  }
  const costReduced = challengerCost < championCost;
  const lunaRequiresLowerCost = input.challenger.model === "gpt-5.6-luna";
  const verdict =
    base.verdict === "promote" && (!lunaRequiresLowerCost || costReduced) ? "promote" : "reject";
  const reasons = [...base.reasons];
  if (lunaRequiresLowerCost && !costReduced)
    reasons.push("Luna must cost less than the Terra champion");
  return { ...base, verdict, reasons, model: input.challenger.model, costReduced };
}

export interface CacheEvaluationCandidate {
  readonly repetitions: number;
  readonly protectedQualityPassed: boolean;
  readonly estimatedCostsMicrousd: readonly number[];
}

export function decideCachePolicyPromotion(
  control: CacheEvaluationCandidate,
  candidate: CacheEvaluationCandidate,
  minimumRepetitions = 3,
): {
  readonly verdict: "promote" | "reject";
  readonly controlMean: number;
  readonly candidateMean: number;
} {
  if (
    control.repetitions < minimumRepetitions ||
    candidate.repetitions < minimumRepetitions ||
    control.estimatedCostsMicrousd.length < minimumRepetitions ||
    candidate.estimatedCostsMicrousd.length < minimumRepetitions
  )
    throw new Error(`Cache evaluation requires ${minimumRepetitions} repetitions`);
  const mean = (values: readonly number[]) =>
    values.reduce((total, value) => total + value, 0) / values.length;
  const controlMean = mean(control.estimatedCostsMicrousd);
  const candidateMean = mean(candidate.estimatedCostsMicrousd);
  return {
    verdict:
      candidate.protectedQualityPassed && candidateMean <= controlMean ? "promote" : "reject",
    controlMean,
    candidateMean,
  };
}
