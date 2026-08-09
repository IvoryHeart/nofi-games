import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { FileArtifactStore, InMemoryArtifactStore } from "./artifact-store.js";
import { FakeAgentProvider } from "./fake-provider.js";
import { InMemoryRuntimeRepository } from "./in-memory-runtime-repository.js";
import { createOpenAIProvider } from "./openai-provider.js";
import { loadRuntimePolicies } from "./policies.js";
import { collectSecretValues } from "./redaction.js";
import { loadAttemptProvenance, missingProvenanceFields } from "./provenance.js";
import { deterministicFixtureOutput, createRuntimeFixtureRequest } from "./runtime-fixture.js";
import { StageCoordinator, StageExecutionRequest } from "./stage-coordinator.js";
import { createSupabaseRuntimeRepository } from "./supabase-runtime-repository.js";

const [command = "help", argument] = process.argv.slice(2);
const execFileAsync = promisify(execFile);

async function currentGitCommit(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const commit = stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Unable to resolve a Git commit");
  return commit;
}

function hostedRepository(additionalSecrets: readonly string[] = []) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createSupabaseRuntimeRepository(url, key, [
    ...collectSecretValues(process.env),
    ...additionalSecrets,
  ]);
}

async function validate(): Promise<void> {
  const policies = await loadRuntimePolicies();
  console.log(
    JSON.stringify({
      valid: true,
      modelPolicies: policies.models.size,
      sessionPolicies: policies.sessions.size,
      securityPolicies: policies.security.size,
      priceSchedules: policies.pricing.size,
      outputContracts: policies.outputContracts.size,
    }),
  );
}

async function fakeRun(): Promise<void> {
  const repository = new InMemoryRuntimeRepository();
  const provider = new FakeAgentProvider([
    { kind: "success", output: deterministicFixtureOutput() },
  ]);
  const result = await new StageCoordinator(repository, new InMemoryArtifactStore(), provider, {
    workerId: `cli-${process.pid}`,
  }).executeStage(await createRuntimeFixtureRequest());
  console.log(
    JSON.stringify({
      status: result.status,
      calls: result.calls,
      ...(result.attempt ? { attemptId: result.attempt.id } : {}),
      ...(result.status === "accepted" || result.status === "replayed"
        ? { checkpointId: result.checkpoint.id }
        : { reason: "reason" in result ? result.reason : "unknown" }),
    }),
  );
}

async function resume(requestPath: string | undefined): Promise<void> {
  if (!requestPath) throw new Error("resume requires a JSON execution-request path");
  const request = StageExecutionRequest.parse(
    JSON.parse(await readFile(resolve(requestPath), "utf8")) as unknown,
  );
  const providerName = process.env.NOFI_PROVIDER ?? "openai";
  const provider =
    providerName === "fake"
      ? new FakeAgentProvider([{ kind: "success", output: deterministicFixtureOutput() }])
      : createOpenAIProvider(process.env.OPENAI_API_KEY);
  const result = await new StageCoordinator(
    hostedRepository(),
    new FileArtifactStore(resolve(".nofi", "runtime-artifacts")),
    provider,
    {
      workerId: `resume-${process.pid}`,
      allowLive: process.env.NOFI_LIVE_PROVIDER_ENABLED === "true",
      secrets: collectSecretValues(process.env),
    },
  ).executeStage(request);
  console.log(
    JSON.stringify({
      status: result.status,
      calls: result.calls,
      ...(result.attempt ? { attemptId: result.attempt.id } : {}),
      ...(result.status === "accepted" || result.status === "replayed"
        ? { checkpointId: result.checkpoint.id }
        : { reason: "reason" in result ? result.reason : "unknown" }),
    }),
  );
}

async function inspectRun(workflowRunId: string | undefined): Promise<void> {
  if (!workflowRunId) throw new Error("inspect requires a workflow-run UUID");
  const repository = hostedRepository();
  const attempts = await repository.listAttempts(workflowRunId);
  const summary = await Promise.all(
    attempts.map(async (attempt) => ({
      id: attempt.id,
      stage: attempt.stage,
      status: attempt.status,
      sessionId: attempt.sessionId,
      checkpointId: attempt.acceptedCheckpointId ?? null,
      modelCallEvents: (await repository.listModelCallsByAttempt(attempt.id)).length,
    })),
  );
  console.log(JSON.stringify({ workflowRunId, attempts: summary }, null, 2));
}

