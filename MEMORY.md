# D.ink Project Memory

Status: Living project memory for AI-assisted development  
Last updated: 2026-03-03

## Current Product Snapshot

- Product: AI-assisted INK2 drafting and review for Swedish AB (K2/K3)
- Audience: small accounting firms and non-tax specialists
- Primary value: faster, more consistent draft returns with human review

## Active Canonical Docs

- `SINGLE_SOURCE_OF_TRUTH.md` (top priority for product/architecture decisions)
- `AGENTS.md` (engineering constraints and coding workflow)
- `V2_ROADMAP.md` (planned evolution beyond V1)
- `references/ai-module-spec-v1.md` (structured AI reasoning baseline)
- `docs/ui-ux-architecture-v1.md` (UI architecture alignment and premium UX direction; pre-implementation)

## Confirmed Decisions

1. V1 roles: `Admin`, `Editor`
2. V1 stack: Cloudflare Pages + Workers + D1 (+ R2/Queues as needed)
3. V1 AI integration: API key stored server-side; never client-exposed
4. Azure + SSO deferred to V2
5. V1 authentication: invite-based email magic-link sign-in (no passwords in V1)
6. V1 annual report formats: PDF and DOCX
7. Additional evidence uploads deferred to V2
8. Workflow uses explicit persisted state machine
9. `filed` status is locked/sealed; admin-only reopen with reason + audit
10. AI reasoning is managed through versioned `module-spec` + `policy-pack` + `policy-patch` files, not long free-form prompt logic

## Guardrails That Must Not Drift

- Human-in-the-loop by default
- Deterministic calculations and final form population
- AI outputs must be schema-validated structured data
- Hard module boundaries and contract-first interfaces
- Append-only audit trail and versioned artifacts
- Structured AI reasoning rules externalized in versioned policy artifacts

## Outstanding Questions

- V1 auth UI: admin invite flow UX (generate/copy link action in admin area)

Resolved in this batch:

- Initial adjustment submodules are locked to:
  - `non_deductible_expenses`
  - `representation_entertainment`
  - `depreciation_differences_basic`
  - `manual_review_bucket`
- V1 INK2 draft fields are locked to:
  - `INK2R.profit_before_tax`
  - `INK2S.non_deductible_expenses`
  - `INK2S.representation_non_deductible`
  - `INK2S.depreciation_adjustment`
  - `INK2S.other_manual_adjustments`
  - `INK2S.total_adjustments`
  - `INK2S.taxable_income`
  - `INK2S.corporate_tax`
- Tax rate rule is locked to `20.6%` for fiscal year end >= `2021-01-01`; out-of-range years return `INPUT_INVALID`.

## Current Gap Statement (Leadership View)

- Backend framework and core scaffolding are largely in place.
- Main gaps are now product-critical module depth and user-facing confidence:
  - Strong, realistic UI/UX is not yet complete.
  - AI reasoning/policy depth is incomplete in key tax modules.
  - Tax-adjustment submodules are not fully implemented to intended V1 depth.
  - Deterministic tax-calculation logic is not yet complete.
  - INK2 form engine with full field-code behavior is not yet complete.
  - Annual-report extraction requires explicit finalization of:
    - what information must be extracted,
    - where/how it is stored,
    - how it influences downstream module reasoning.

## Chronological Build Pipeline (Active Priority)

1. UI quality pass first (make the app visually strong and realistic for testing feedback).
2. Annual report module specification:
   - extraction target fields,
   - persistence schema/artifacts,
   - downstream influence contract for mapping/adjustments.
3. Annual report AI extraction implementation:
   - module-spec + policy-pack + policy-patch,
   - schema validation and audit-linked run metadata.
4. Account mapper implementation (logic + UX):
   - deterministic/AI boundary,
   - override flows and reviewer clarity in UI.
5. Tax adjustments core:
   - implement/complete V1 submodules,
   - proposal + override + acceptance lifecycle.
6. Deterministic tax calculation engine:
   - totals, dependencies, rounding/sign conventions, tax rate application.
7. INK2 form engine with field codes:
   - code-level mapping, validations, approvals, and draft integrity checks.
8. End-to-end hardening:
   - workflow integration tests, audit completeness checks, pilot-readiness pass.

Execution rule:
- Build sequentially in this order; do not start the next phase until current phase meets `npm run check` and phase acceptance criteria.

## Update Protocol

When a major product or architecture decision changes:

- update `SINGLE_SOURCE_OF_TRUTH.md`
- append a short note in this file under "Memory Updates"
- update `V2_ROADMAP.md` if roadmap impact exists

## Documentation Sync Checklist (Required per decision change)

1. Classify the change as one of:
   - V1-only
   - V1+V2-impact
   - V2-only
2. Update `SINGLE_SOURCE_OF_TRUTH.md` if V1 behavior/constraints changed.
3. Perform a mandatory V2 impact check:
   - If impact exists: update `V2_ROADMAP.md` in the relevant track + changelog.
   - If no impact: record "No V2 roadmap impact" in the working summary.
4. Append the decision to `MEMORY.md` under "Memory Updates".
5. In delivery summary, explicitly include:
   - `Roadmap update: yes` or
   - `Roadmap update: no (reason)`

