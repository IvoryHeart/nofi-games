import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parse } from "yaml";
import {
  AgentRegistry,
  EvaluationSuite,
  WorkflowDefinition,
} from "../studio/control-plane/src/contracts.js";
import { loadRuntimePolicies } from "../studio/control-plane/src/policies.js";

const registry = AgentRegistry.parse(parse(await readFile("agents/registry.yaml", "utf8")));
const policies = await loadRuntimePolicies();
const agents = new Map(registry.agents.map((agent) => [agent.id, agent]));
if (agents.size !== registry.agents.length) throw new Error("Agent IDs must be unique");

const evalFiles = await readdir("evals/suites", { recursive: true, withFileTypes: true });
const evalSuiteIds = new Set<string>();
for (const entry of evalFiles) {
  if (!entry.isFile() || entry.name !== "suite.yaml") continue;
  const path = resolve(entry.parentPath, entry.name);
  evalSuiteIds.add(EvaluationSuite.parse(parse(await readFile(path, "utf8"))).id);
}
for (const agent of registry.agents) {
  if (!evalSuiteIds.has(agent.evaluationSuite)) {
    throw new Error(`Agent ${agent.id} references missing eval suite ${agent.evaluationSuite}`);
  }
  const skillPath = resolve("agents", "skills", agent.skill, "SKILL.md");
  await readFile(skillPath, "utf8").catch(() => {
    throw new Error(`Agent ${agent.id} references missing skill ${agent.skill}`);
  });
  if (!policies.models.has(agent.modelPolicy)) {
    throw new Error(`Agent ${agent.id} references missing model policy ${agent.modelPolicy}`);
  }
  if (!policies.sessions.has(agent.sessionPolicy)) {
    throw new Error(`Agent ${agent.id} references missing session policy ${agent.sessionPolicy}`);
  }
  if (!policies.security.has(agent.securityPolicy)) {
    throw new Error(`Agent ${agent.id} references missing security policy ${agent.securityPolicy}`);
  }
}

const workflowFiles = (await readdir("studio/workflows"))
  .filter((file) => file.endsWith(".yaml"))
  .sort();
if (!workflowFiles.length) throw new Error("No workflow definitions found");
const workflowIds = new Set<string>();
for (const file of workflowFiles) {
  const workflow = WorkflowDefinition.parse(
    parse(await readFile(resolve("studio/workflows", file), "utf8")),
  );
  if (basename(file, ".yaml") !== workflow.id) {
    throw new Error(`${file} must be named after workflow ${workflow.id}`);
  }
  if (workflowIds.has(workflow.id)) throw new Error(`Duplicate workflow ${workflow.id}`);
  workflowIds.add(workflow.id);
  const stageIds = new Set<string>();
  const produced = new Set<string>();
  for (const stage of workflow.stages) {
    if (stageIds.has(stage.id)) throw new Error(`${workflow.id} has duplicate stage ${stage.id}`);
    const agent = agents.get(stage.agent);
    if (!agent) throw new Error(`${workflow.id}/${stage.id} references missing agent`);
    if (agent.skill !== stage.skill) {
      throw new Error(`${workflow.id}/${stage.id} skill does not match its registered agent`);
    }
    if (!policies.models.has(stage.modelPolicy)) {
      throw new Error(`${workflow.id}/${stage.id} references missing model policy`);
    }
    if (!policies.sessions.has(stage.sessionPolicy)) {
      throw new Error(`${workflow.id}/${stage.id} references missing session policy`);
    }
    if (!policies.security.has(stage.securityPolicy)) {
      throw new Error(`${workflow.id}/${stage.id} references missing security policy`);
    }
    if (!policies.outputContracts.has(stage.outputContract)) {
      throw new Error(`${workflow.id}/${stage.id} references missing output contract`);
    }
    for (const dependency of stage.dependsOn) {
      if (!stageIds.has(dependency)) {
        throw new Error(`${workflow.id}/${stage.id} has a missing or forward dependency`);
      }
    }
    for (const input of stage.consumes) {
      if (!produced.has(input) && stage.dependsOn.length > 0) {
        throw new Error(`${workflow.id}/${stage.id} consumes unavailable artifact ${input}`);
      }
    }
    stageIds.add(stage.id);
    stage.produces.forEach((artifact) => produced.add(artifact));
  }
}
console.log(
  `Agent registry and workflows valid: ${agents.size} agents, ${workflowIds.size} workflows`,
);
