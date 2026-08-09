import { describe, expect, it } from "vitest";
import { InMemoryArtifactStore } from "../src/artifact-store.js";
import { InMemoryRuntimeRepository } from "../src/in-memory-runtime-repository.js";
import { createOpenAIProvider } from "../src/openai-provider.js";
import { collectSecretValues } from "../src/redaction.js";
import { createRuntimeFixtureRequest } from "../src/runtime-fixture.js";
import { StageCoordinator } from "../src/stage-coordinator.js";

const liveAuthorized =
  process.env.NOFI_LIVE_PROVIDER_TEST === "true" &&
  process.env.NOFI_LIVE_PROVIDER_ENABLED === "true" &&
  Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!liveAuthorized)("live OpenAI provider", () => {
  it("runs one bounded create, continue, and rotate sequence and deletes conversations", async () => {
    const provider = createOpenAIProvider(process.env.OPENAI_API_KEY);
    const repository = new InMemoryRuntimeRepository();
    const coordinator = new StageCoordinator(repository, new InMemoryArtifactStore(), provider, {
      workerId: "live-provider-test",
      allowLive: true,
      secrets: collectSecretValues(process.env),
    });
    const request = await createRuntimeFixtureRequest();
    const boundedRequest = {
      ...request,
      stableInstructions: [
        request.stableInstructions,
        "This is a deterministic runtime smoke. Return market-brief as a JSON string.",
        "Use fixture://durable-agent-runtime as evidence URI and fixture evidence as its content.",
        "Return exactly the requested artifact and gate identifiers.",
      ].join(" "),
      maxOutputTokens: 1_500,
      modelPolicy: { ...request.modelPolicy, liveEnabled: true },
      sessionPolicy: {
        ...request.sessionPolicy,
        budget: {
          ...request.sessionPolicy.budget,
          hardCostMicrousd: 500_000,
          softCostMicrousd: 400_000,
          maxRetries: 0,
          maxTurns: 3,
        },
      },
    };
    const conversations = new Set<string>();
    try {
      const created = await coordinator.executeStage(boundedRequest);
      expect(created.status).toBe("accepted");
      if (created.status !== "accepted") {
        throw new Error("reason" in created ? created.reason : created.status);
      }
      conversations.add(created.session.providerConversationId!);

      const continued = await coordinator.executeStage({ ...boundedRequest, generation: 1 });
      expect(continued.status).toBe("accepted");
      if (continued.status !== "accepted") {
        throw new Error("reason" in continued ? continued.reason : continued.status);
      }
      expect(continued.session.id).toBe(created.session.id);
      conversations.add(continued.session.providerConversationId!);

      await provider.deleteConversation(continued.session.providerConversationId!);
      conversations.delete(continued.session.providerConversationId!);
      const rotated = await coordinator.executeStage({
        ...boundedRequest,
        generation: 2,
        inputCheckpoint: continued.checkpoint,
      });
      expect(rotated.status).toBe("accepted");
      if (rotated.status !== "accepted") {
        throw new Error("reason" in rotated ? rotated.reason : rotated.status);
      }
      expect(rotated.session.id).not.toBe(continued.session.id);
      conversations.add(rotated.session.providerConversationId!);

      const attempts = await repository.listAttempts(request.workflowRunId);
      const calls = (
        await Promise.all(attempts.map((attempt) => repository.listModelCallsByAttempt(attempt.id)))
      ).flat();
      const completed = calls.filter((call) => call.status === "completed");
      expect(completed).toHaveLength(3);
      expect(completed.every((call) => call.usage.inputTokens !== undefined)).toBe(true);
      expect(completed.every((call) => call.usage.outputTokens !== undefined)).toBe(true);
      expect(
        completed.reduce(
          (total, call) =>
            total + (call.estimatedCost.status === "priced" ? call.estimatedCost.microusd : 0),
          0,
        ),
      ).toBeLessThanOrEqual(500_000);
    } finally {
      await Promise.all([...conversations].map((id) => provider.deleteConversation(id)));
    }
  }, 120_000);
});
