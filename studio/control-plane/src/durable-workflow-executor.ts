import type { WorkflowDefinition, WorkflowStage } from "./contracts.js";
import type {
  StageCoordinator,
  StageExecutionRequest,
  StageExecutionResult,
} from "./stage-coordinator.js";
import type { RuntimeRepository } from "./runtime-repository.js";

export function runnableWorkflowStages(
  workflow: WorkflowDefinition,
  acceptedStageIds: ReadonlySet<string>,
): readonly WorkflowStage[] {
  return workflow.stages.filter(
    (stage) =>
      !acceptedStageIds.has(stage.id) &&
      stage.dependsOn.every((dependency) => acceptedStageIds.has(dependency)),
  );
}

export class DurableWorkflowExecutor {
  constructor(
    readonly workflow: WorkflowDefinition,
    readonly repository: RuntimeRepository,
    readonly coordinator: StageCoordinator,
  ) {}

  async acceptedStageIds(workflowRunId: string): Promise<ReadonlySet<string>> {
    return new Set(
      (await this.repository.listAttempts(workflowRunId))
        .filter((attempt) => attempt.status === "accepted")
        .map((attempt) => attempt.stage),
    );
  }

  async runnable(workflowRunId: string): Promise<readonly WorkflowStage[]> {
    return runnableWorkflowStages(this.workflow, await this.acceptedStageIds(workflowRunId));
  }

  async executeStage(request: StageExecutionRequest): Promise<StageExecutionResult> {
    const definition = this.workflow.stages.find((stage) => stage.id === request.stage);
    if (!definition) return { status: "blocked", reason: "stage-not-in-workflow", calls: 0 };
    const accepted = await this.acceptedStageIds(request.workflowRunId);
    const missing = definition.dependsOn.filter((dependency) => !accepted.has(dependency));
    if (missing.length) {
      return {
        status: "blocked",
        reason: `dependencies-not-accepted:${missing.join(",")}`,
        calls: 0,
      };
    }
    return this.coordinator.executeStage(request);
  }
}