## Memory Updates

- 2026-02-24: Initial project memory created from current docs and resolved discrepancies.
- 2026-02-24: V1 auth decision finalized as invite-based magic-link sign-in (no password flow in V1).
- 2026-02-24: Added V1 backlog reminder for admin UI action to generate and copy invite links.
- 2026-03-01: Completed architecture hardening pass to remove route-layer persistence coupling, enforce runtime API response contract parsing on the client, and centralize audit SQL helpers.
- 2026-03-01: Added automated dependency boundary checks (`lint:boundaries`) to block circular dependencies and key layer violations as part of the required `check` pipeline.
- 2026-03-02: Added `TrialBalanceNormalizedV1` contract and deterministic parser for common Excel/CSV formats with sheet scoring, synonym-based header matching, locale-aware numeric parsing, explicit rejected-row diagnostics, and verification gating.
- 2026-03-02: Locked initial V1 TB canonical columns to `Account Name`, `Account Number`, `Opening Balance`, `Closing Balance` with duplicate account-number suffixing (`.1`, `.2`, ...) for deterministic uniqueness.
- 2026-03-02: Adopted structured AI reasoning baseline (`module-spec` + `policy-pack` + `policy-patch`) and added reference templates/examples to support auditable, patch-friendly policy updates.
- 2026-03-03: Locked strict V1 core completion order (annual extraction -> adjustments -> summary -> INK2 -> PDF export -> comments/tasks) and kept roles as `Admin`/`Editor`.
- 2026-03-03: Established stabilized Tickets 1-5 baseline anchor for restart/recovery and release traceability under tag `baseline-2026-03-03-tickets-1-5`.
- 2026-03-03: Restored `npm run` reliability baseline by enforcing LF via `.gitattributes`, normalizing Biome formatting/import order, and adding Node 20.x test runtime guard + deterministic server stress harness.
- 2026-03-03: Completed risk-focused HTTP orchestration review and refactor artifact in project memory. Findings triage: `P0=0`, `P1=0`, `P2=1` (route-layer error-envelope duplication in `src/server/http/workspace-routes.v1.ts`), mitigated by consolidating mapping through `createServiceFailureResponseV1` plus focused unit coverage in `tests/server/http/http-helpers.v1.test.ts`.
- 2026-03-03: Recorded active leadership-prioritized chronological pipeline: UI first, then annual-report specification/AI extraction, account mapper, tax adjustments, deterministic tax calculation, INK2 field-code engine, and end-to-end hardening.
- 2026-03-03: Added formal pre-build UI architecture spec in `docs/ui-ux-architecture-v1.md` with Deloitte-aligned design guardrails, search-first workspace selection, ordered core-module workbench, tabbed module shell, and sidebar-based submodule navigation pattern.
- 2026-03-03: Locked UI product decisions for implementation: hybrid premium structure (search-first selector + ordered module cards), selector fields baseline, always-editable modules with advisory sequence guidance, module label `Tax Return INK2`, advanced controls hidden by default, and inclusion of a group-level control panel.
- 2026-03-03: Locked frontend execution choices for the makeover program and captured sequential delivery plan in `docs/frontend-build-plan-v1.md` (desktop-first, smart suggestions, i18n-ready English-first, minimal Admin/Editor UI divergence, complete visual overhaul).
- 2026-03-03: Added explicit design reference pack in `docs/ui-design-references-v1.md` to anchor implementation against Deloitte-style visual and interaction standards, token baselines, and accessibility guardrails.
- 2026-03-03: Added precedence-locked UI directive pack in `docs/ui-design-references-v4-ai-builder.md`; rule is now explicit that this V4 AI Builder spec overrides conflicting UI guidance.
- 2026-03-03: Added companion UI directive pack `docs/ui-design-references-v3-final.md` and reconciled governance hierarchy: V4 (hard tokens/strict CSS) -> V3 (interaction/atmosphere) -> V1 (index/governance), then IA and core product constraints.
- 2026-03-03: Updated UI governance to recency-first precedence per latest instruction: V3 now overrides V4 on overlap; V4 remains detailed fallback where V3 is silent.
- 2026-03-03: Corrected UI precedence after clarification: V4 is newest and now has final precedence over V3 on overlap; V3 is retained as fallback where V4 is silent.
- 2026-03-03: Implemented frontend overhaul cutover for primary V1 shell: V4 tokenized light theme foundation, fixed 56px global header, Ctrl+J workspace context launcher, i18n scaffolding (English active), new IA routes (selector, group control panel, workbench, module shell), compatibility redirects, tax-adjustments grouped sidebar with pinned final-calculation panel, and premium INK2 replica canvas. Added client integration tests for selector/workbench/module shell navigation.
- 2026-03-03: Account-mapping module now uses virtualized row rendering in the new shell with `View All`/`Exceptions Only`, search-first category override UI, and inline AI command preview adapter. `@tanstack/react-virtual` package installation was blocked locally by npm auth/runtime constraints, so V1 ships with an internal deterministic virtualizer implementation pending dependency-install remediation.
