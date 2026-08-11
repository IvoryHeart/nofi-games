## REMOVED Requirements

### Requirement: Run records remain operational

**Reason**: The bootstrap implements no run-record store, and the hypothetical capability duplicates the facts-not-authority constraint already owned by `studio-execution-boundary`.

**Migration**: Keep future run-record ownership and authority constraints in the studio execution boundary. Introduce a concretely named run-record capability only alongside an accepted implementation that needs persistent operational state.
