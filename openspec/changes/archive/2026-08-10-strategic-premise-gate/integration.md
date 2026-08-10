## Integration record

- Independent evaluator commit: `1bce98da1f495c161b23eb24690db092495a00cb`.
- Integrated `platform-v2` evidence commit: `57cb259` before archive.
- Verdict: `REJECT`; no skill version, promotion tag, or canary was created.
- Archive command used `--skip-specs`, so the rejected challenger did not modify canonical capability specifications.

## Raw evidence retention

- Original evaluator root: `/var/tmp/nofi-strategic-premise-eval-codex-hydBis/`.
- Retained local archive: `.artifacts/evals/strategic-premise-gate/2026-08-10-codex.tar.gz`.
- Evidence manifest SHA-256: `4fd61a2f97aac463af5cd182f0fd39f848a18ac2574d34a0711c875a1538141e`.
- Archive SHA-256: `97ed21d5f5352ef85f5fbab481ccdb0fcd6ab1ca85d53f7fbe3633876a04556f`.
- Copy verification before compression: all 1,099 manifest entries passed and zero failed. The archive contains 1,400 filesystem entries and its embedded evidence manifest retains the expected hash.

The `.artifacts` archive is intentionally ignored by Git because it contains raw traces. It is durable against `/var/tmp` cleanup on this workstation but is not a remote backup. The compact evidence, hashes, limitations, and decision remain versioned in this archive.

The evidence MUST remain opaque while stored inside the repository tree. An initial expanded copy caused Vitest to discover historical snapshot tests even though `.artifacts` is Git-ignored. Compressing the evidence removed it from source discovery; future large evidence should use an opaque archive or external object store rather than an expanded ignored directory.

## Integration verification

- `pnpm check`: pass.
- `pnpm build:web`: pass.
- Strict OpenSpec change validation before archive: pass.
- OpenSpec status before archive: complete.
- Archive result: `2026-08-10-strategic-premise-gate`, specs not updated.
