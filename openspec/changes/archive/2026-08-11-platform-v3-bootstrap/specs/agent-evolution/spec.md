## REMOVED Requirements

### Requirement: Champion and challenger are pinned

**Reason**: The generic champion/challenger registry was implemented before a specific bounded evaluation and promotion need was established.

**Migration**: Preserve prototype history on `platform-v2`; propose concrete agent evaluation through a later human-accepted policy that defines deterministic eligibility, rollback, and separation of duties.

### Requirement: Independent promotion

**Reason**: The bootstrap implements no agent registry, challenger, evaluator, or promotion path; it does not reject future bounded promotion.

**Migration**: Humans permanently retain authority over evaluation and promotion policy. They may later delegate a bounded promotion action under previously accepted deterministic rules, but an affected agent can never approve or promote its own change and missing or ambiguous eligibility evidence must pause for human review.

### Requirement: Improvement requires reproducible evidence

**Reason**: A generic improvement system was built before a specific agent behavior and evaluation need was established.

**Migration**: A later agent change must define task-specific acceptance evidence and fail-closed eligibility without allowing an agent to grant itself authority or alter its own evaluation or promotion policy.

### Requirement: Promoted versions remain reversible

**Reason**: The bootstrap has no promoted agent versions or production agent registry.

**Migration**: Git preserves repository changes; a later deployable agent capability and any delegated promotion rule must define a deterministic rollback target.
