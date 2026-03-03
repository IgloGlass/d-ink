# D.ink Single Source of Truth

Status: Living document  
Last updated: 2026-03-03  
Owner: Product + Engineering

## Purpose

This document is the canonical implementation baseline for D.ink.
When existing documents conflict, this file wins.

## Precedence

1. `SINGLE_SOURCE_OF_TRUTH.md` (this file)
2. `AGENTS.md` for engineering constraints and modularity rules
3. Functional and architecture docs as reference material

## Product Definition

D.ink is an AI-assisted tax return drafting and review app for Swedish corporate income tax (INK2), focused on small and mid-sized companies and non-specialist accountants.

Core principle: AI proposes, humans review/approve, deterministic code computes final totals and form population.

## Resolved Discrepancies (as of 2026-02-24)

### 1) Roles (V1)

V1 role model is:

- `Admin`
- `Editor`

`Preparer`/`Reviewer` split is deferred to V2 unless explicitly reintroduced.

### 2) Hosting, auth, and AI integration

V1 is demo-first and simplified:

- Frontend: Cloudflare Pages
- API/worker runtime: Cloudflare Workers
- Database: Cloudflare D1
- Files/artifacts: Cloudflare R2
- Async jobs: Cloudflare Queues (or equivalent worker-driven async pattern)
- AI calls: provider API key stored server-side as a secret; never exposed to client code

V1 auth:

- invite-based email magic-link sign-in
- one-time, short-lived login tokens
- role assignment in app (`Admin` or `Editor`)
- no password flow in V1 (deferred)
- no SSO in V1

V2 target:

- Azure deployment
- Entra ID SSO
- Enterprise-grade identity/access controls

### 3) Workflow status model

Use explicit persisted workspace statuses:

- `draft`
- `in_review`
- `changes_requested`
- `ready_for_approval`
- `approved_for_export`
- `exported`
- `client_accepted`
- `filed` (locked/sealed workspace)

### 4) Annual report input formats

V1 supports annual report upload as:

- PDF
- DOCX

Additional evidence upload types (images, email attachments, other ad hoc files) are V2.

### 5) Clarification: explicit state machine vs derived state

Conflicting statements existed:

- One doc said "no explicit state machine; status derived from artifacts/jobs"
- Another defined explicit workflow transitions

Decision:

- V1 uses an explicit state machine for workspace status (for clarity, auditability, and demo predictability)
- "Blocking" and "Needs review" remain derived indicators for UI and gating, but they do not replace workflow status

Recommended transition matrix (V1 baseline):

- `draft -> in_review`
- `in_review -> changes_requested`
- `changes_requested -> draft`
- `in_review -> ready_for_approval`
- `ready_for_approval -> approved_for_export`
- `approved_for_export -> exported`
- `exported -> client_accepted`
- `client_accepted -> filed`
- `approved_for_export -> draft` (reopen, audited)
- `exported -> draft` (reopen, audited)
- `client_accepted -> draft` (reopen, audited)
- `filed -> draft` (admin-only reopen with required reason + audit event)

## V1 Scope

- Swedish AB
- K2 and K3
- Single entities and small groups
- Template-first TB import with free-form fallback and disclaimer
- Human-in-the-loop review workflow
- Draft INK2 output with auditability

## V1 Out of Scope

- Branches/permanent establishments
- Withholding-heavy scenarios
- Advanced cross-border tax
- Complex net interest limitation cases
- Automated filing submission
- Extra evidence upload types beyond annual report/TB
- Azure/SSO enterprise identity stack

## Non-negotiable Engineering Rules

- Hard module boundaries and contract-first schema design (`AGENTS.md`)
- Deterministic calculations/forms/exports, AI for proposals only
- Versioned artifacts, no silent overwrites
- Append-only audit events for all material actions
- Structured errors and structured logs
- Structured AI reasoning must use versioned module/policy configs (not prompt prose as source of truth)

## AI Reasoning Baseline (V1+)

AI reasoning configuration is a first-class artifact and must be managed with:
- `module-spec` (contracts, gates, runtime, audit fields)
- `policy-pack` (ordered decision rules + fallback/review behavior)
- `policy-patch` (minimal hotfix overlays)

Reference baseline:
- `references/ai-module-spec-v1.md`
- `references/templates/ai-module-spec.template.json`
- `references/templates/ai-policy-pack.template.json`
- `references/templates/ai-policy-patch.template.json`

Operational rule:
- Update policy files first when fixing AI behavior.
- Keep prompts thin and generic.
- Persist `promptVersion`, `policyVersion`, and active patch versions in run metadata.

## Open Items to Finalize

All previously open V1 core items below are now locked for implementation:

- Tax rate configuration (V1): `20.6%` for fiscal year end on or after `2021-01-01`; out-of-range years must return structured `INPUT_INVALID`.
- Initial adjustment submodules (V1):
  - `non_deductible_expenses`
  - `representation_entertainment`
  - `depreciation_differences_basic`
  - `manual_review_bucket`
- Initial INK2 field coverage (V1 draft):
  - `INK2R.profit_before_tax`
  - `INK2S.non_deductible_expenses`
  - `INK2S.representation_non_deductible`
  - `INK2S.depreciation_adjustment`
  - `INK2S.other_manual_adjustments`
  - `INK2S.total_adjustments`
  - `INK2S.taxable_income`
  - `INK2S.corporate_tax`

### V1 Core Completion Lock (2026-03-03)

- Delivery order:
  1. Annual report extraction (hybrid manual-first)
  2. Tax adjustments
  3. Deterministic tax summary
  4. INK2 draft form
  5. PDF export
  6. Comments/tasks collaboration
- Roles remain `Admin` and `Editor`.
- Scope remains strict V1 (no V2 scaffolding in this batch).

## Change Log

- 2026-02-24: Created and resolved V1 discrepancies listed above.
- 2026-02-24: Locked V1 authentication to invite-based magic-link (no passwords in V1).
- 2026-03-02: Adopted structured AI reasoning baseline with versioned `module-spec` / `policy-pack` / `policy-patch` governance.
- 2026-03-03: Locked V1 core completion decisions for annual extraction, adjustments, tax summary, INK2 draft coverage, PDF export gating, and collaboration inclusion.