async function reconcile(attemptId: string | undefined): Promise<void> {
  if (!attemptId) throw new Error("reconcile requires an attempt UUID");
  const repository = hostedRepository();
  const attempt = await repository.getAttempt(attemptId);
  if (!attempt) throw new Error(`Attempt ${attemptId} does not exist`);
  const calls = await repository.listModelCallsByAttempt(attemptId);
  console.log(
    JSON.stringify(
      {
        attemptId,
        status: attempt.status,
        automaticRetryAllowed: attempt.status !== "reconciling",
        callEvents: calls.map((call) => ({
          callId: call.id,
          sequence: call.sequence,
          status: call.status,
          responseId: call.providerResponseId ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

async function liveSmoke(): Promise<void> {
  if (process.env.NOFI_LIVE_PROVIDER_ENABLED !== "true") {
    throw new Error("Set NOFI_LIVE_PROVIDER_ENABLED=true to authorize the bounded live smoke");
  }
  const provider = createOpenAIProvider(process.env.OPENAI_API_KEY);
  const request = await createRuntimeFixtureRequest(randomUUID());
  const modelPolicy = { ...request.modelPolicy, liveEnabled: true };
  const sessionPolicy = {
    ...request.sessionPolicy,
    budget: { ...request.sessionPolicy.budget, maxRetries: 0, maxTurns: 1 },
  };
  let conversationId: string | undefined;
  try {
    const result = await new StageCoordinator(
      new InMemoryRuntimeRepository(),
      new FileArtifactStore(resolve(".nofi", "live-smoke-artifacts")),
      provider,
      {
        workerId: `live-smoke-${process.pid}`,
        allowLive: true,
        secrets: collectSecretValues(process.env),
      },
    ).executeStage({ ...request, modelPolicy, sessionPolicy });
    conversationId = result.session?.providerConversationId;
    console.log(JSON.stringify({ status: result.status, calls: result.calls }));
    if (result.status !== "accepted" || result.calls !== 1) process.exitCode = 1;
  } finally {
    if (conversationId) await provider.deleteConversation(conversationId);
  }
}

async function hostedSmoke(): Promise<void> {
  const canary = "hosted-runtime-secret-canary-4097";
  const repository = hostedRepository([canary]);
  const artifacts = new InMemoryArtifactStore();
  const request = {
    ...(await createRuntimeFixtureRequest()),
    gitCommit: await currentGitCommit(),
  };
  const provider = new FakeAgentProvider(
    [{ kind: "success", output: deterministicFixtureOutput() }],
    `hosted-${request.workflowRunId}`,
  );
  const { error: runError } = await repository.client.from("studio_workflow_runs").insert({
    id: request.workflowRunId,
    workflow: request.workflow,
    workflow_version: request.workflowVersion,
    git_commit: request.gitCommit,
    openspec_change: request.openSpecChange,
    status: "running",
    manifest: { kind: "hosted-runtime-smoke", retained_as_audit_evidence: true },
  });
  if (runError) throw runError;
  const workerId = `hosted-smoke-${process.pid}`;
  const coordinator = new StageCoordinator(repository, artifacts, provider, {
    workerId,
    secrets: [canary, ...collectSecretValues(process.env)],
  });
  const secretSafeRequest = {
    ...request,
    stableInstructions: `${request.stableInstructions} ${canary}`,
    inputArtifacts: request.inputArtifacts.map((artifact) => ({
      ...artifact,
      content: `${String(artifact.content)} ${canary}`,
    })),
  };
  try {
    const accepted = await coordinator.executeStage(secretSafeRequest);
    if (accepted.status !== "accepted") {
      throw new Error("reason" in accepted ? accepted.reason : accepted.status);
    }
    const replay = await coordinator.executeStage(secretSafeRequest);
    if (replay.status !== "replayed" || replay.calls !== 0) {
      throw new Error("Hosted idempotent replay failed");
    }
    const provenance = await loadAttemptProvenance(repository, accepted.attempt.id);
    const missing = missingProvenanceFields(provenance);
    if (missing.length) throw new Error(`Hosted provenance is incomplete: ${missing.join(", ")}`);
    if (JSON.stringify({ providerCalls: provider.calls, provenance }).includes(canary)) {
      throw new Error("Hosted secret canary escaped redaction");
    }
    await repository.appendWorkflowEvent(
      request.workflowRunId,
      "completed",
      "hosted-smoke-passed",
      {
        attemptId: accepted.attempt.id,
        checkpointId: accepted.checkpoint.id,
      },
    );
    const { error: statusError } = await repository.client
      .from("studio_workflow_runs")
      .update({ status: "completed" })
      .eq("id", request.workflowRunId);
    if (statusError) throw statusError;

    let browserIsolationStatus = "not-configured";
    const anonymousKey = process.env.SUPABASE_ANON_KEY;
    const url = process.env.SUPABASE_URL;
    if (anonymousKey && url) {
      const response = await fetch(`${url}/rest/v1/studio_agent_sessions?select=id&limit=1`, {
        headers: { apikey: anonymousKey, Authorization: `Bearer ${anonymousKey}` },
      });
      const body = response.ok ? ((await response.json()) as unknown) : undefined;
      if (response.ok && (!Array.isArray(body) || body.length !== 0)) {
        throw new Error("Browser role can read hosted runtime sessions");
      }
      browserIsolationStatus = response.ok ? "rls-empty" : `denied-${response.status}`;
    }
    console.log(
      JSON.stringify({
        status: accepted.status,
        replay: replay.status,
        calls: accepted.calls,
        migrationEnvelope: ["202608090001", "202608090002"],
        workflowRunId: request.workflowRunId,
        attemptId: accepted.attempt.id,
        checkpointId: accepted.checkpoint.id,
        browserIsolationStatus,
      }),
    );
  } catch (error) {
    const attempts = await repository.listAttempts(request.workflowRunId);
    const leased = attempts.find(
      (attempt) =>
        attempt.leaseOwner === workerId &&
        ["leased", "calling", "validating"].includes(attempt.status),
    );
    if (leased) {
      await repository.markReconciliation(
        leased.id,
        workerId,
        "hosted-smoke-failed-after-provider-boundary",
      );
    }
    await repository.appendWorkflowEvent(request.workflowRunId, "failed", "hosted-smoke-failed", {
      resumable: Boolean(leased),
    });
    throw error;
  }
}

switch (command) {
  case "validate":
    await validate();
    break;
  case "fake-run":
    await fakeRun();
    break;
  case "resume":
    await resume(argument);
    break;
  case "inspect":
    await inspectRun(argument);
    break;
  case "reconcile":
    await reconcile(argument);
    break;
  case "live-smoke":
    await liveSmoke();
    break;
  case "hosted-smoke":
    await hostedSmoke();
    break;
  default:
    console.log(
      "Usage: studio:runtime <validate|fake-run|resume REQUEST_JSON|inspect RUN_ID|reconcile ATTEMPT_ID|live-smoke|hosted-smoke>",
    );
}
