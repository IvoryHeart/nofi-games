## MODIFIED Requirements

### Requirement: Version-pinned workflow records

Every consequential workflow run SHALL pin its Git commit, OpenSpec change, workflow, agents, models, prompts, skills, tools, inputs, outputs, evaluation suite, baseline, and event history. Every agent-executed stage SHALL additionally pin its session policy, provider, provider-reported model, opaque conversation and response identifiers, idempotency key, attempt, lease, input checkpoint, output checkpoint, and resume parent without storing provider credentials.

#### Scenario: Behavior changes between runs

- **WHEN** two runs produce different outcomes
- **THEN** the ledger SHALL expose the version, session, checkpoint, policy, provider, model, and input differences needed to investigate the divergence

#### Scenario: Product database is unavailable

- **WHEN** a local governed task starts or resumes without Supabase
- **THEN** its versioned Git and OpenSpec records SHALL preserve the task, accepted checkpoints, evidence, and decision trail

## ADDED Requirements

### Requirement: Model usage and estimated cost are attributable

Every model call SHALL record provider-reported input, cached-input, cache-write, output, and reasoning tokens when available, plus the versioned price schedule used to estimate cost. Unsupported usage fields SHALL be recorded as unavailable rather than inferred.

#### Scenario: Cached context is reused

- **WHEN** a provider reports cached-input or cache-write tokens
- **THEN** the ledger SHALL preserve those values on the exact attempt and include them in estimated cost reporting

#### Scenario: Price schedule changes

- **WHEN** a later run uses different provider pricing
- **THEN** prior estimated costs SHALL remain reproducible from their pinned price-schedule version

### Requirement: Checkpoints are immutable and content addressed

Every accepted session checkpoint SHALL pin the hashes of its structured state, source artifacts, evidence manifest, and output contract.

#### Scenario: Session resumes after compaction

- **WHEN** a new or compacted conversation continues a workstream
- **THEN** the ledger SHALL identify the exact accepted checkpoint used to seed it and preserve the prior session as history

### Requirement: Secrets are excluded from agent evidence

The ledger SHALL reject provider keys, Supabase service credentials, access tokens, and raw secret-bearing environment values from manifests, events, checkpoints, and model inputs.

#### Scenario: Diagnostic contains an environment value

- **WHEN** an execution error includes a configured secret value
- **THEN** the runtime SHALL redact the value before persisting or returning the diagnostic
