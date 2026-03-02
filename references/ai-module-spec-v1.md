# AI Module Spec V1

## Why this exists
Use one consistent file format for every AI module/submodule so reasoning stays coherent, deterministic boundaries stay intact, and logic can be patched quickly without rewriting large prompts.

This standard is designed to fit the current architecture:
- module boundaries from `AGENTS.md`
- schema-first contracts in `src/shared/contracts`
- immutable run artifacts
- auditability and scoped overrides

## Core pattern
Every AI module should be configured by three files:
- `module-spec.json`: runtime wiring, contracts, gates, and audit fields
- `policy-pack.json`: ordered decision rules and fallbacks
- `policy-patch.json` (optional): narrow hotfix overlay for production issues

Prompts should stay thin and generic. Domain logic should live in `policy-pack.json`.

## Recommended location
- `src/server/ai/modules/<module-id>/module-spec.v1.json`
- `src/server/ai/modules/<module-id>/policy-pack.<policyVersion>.json`
- `src/server/ai/modules/<module-id>/policy-patch.<patchVersion>.json`
- `src/server/ai/modules/<module-id>/prompts/system.v1.txt`
- `src/server/ai/modules/<module-id>/prompts/user.v1.txt`

## Rules for coherence
1. One module, one responsibility.
2. Input and output must reference shared contracts by name and version.
3. All model decisions must map to `policyRuleReference` IDs.
4. Use codes in model output, resolve labels in deterministic code.
5. Fallback behavior must be explicit and deterministic.
6. Low-confidence or ambiguous decisions must raise `reviewFlag`.
7. Never let model prose drive computations.

## Patching model behavior safely
When behavior is wrong in production:
1. Add a minimal patch file (`policy-patch`) with targeted operations.
2. Keep base policy unchanged.
3. Activate patch by updating `activePatchVersions` in `module-spec`.
4. Run module unit tests + boundary contract tests + golden cases.
5. Persist new run artifacts with updated `policyVersion` and `patchVersion`.

Do not edit prompt text first. Patch rules first.

## Versioning conventions
- `module-spec` version tracks framework shape (`ai_module_spec_v1`).
- `moduleVersion` tracks implementation lifecycle (`v1`, `v2`).
- `policyVersion` tracks base decision logic (`mapping-bas.v1`).
- `patchVersion` tracks hotfix overlays (`mapping-bas.v1-p1`).
- Breaking output contract change requires new contract version and migration.

## Audit minimum
Store at least:
- `moduleId`, `moduleVersion`
- `promptVersion`
- `policyVersion`
- `activePatchVersions`
- `inputArtifactRefs`
- `outputArtifactRef`
- `modelProvider`, `modelName`
- `decisionCount`, `reviewFlagCount`

## Output discipline
Model output should include only structured fields required by downstream modules, for example:
- `decisionId`
- `proposedCategoryCode`
- `selectedCategoryCode`
- `confidence`
- `reviewFlag`
- `policyRuleReference`
- `evidence[]`

No markdown tables, no conversational confirmation messages.

## Rollout strategy
1. Introduce one AI submodule first (for example mapping suggestions only).
2. Keep deterministic module as source of truth until confidence is proven.
3. Compare AI output against deterministic/golden cases.
4. Promote only after measurable stability.

