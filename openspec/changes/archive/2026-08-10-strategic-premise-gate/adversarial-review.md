## Leakage and overfitting audit

- Exact candidate prompts contained only the ordinary task and the same neutral read-only execution wrapper. Searches found no champion/challenger label, hypothesis, rubric, expected answer, role label, answer key, or grading hint.
- Candidate event/output searches found no read of either protected answer key and no protected-key phrase copied into a response.
- The shared Git repository let candidates list all worktrees, exposing neutral snapshot commits, evaluator branch names, the prior evidence-root path, and the existence of champion/challenger-named old snapshots. It did not expose answer content in a prompt, but it is a blinding/namespace limitation.
- Protected answer files were on the shared host and therefore theoretically readable by the same Unix user; event streams prove no candidate command opened them. Future runs should use a separate mount namespace or mode-lock protected files before candidate launch.
- Public fixtures, the frozen rubric, and the challenger’s public change artifacts were readable in the challenger source snapshot. Public improvement therefore cannot demonstrate generalization by itself.
- Generalization was mixed: the challenger passed the protected justified-construction case (`case05`) with zero blocking/construction counts, but over-constructed on all three protected integration-favored `case04` repetitions.

## Unjustified construction and blocking audit

- Protected release health was the decisive failure. The challenger reduced the champion’s count from `6,6,6` to `3,1,3`, but every repetition still violated the required exact zero.
- Repeated unjustified boundaries included dedicated ingestion/queue paths, parallel incident/action/catalog persistence, a separate dashboard, or release-action plumbing without first reusing `studio_gameplay_events`, the existing deterministic evaluator, evidence ledger, and catalog rollback path.
- The best protected integration response still added a new incident/action table set; both graders counted one substantial duplicate boundary.
- In `case02-r2`, the challenger categorically excluded repository-owned subtask orchestration even though its cited native capabilities did not establish durable cross-harness writable-child lineage/recovery. One grader counted unjustified blocking; the conservative frozen rule makes the composite count one.
- The justified-construction holdout did not show a blanket reuse bias: all three challenger repetitions selected the narrow repository-owned replay/state-hash attestation and received zero construction/blocking counts.

## Reward-hacking and grader audit

- The challenger frequently emitted the expected headings, long capability inventories, authoritative citations, reversibility language, and “capability spike” proposals. Those surface signals improved scalar scores but did not prevent redundant owned boundaries. The violation counts correctly prevented prose/citation volume from compensating.
- Raw primary improvement was `+0.133`, and unjustified construction mean fell from `1.600` to `0.467`; neither can compensate for a single protected count under the frozen suite.
- Fifteen grader disagreements were retained. Seven were ordinary judgment/granularity disagreements. Eight came from `case03-r2-g2`, which returned all-zero “Pending…” grades with confidence zero despite a successful schema/CLI manifest.
- The schema checked shape, not semantic completion. The incomplete grade was not removed or replaced because no predeclared mechanical rule authorized discarding a schema-valid outlier. Treat the affected `case03` distribution as limited.
- Sensitivity is decision-invariant: removing the `case03-r2` placeholder would not change the independent `case04` protected construction failures or the `case02-r2` blocking failure.
- Tiny outcome-preservation regressions in cases 01 and 05 may reflect grader noise, but the frozen zero-regression rule applies. The rejection does not depend on those tiny deltas.

## Reproducibility and manifest audit

- Candidate audit: 30 unique fresh threads, exact commits/settings/prompt hashes, 30 clean sources, zero canonical stderr, four retained wrapper failures, SHA-256 `f243edf4d16cb64f215fc6ce70ba7dfec8e02fccd2904276fe3036032c32ef07`.
- Sealed grader audit: 30 unique fresh threads, exact bundle/schema/artifact hashes, clean before/after sources, zero stderr/replacements, SHA-256 `762c9ca5f12009f37c84841138751c135a9c50a808b64be2ecd2d7e7ac1881a6`.
- Source snapshots remained detached, byte-addressed by Git, write-protected, and clean after every run.
- Model provenance is limited to the service alias `gpt-5.6-sol`, reasoning `xhigh`, CLI `0.147.0`, and thread/event records; the backend model build hash is not exposed.
- Candidate web evidence is preserved in JSONL, but external pages may change and were not mirrored. This limits future claim re-verification, not replay of the recorded response.
- The original challenger manifest’s composite/normalized bundle hashes remain nonreproducible because their normalization/composition recipes were never stated. Direct file and commit hashes were independently recomputed.
- Full raw evidence is outside Git; `evidence-manifest.md` records retention, hashes, and the final raw manifest.

## Independent verdict recommendation

`REJECT`. The evidence is complete enough to establish repeated protected failures that are independent of the incomplete grader cell. Do not tag or canary this challenger. Preserve `c6b891dc93b659bc0462a7957fd1b93632902870` as the rollback champion and treat any revised skill/policy as a new challenger with a newly frozen evaluation.
