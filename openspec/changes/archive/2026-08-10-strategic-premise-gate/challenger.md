## Champion manifest

- Source: Git commit `c6b891dc`
- Repository instructions (`AGENTS.md`): `45c11b6210403da15400068955dbb0b48221a19b58ca25ecb753e840fa316236`
- Strategic-premise skill: absent; empty-content hash `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Normalized agent tool policy: `3fae5fb4df9a58a64822a64581413fe2c1ae80b15ea2a9aba9f4602f80a6cc28`
- Normalized agent-evolution workflow: `7bc2b762d944d86c620d722bfc9296e255a9234303309b61595dde8bf7702b20`
- Agent-evolution promotion policy: `042d1fb9914fd057636f1b618528787734bfed2d5f0ce8aecbc46f2199d8e8b4`
- Model assignment: pinned per evaluation run and identical between paired champion/challenger repetitions; policy identity hash `47ac6ac7b9b38b39caa0e286f9ac9504f44f55820f55005fb893d4ee0498a73d`

## Challenger manifest

- Source: working challenger for `strategic-premise-gate`; final Git commit is recorded in `results.md`
- Repository instructions (`AGENTS.md`): `7cb9896b8f3fdeebb5d881ab689efec21311c6ef7d5a1a2c893ba138a3d6a247`
- Skill (`agents/skills/validate-strategic-premise/SKILL.md`): `22b11a156319aa933f78b5a4a3c1add0fef3593826a8929e554e309101e3995a`
- Premise enforcement bundle: `bef5fd8960c5f2f0fcad83c2e6dec23152995da4d26806b3448c238af3af858c`
- Public evaluation bundle: `4b8f9f0cfda4c2e02715f09a7da4b0d0619736792d06211a569f15c2ad562074`
- Normalized agent tool policy: `3fae5fb4df9a58a64822a64581413fe2c1ae80b15ea2a9aba9f4602f80a6cc28` (unchanged)
- Normalized agent-evolution workflow: `7bc2b762d944d86c620d722bfc9296e255a9234303309b61595dde8bf7702b20` (unchanged)
- Agent-evolution promotion policy: `042d1fb9914fd057636f1b618528787734bfed2d5f0ce8aecbc46f2199d8e8b4` (unchanged)
- Model assignment: same pinned harness/model pairing as champion; policy identity hash `47ac6ac7b9b38b39caa0e286f9ac9504f44f55820f55005fb893d4ee0498a73d`

## Exact diff boundary

The behavioral challenger adds only:

1. `validate-strategic-premise` instructions and metadata;
2. the `AGENTS.md` trigger and non-bypass rule;
3. the system-change `strategic-premise` prerequisite, template, project rules, and structural validator;
4. the frozen public fixture/rubric/suite definitions.

The concurrent removal of the rejected direct-provider runtime is evaluated by `native-harness-workflow`, not credited as challenger performance. Allowed tools, agent-evolution stages, promotion policy, game/product behavior, and paired run model assignments remain equivalent.

## Rollback target

Restore the champion behavior from `c6b891dc` by removing the skill/gate files and reverting the listed `AGENTS.md`, OpenSpec schema/config, and validation-script diff. Do not restore the rejected direct-provider runtime merely to roll back this agent skill.
