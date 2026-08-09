import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "./hashing.js";
import type { ArtifactReference } from "./runtime-contracts.js";

export interface ArtifactStore {
  put(id: string, content: unknown, mediaType: string): Promise<ArtifactReference>;
  get(reference: ArtifactReference): Promise<unknown>;
  has(reference: ArtifactReference): Promise<boolean>;
}

export class InMemoryArtifactStore implements ArtifactStore {
  readonly #artifacts = new Map<string, string>();

  async put(id: string, content: unknown, mediaType: string): Promise<ArtifactReference> {
    const bytes = canonicalJson(content);
    const digest = sha256(bytes);
    this.#artifacts.set(digest, bytes);
    return { id, uri: `artifact://${digest}`, sha256: digest, mediaType };
  }

  async get(reference: ArtifactReference): Promise<unknown> {
    const bytes = this.#artifacts.get(reference.sha256);
    if (!bytes || sha256(bytes) !== reference.sha256) {
      throw new Error(`Artifact ${reference.id} is missing or fails integrity validation`);
    }
    return JSON.parse(bytes) as unknown;
  }

  async has(reference: ArtifactReference): Promise<boolean> {
    const bytes = this.#artifacts.get(reference.sha256);
    return bytes !== undefined && sha256(bytes) === reference.sha256;
  }
}

export class FileArtifactStore implements ArtifactStore {
  constructor(readonly root: string) {}

  async put(id: string, content: unknown, mediaType: string): Promise<ArtifactReference> {
    const bytes = canonicalJson(content);
    const digest = sha256(bytes);
    await mkdir(this.root, { recursive: true });
    const path = resolve(this.root, `${digest}.json`);
    await writeFile(path, bytes, { encoding: "utf8", flag: "wx" }).catch(async (error: unknown) => {
      const code = (error as { code?: string }).code;
      if (code !== "EEXIST") throw error;
      const existing = await readFile(path, "utf8");
      if (sha256(existing) !== digest) throw new Error(`Artifact collision at ${path}`);
    });
    return { id, uri: `artifact://${digest}`, sha256: digest, mediaType };
  }

  async get(reference: ArtifactReference): Promise<unknown> {
    const bytes = await readFile(resolve(this.root, `${reference.sha256}.json`), "utf8").catch(
      () => {
        throw new Error(`Artifact ${reference.id} is missing`);
      },
    );
    if (sha256(bytes) !== reference.sha256)
      throw new Error(`Artifact ${reference.id} fails integrity validation`);
    return JSON.parse(bytes) as unknown;
  }

  async has(reference: ArtifactReference): Promise<boolean> {
    return this.get(reference).then(
      () => true,
      () => false,
    );
  }
}
