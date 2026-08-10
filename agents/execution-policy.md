# Decision-efficient execution

## Objective

Reach the earliest trustworthy decision or usable artifact. More context, probes,
repetitions, and documentation are costs and sources of drift; they are not evidence of
quality by themselves.

## Task packet

Before launching consequential work, record:

- the decision or artifact the task must produce;
- the cheapest high-discrimination checks and the minimum sufficient evidence;
- hard stop conditions, a maximum of two automated reruns, and the human-review or park
  disposition when that limit is exhausted;
- a maximum number of new probes or evaluation-only artifacts;
- unavailable external dependencies; and
- the condition that requires a checkpoint and a fresh task or thread.

If these are absent, narrow the packet before execution. Do not compensate with a longer
prompt or broader exploration.

## Work order

1. Read canonical task artifacts, relevant diffs, and targeted source. Do not reread large,
   unchanged inputs merely because context is available.
2. Run the cheapest checks most likely to decide the outcome.
3. When a hard failure may decide the outcome, reproduce it once if reproduction adds
   confidence.
4. Stop work that cannot change the decision. Write the verdict, smallest repair boundary,
   and accounted unknowns before optional evidence.
5. Run expensive matrices, broad platform checks, or participant studies only while the
   candidate remains eligible for the claim they support.

## Stop rules

- `stop-and-report`: stop when a frozen decision rule is resolved, acceptance becomes
  impossible, or the requested artifact is complete.
- `record-unmet`: record an unavailable person, device, service, credential, or platform
  once as unmet or unknown. Do not simulate it, hide it, or build new infrastructure for it
  unless that construction is the accepted task.
- Honor the declared retry limit. Preserve the first failure and every retry; do not keep
  retrying a stable blocker.
- Never run more than two automated reruns. If the second rerun still cannot satisfy the task
  or its required evidence, stop automation and use the frozen disposition: request human
  review or park the task. Never emit a third rerun.
- Continue after a decisive failure only for safety, security, data preservation, or the
  minimum evidence needed to identify a repair. State that reason in the record.

Minimum repetitions apply to acceptance or improvement claims. A reproducible hard failure
may reject a candidate without completing repetitions that cannot reverse the verdict.
An acceptance or promotion verdict is valid only when every frozen acceptance-required gate
is `pass`. A required `fail`, `unmet`, `unknown`, or deliberately unrun gate prohibits
acceptance; recording missing evidence never converts it into a pass.
"Complete results" means every planned item is accounted for as pass, fail, unmet, unknown,
or not run after a decisive stop; it does not mean executing irrelevant work.

## Context and harness discipline

- Git and OpenSpec are canonical state. A harness transcript is an optional cache.
- Prefer a fresh thread from a coherent checkpoint when accepted artifacts can reconstruct
  the task more cheaply than resuming a large context.
- Use hashes, status, diffs, indexes, and targeted ranges to avoid rereading unchanged
  artifacts.
- Do not create a custom harness, evidence framework, orchestration layer, or large probe
  suite when existing commands or one minimal probe can answer the decision question.
- A more capable or longer-running model is permission to solve harder decisions, not a
  reason to enlarge the task.

## Handoff

Lead with the outcome. Report decisive evidence, work deliberately not run, residual
unknowns, exact checkpoints, and the next smallest task. Never describe intentional early
stopping as incomplete evidence.
