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

## Suggested Next Build Order

1. Establish monorepo/app skeleton with module boundaries
2. Define shared schemas and runtime validation
3. Implement workspace + auth + audit foundations
4. Implement document/TB ingestion pipelines
5. Implement reconciliation gate before mapping
6. Add mapping and adjustment proposal flows
7. Add deterministic summary and INK2 draft population
8. Add export and sealed filing flow

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
