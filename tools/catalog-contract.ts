import { z } from "zod";

export const Identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const IsoDateTime = z.iso.datetime({ offset: true });

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
  localPackPath: z.string().min(1),
  packSha256: Sha256,
  rolloutBasisPoints: z.number().int().min(0).max(10_000),
  rollbackVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  status: z.enum(["fixture", "candidate", "canary", "live", "retired"]),
});

export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z.object({
  schemaVersion: z.literal(1),
  generatedAt: IsoDateTime,
  entries: z.array(CatalogEntry),
});

export type Catalog = z.infer<typeof Catalog>;
