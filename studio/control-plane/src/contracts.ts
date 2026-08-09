import { z } from "zod";

export const Identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const IsoDateTime = z.iso.datetime({ offset: true });

export const EvidenceReference = z.object({
  id: Identifier,
  kind: z.enum(["source", "test", "simulation", "replay", "visual", "telemetry", "feedback"]),
  uri: z.string().min(1),
  sha256: Sha256.optional(),
  collectedAt: IsoDateTime,
  summary: z.string().min(1),
});

export type EvidenceReference = z.infer<typeof EvidenceReference>;

export const GamePackManifest = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(1),
  sdkVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  entryScene: z.string().regex(/^res:\/\/game_packs\/[a-z0-9_]+\/.+\.tscn$/),
  entryScript: z.string().regex(/^res:\/\/game_packs\/[a-z0-9_]+\/.+\.gd$/),
  discoverable: z.boolean(),
  capabilities: z.array(z.enum(["local-save", "network", "identity", "haptics"])),
  inputs: z.array(Identifier).min(1),
  orientations: z.array(z.enum(["portrait", "landscape"])).min(1),
  minimumPlayerAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export type GamePackManifest = z.infer<typeof GamePackManifest>;

export const CatalogEntry = GamePackManifest.extend({
  packUrl: z.string().url(),
  packSha256: Sha256,
  rolloutBasisPoints: z.number().int().min(0).max(10_000),
  rollbackVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  status: z.enum(["fixture", "candidate", "canary", "live", "retired"]),
});

export const Catalog = z.object({
  schemaVersion: z.literal(1),
  generatedAt: IsoDateTime,
  entries: z.array(CatalogEntry),
});

export type Catalog = z.infer<typeof Catalog>;

export const EvaluationMetric = z
  .object({
    id: Identifier,
    direction: z.enum(["higher", "lower"]),
    qualityGate: z.boolean(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    maximumRegression: z.number().finite().nonnegative(),
  })
  .refine((metric) => metric.minimum !== undefined || metric.maximum !== undefined, {
    message: "Every evaluation metric requires a minimum or maximum boundary",
  });

export const EvaluationSuite = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  subject: z.enum(["agent", "game-pack", "workflow"]),
  minimumRepetitions: z.number().int().min(2),
  independentEvaluatorRequired: z.literal(true),
  protectedHoldoutRequired: z.boolean(),
  primaryMetric: Identifier,
  minimumPrimaryImprovement: z.number().finite().nonnegative(),
  metrics: z.array(EvaluationMetric).min(1),
});

export type EvaluationSuite = z.infer<typeof EvaluationSuite>;

export const EvaluationCandidate = z.object({
  version: z.string().min(1),
  repetitions: z.number().int().nonnegative(),
  metrics: z.record(Identifier, z.number().finite()),
  evidence: z.array(EvidenceReference),
});

export type EvaluationCandidate = z.infer<typeof EvaluationCandidate>;

export const FeedbackEnvelope = z.object({
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  evidence: z.array(EvidenceReference),
  unknowns: z.array(z.string()),
  risks: z.array(z.string()),
  feedbackRequested: z.array(z.string()),
  improvementSuggestions: z.array(z.string()),
});

export const AgentDefinition = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  purpose: z.string().min(1),
  skill: Identifier,
  allowedTools: z.array(Identifier),
  evaluationSuite: Identifier,
  mayPromoteSelf: z.literal(false),
});

export const AgentRegistry = z.object({
  schemaVersion: z.literal(1),
  agents: z.array(AgentDefinition.omit({ schemaVersion: true })).min(1),
});

export const WorkflowStage = z.object({
  id: Identifier,
  agent: Identifier,
  skill: Identifier,
  changeSchema: Identifier.optional(),
  dependsOn: z.array(Identifier),
  consumes: z.array(Identifier),
  produces: z.array(Identifier).min(1),
  gates: z.array(Identifier).min(1),
  mutatesSource: z.boolean(),
  mayPublishPreview: z.boolean(),
  mayPublishProduction: z.boolean(),
});

export const WorkflowDefinition = z.object({
  schemaVersion: z.literal(1),
  id: Identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  trigger: z.enum(["manual", "schedule", "telemetry", "evaluation-failure"]),
  rollbackRequired: z.literal(true),
  stages: z.array(WorkflowStage).min(2),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinition>;

export const RunStatus = z.enum([
  "planned",
  "running",
  "evaluating",
  "completed",
  "failed",
  "rolled-back",
]);

export type RunStatus = z.infer<typeof RunStatus>;

export const RunEvent = z.object({
  sequence: z.number().int().nonnegative(),
  status: RunStatus,
  at: IsoDateTime,
  reason: z.string().min(1),
});

export const WorkflowRun = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  workflow: Identifier,
  workflowVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  gitCommit: z.string().regex(/^[a-f0-9]{40}$/),
  openSpecChange: Identifier,
  agentVersions: z.record(Identifier, z.string()),
  modelVersions: z.record(Identifier, z.string()),
  skillHashes: z.record(Identifier, Sha256),
  inputHashes: z.record(Identifier, Sha256),
  outputHashes: z.record(Identifier, Sha256),
  evaluationSuiteVersion: z.string(),
  baselineRunId: z.uuid().optional(),
  events: z.array(RunEvent).min(1),
  evidence: z.array(EvidenceReference),
});

export type WorkflowRun = z.infer<typeof WorkflowRun>;
