import { execFileSync } from "node:child_process";
import { access, cp, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./runtime.mjs";

const gameId = process.argv[2];
if (!gameId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId)) {
  throw new Error("Usage: pnpm game:new -- <kebab-case-game-id>");
}

const target = join(root, "games", "candidates", gameId);
try {
  await access(target);
  throw new Error(`Game already exists: ${target}`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const template = join(root, "platform", "game-template");
await mkdir(join(root, "games", "candidates"), { recursive: true });
await cp(template, target, { recursive: true });
const underscoreId = gameId.replaceAll("-", "_");
const title = gameId
  .split("-")
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join(" ");
const className = title.replaceAll(" ", "");
await rename(
  join(target, "game_packs", "__GAME_ID_UNDERSCORE__"),
  join(target, "game_packs", underscoreId),
);

async function replaceTree(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) await replaceTree(entryPath);
    else {
      const original = await readFile(entryPath, "utf8");
      const updated = original
        .replaceAll("__GAME_ID__", gameId)
        .replaceAll("__GAME_ID_UNDERSCORE__", underscoreId)
        .replaceAll("__GAME_TITLE__", title)
        .replaceAll("__GAME_CLASS__", className);
      await writeFile(entryPath, updated);
    }
  }
}

await replaceTree(target);
execFileSync(process.execPath, [join(root, "tools", "godot", "sync-sdk.mjs")], {
  stdio: "inherit",
});
console.log(`Created ${target}`);
