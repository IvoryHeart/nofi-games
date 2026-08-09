import { describe, expect, it } from "vitest";
import { loadRuntimePolicies } from "../src/policies.js";

describe("runtime policy manifests", () => {
  it("loads the pinned champion and safety policies", async () => {
    const policies = await loadRuntimePolicies();
    const model = policies.models.get("terra-champion");
    expect(model?.champion.model).toBe("gpt-5.6-terra");
    expect(model?.promptCaching.enabled).toBe(false);
    expect(model?.liveEnabled).toBe(false);
    expect(model?.challengers.find((item) => item.model === "gpt-5.6-luna")?.enabled).toBe(false);
    expect(policies.sessions.get("bounded-workstream")?.rotateBetweenStages).toBe(true);
    expect(policies.security.get("studio-redaction")?.retainRawPrompts).toBe(false);
    expect(policies.outputContracts.has("artifact-envelope")).toBe(true);
    expect(policies.pricing.has("openai-2026-08-09")).toBe(true);
  });
});
