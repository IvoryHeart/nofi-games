import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { EvaluationSuite } from "../studio/control-plane/src/contracts.js";

async function suiteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? suiteFiles(path)
        : entry.isFile() && entry.name === "suite.yaml"
          ? [path]
          : [];
    }),
  );
  return nested.flat();
}

const root = resolve("evals/suites");
const files = await suiteFiles(root);
if (!files.length) throw new Error("No evaluation suites found");
const identities = new Set<string>();
for (const file of files.sort()) {
  const suite = EvaluationSuite.parse(parse(await readFile(file, "utf8")));
  const identity = `${suite.id}@${suite.version}`;
  if (identities.has(identity)) throw new Error(`Duplicate evaluation suite ${identity}`);
  identities.add(identity);
  if (!suite.metrics.some((metric) => metric.id === suite.primaryMetric)) {
    throw new Error(`${identity} primaryMetric is not declared in metrics`);
  }
}
console.log(`Evaluation suites valid: ${files.length}`);
