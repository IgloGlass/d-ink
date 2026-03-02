# Mapping Review Module (V1)

This module proposes AI-assisted mapping override suggestions.

## Boundary

- Deterministic mapping output is the initial source of truth.
- AI is advisory only and cannot auto-apply category changes.
- Final persisted changes must go through `applyMappingOverridesV1`.

## Files

- `module-spec.v1.json`: runtime and contract metadata
- `policy-pack.mapping-review.v1.json`: versioned decision policy
- `prompts/system.v1.txt`: thin system prompt
- `prompts/user.v1.txt`: input/output instruction template

## Update workflow

1. Patch `policy-pack` (or add `policy-patch`) for behavior changes.
2. Keep prompts thin; avoid putting domain logic in prompt prose.
3. Re-run module tests and mapping contract/golden tests.

