import type { RunStatus, WorkflowRun } from "./contracts.js";

const allowedTransitions: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  planned: ["running", "failed"],
  running: ["evaluating", "failed"],
  evaluating: ["completed", "failed"],
  completed: ["rolled-back"],
  failed: ["running"],
  "rolled-back": [],
};

export function currentStatus(run: WorkflowRun): RunStatus {
  const event = run.events.at(-1);
  if (!event) {
    throw new Error(`Workflow ${run.id} has no events`);
  }
  return event.status;
}

export function transitionRun(
  run: WorkflowRun,
  next: RunStatus,
  reason: string,
  at = new Date(),
): WorkflowRun {
  const current = currentStatus(run);
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Invalid workflow transition: ${current} -> ${next}`);
  }
  if (!reason.trim()) {
    throw new Error("Workflow transitions require a reason");
  }

  return {
    ...run,
    events: [
      ...run.events,
      {
        sequence: run.events.length,
        status: next,
        at: at.toISOString(),
        reason,
      },
    ],
  };
}
