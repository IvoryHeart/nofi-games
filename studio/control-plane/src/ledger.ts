import type { WorkflowRun } from "./contracts.js";

export interface RunLedger {
  append(run: WorkflowRun): Promise<void>;
  get(runId: string): Promise<WorkflowRun | undefined>;
  list(): Promise<readonly WorkflowRun[]>;
}

export class InMemoryRunLedger implements RunLedger {
  readonly #runs = new Map<string, WorkflowRun>();

  async append(run: WorkflowRun): Promise<void> {
    const existing = this.#runs.get(run.id);
    const existingSequence = existing?.events.at(-1)?.sequence ?? -1;
    const nextSequence = run.events.at(-1)?.sequence ?? -1;
    if (nextSequence <= existingSequence) {
      throw new Error(`Run ${run.id} must append a new event`);
    }
    this.#runs.set(run.id, structuredClone(run));
  }

  async get(runId: string): Promise<WorkflowRun | undefined> {
    const run = this.#runs.get(runId);
    return run ? structuredClone(run) : undefined;
  }

  async list(): Promise<readonly WorkflowRun[]> {
    return [...this.#runs.values()].map((run) => structuredClone(run));
  }
}
