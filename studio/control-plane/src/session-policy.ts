import type { AgentSession, SessionPolicy } from "./runtime-contracts.js";

export type SessionDecision =
  | { readonly action: "new"; readonly reason: "no-compatible-session" }
  | { readonly action: "resume"; readonly reason: "compatible" }
  | {
      readonly action: "rotate";
      readonly reason:
        | "provider-conversation-lost"
        | "idle-limit"
        | "soft-context-limit"
        | "soft-cost-limit"
        | "checkpoint-distance";
    }
  | {
      readonly action: "stop";
      readonly reason: "hard-context-limit" | "hard-cost-limit" | "turn-limit" | "duration-limit";
    };

export function decideSession(
  session: AgentSession | undefined,
  policy: SessionPolicy,
  options: {
    readonly providerConversationAvailable: boolean;
    readonly projectedInputTokens?: number;
    readonly projectedCostMicrousd?: number;
    readonly now?: Date;
  },
): SessionDecision {
  const now = options.now ?? new Date();
  const projectedContext =
    (session?.accumulatedContextTokens ?? 0) + (options.projectedInputTokens ?? 0);
  const projectedCost =
    (session?.accumulatedCostMicrousd ?? 0) + (options.projectedCostMicrousd ?? 0);
  if (projectedContext >= policy.budget.hardContextTokens) {
    return { action: "stop", reason: "hard-context-limit" };
  }
  if (projectedCost >= policy.budget.hardCostMicrousd) {
    return { action: "stop", reason: "hard-cost-limit" };
  }
  if (!session) return { action: "new", reason: "no-compatible-session" };
  if (session.turns >= policy.budget.maxTurns) return { action: "stop", reason: "turn-limit" };
  if (
    now.getTime() - new Date(session.createdAt).getTime() >=
    policy.budget.maxDurationSeconds * 1_000
  ) {
    return { action: "stop", reason: "duration-limit" };
  }
  if (!options.providerConversationAvailable) {
    return { action: "rotate", reason: "provider-conversation-lost" };
  }
  if (
    now.getTime() - new Date(session.updatedAt).getTime() >=
    policy.budget.maxIdleSeconds * 1_000
  ) {
    return { action: "rotate", reason: "idle-limit" };
  }
  if (projectedContext >= policy.budget.softContextTokens) {
    return { action: "rotate", reason: "soft-context-limit" };
  }
  if (projectedCost >= policy.budget.softCostMicrousd) {
    return { action: "rotate", reason: "soft-cost-limit" };
  }
  if (session.turnsSinceCheckpoint >= policy.budget.maxTurnsBetweenCheckpoints) {
    return { action: "rotate", reason: "checkpoint-distance" };
  }
  return { action: "resume", reason: "compatible" };
}
