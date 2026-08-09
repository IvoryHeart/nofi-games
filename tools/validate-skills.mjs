import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import YAML from "yaml";

const root = resolve("agents/skills");
const failures = [];
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillPath = join(root, entry.name, "SKILL.md");
  const openaiPath = join(root, entry.name, "agents", "openai.yaml");
  const skill = await readFile(skillPath, "utf8");
  const match = skill.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    failures.push(`${entry.name}: invalid SKILL.md frontmatter`);
    continue;
  }
  const metadata = YAML.parse(match[1]);
  if (metadata.name !== entry.name) failures.push(`${entry.name}: name does not match folder`);
  if (typeof metadata.description !== "string" || metadata.description.length < 80) {
    failures.push(`${entry.name}: description is not sufficiently specific`);
  }
  if (skill.includes("TODO")) failures.push(`${entry.name}: unresolved TODO`);

  const openai = YAML.parse(await readFile(openaiPath, "utf8"));
  if (!openai?.interface?.default_prompt?.includes(`$${entry.name}`)) {
    failures.push(`${entry.name}: default prompt does not mention the skill`);
  }
}

if (failures.length) throw new Error(`Skill validation failed:\n${failures.join("\n")}`);
console.log("Project skills valid");
