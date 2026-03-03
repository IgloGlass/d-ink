# Senior Engineering Review and Next-Ticket Plan

Date: 2026-02-25
Scope reviewed: current V1 scaffold implementation against product and engineering vision docs.

## Executive summary

The codebase is in a strong **foundation phase**: contracts-first schemas, workflow/auth/audit baseline, and tenant-scoped CRUD + transitions are implemented with tests. The implementation currently aligns best with a **Platform Foundation slice** of the target vision, but most tax-domain modules (parsing, validation, mapping, adjustments, calculation, forms, exports) are still intentionally absent.

In short:
- **What is solid now:** schema validation, deterministic workflow transitions, invite magic-link auth, audited workspace lifecycle events, modular service/repository layering.
- **What is missing vs vision:** the core tax pipeline modules, artifact versioning model, richer role/governance model, ingestion/extraction, and deterministic INK2 outputs.

## What has been implemented so far (observed)

### 1) Contract-first and boundary-driven scaffolding is real
- Shared Zod contracts exist for workspace, workflow transitions, auth, and audit event payloads.
- Service-layer workflows parse/validate inputs and return structured failures with `code/message/context/user_message`.
- Worker routes delegate to module-specific HTTP handlers.

Assessment: this strongly matches the AGENTS requirement of strict contracts and thin handlers.

### 2) Workflow baseline exists with explicit status transitions
- Workspace statuses are explicitly defined and validated.
- Transition evaluator exists as a deterministic module, with specific rules (including filed -> draft reason handling and actor role constraints).
- Client UI supports status transition operations and reflects status.

Assessment: aligns with SINGLE_SOURCE_OF_TRUTH decision to use explicit persisted workflow states.

### 3) Invite-based magic-link auth is implemented end-to-end
- Auth workflow includes invite creation, token consumption, session auth, and logout routes.
- Client includes session gate + invite admin page and role guard (`Admin` only for invite creation).

Assessment: aligns with V1 auth decision in canonical docs.

### 4) Persistence and audit foundation is present
- D1 migrations and repositories are present for workspace/audit/auth tables and operations.
- Lifecycle services append audit events when creating/transiting workspaces.
- Repository and workflow tests are present, including contract tests and worker integration-ish tests.

Assessment: good early implementation of auditability and modular persistence.

## Alignment vs the documented vision

## Strong alignment areas

1. **Human-in-the-loop and deterministic boundaries (partial but correct direction):**
   - The existing deterministic workflow logic is separated from HTTP and UI.
   - Structured contracts and runtime validation are used extensively.

2. **Modularity and isolation (good early compliance):**
   - Current implementation keeps business behavior in `server/workflow` and persistence in `db/repositories`.
   - Thin routing pattern is present.

3. **Auditability (early but meaningful):**
   - Workspace creation and transition actions are audited.
   - Audit contract has versioning (`v1`, `v2`) and tests, which is a positive sign for evolution discipline.

## Gaps / drift to address

1. **Core tax modules not yet started** (expected for current maturity but critical next):
   - Missing modules from target architecture: parsing, validation (reconciliation), ai adapter layer, mapping, adjustments, calculation, forms, exports.

2. **Versioned artifact pipeline is not yet modeled end-to-end:**
   - Current versioning appears focused on contracts, not on per-run pipeline artifacts (mapping decision sets, adjustment sets, form drafts, exports, model runs).

3. **Role model drift in docs:**
   - Canonical docs set V1 roles as `Admin` + `Editor`.
   - Navigation doc still describes `Preparer` + `Reviewer` UI roles.
   - This discrepancy should be resolved to prevent product and implementation drift.

4. **Architecture doc drift (V1 runtime):**
   - SINGLE_SOURCE_OF_TRUTH says V1 is Cloudflare stack.
   - `system-architecture-v1.md` includes Azure-centric statements (not necessarily wrong for V2, but mixed wording creates confusion).

5. **Security/privacy controls are foundational but incomplete:**
   - There are good auth/session basics, but no visible PII/log redaction guardrails or data-classification-aware logging standards enforcement in code yet.

6. **UI is functional scaffold, not module navigation vision yet:**
   - Current client mainly supports auth, workspace list/detail, and status transitions.
   - The richer tab/left-rail/right-drawer information architecture from design docs is not yet implemented.

## Recommended next tickets (ordered)

Ticket size guideline: each ticket should touch one module/interface boundary at a time.

### Ticket 1 — Document consistency hardening (high leverage)
Goal:
- Resolve role/runtime drift across docs and pin V1 terminology.

Deliverables:
- Update `01-navigation-and-layout.md` role terms to `Admin`/`Editor` for V1.
- Add explicit note in `system-architecture-v1.md` clarifying Cloudflare as V1 runtime and Azure as V2 target (or split doc sections).
- Add a short “Doc drift checklist” to prevent future contradictions.

Acceptance:
- Canonical docs are internally consistent on roles + runtime.

### Ticket 2 — Introduce shared error + audit emission utilities
Goal:
- Reduce duplicated error/response shaping and standardize audit event metadata.

Deliverables:
- Add shared utility module for structured error creation.
- Add shared audit event builder helpers with required fields.
- Refactor only one existing workflow (workspace lifecycle) to consume helpers.

Acceptance:
- No behavior change, only consistency and maintainability improvement.
- Unit tests cover helper behavior and failure-shape invariants.

### Ticket 3 — Parsing module V1 contract + TB upload ingestion slice
Goal:
- Establish first real tax-pipeline boundary.

Deliverables:
- Add `TrialBalanceNormalizedV1` schema in shared contracts.
- Add parsing module with one deterministic CSV template parser.
- Persist parse artifact + audit event (`parse.succeeded` / `parse.failed`).

Acceptance:
- Contract tests: parser output validates and is accepted by downstream placeholder interface.
- Golden fixture for one normal + one malformed TB file.

### Ticket 4 — Reconciliation validation gate
Goal:
- Block downstream mapping when reconciliation fails.

Deliverables:
- Add `ReconciliationResultV1` schema + deterministic checks.
- Add workflow guard enforcing reconciliation pass before mapping generation endpoint can run.
- Emit audit event for reconciliation outcome.

Acceptance:
- Tests for pass, fail, and boundary conditions.
- Explicit error code for blocked mapping due to reconciliation failure.

### Ticket 5 — AI adapter skeleton + schema-constrained mapping proposals
Goal:
- Add first AI boundary while preserving deterministic safety.

Deliverables:
- AI module wrapper interface + provider adapter abstraction.
- `MappingDecisionV1` schema and parse/validation layer.
- Endpoint/job creates mapping proposal set as versioned artifact.

Acceptance:
- AI responses rejected if schema-invalid.
- No arithmetic or form population in AI module.
- Golden tests for at least 3 mapping scenarios.

### Ticket 6 — Mapping review workflow (human-in-loop controls)
Goal:
- Support accept/reject/edit/mark-reviewed lifecycle for mapping rows.

Deliverables:
- Mapping decision repository + mutation service.
- Row-level review states and comments hook points.
- Audit events for override/review actions.

Acceptance:
- Contract tests from mapping proposal -> reviewed mapping output.
- UI/API preserves immutable versions (new set per rerun).

### Ticket 7 — Adjustment module scaffold (first deterministic + AI-assisted pair)
Goal:
- Prove architecture for tax adjustments.

Deliverables:
- `TaxAdjustmentDecisionV1` contract.
- One deterministic adjustment and one AI-suggested adjustment module with review state.
- Guardrails for out-of-scope detection flags.

Acceptance:
- Unit tests per adjustment module.
- Golden cases updated with expected key adjustments.

### Ticket 8 — Deterministic tax summary module
Goal:
- Produce immutable tax summary from reviewed mapping + adjustments.

Deliverables:
- `TaxSummaryV1` schema and pure calculation functions.
- Versioned summary artifact persistence.
- Validation checks for internal consistency totals.

Acceptance:
- Deterministic unit tests with fixture-driven expected totals.
- No AI dependency in calculation module.

### Ticket 9 — INK2 draft population module (deterministic)
Goal:
- Populate initial INK2 fields from tax summary.

Deliverables:
- `INK2FormDraftV1` schema.
- Deterministic field mapping with field-level validation.
- Audit events for draft creation and manual edits.

Acceptance:
- Contract tests: tax summary -> ink2 draft.
- Coverage list of included INK2 fields documented.

### Ticket 10 — Export baseline + sealed flow hardening
Goal:
- Produce export artifact and enforce filed-state safeguards.

Deliverables:
- Export package schema and placeholder PDF pipeline record.
- Lock behavior for `filed` state with admin-only reopen reason enforcement across API.
- Audit enhancements for export and reopen actions.

Acceptance:
- End-to-end workflow test: approved -> exported -> client_accepted -> filed -> admin reopen with reason.

## Delivery strategy recommendation

- Run these as 2-week slices, one module boundary at a time.
- For AI-affecting tickets (5, 7), enforce golden-case review in CI.
- Add a “contract matrix” CI job that runs only contract tests for all module boundaries and fails on schema drift.

## Suggested immediate priorities (next 2 sprints)

Sprint 1:
- Ticket 1 (doc consistency)
- Ticket 2 (shared error/audit utils)
- Ticket 3 (TB parser + normalized contract)

Sprint 2:
- Ticket 4 (reconciliation gate)
- Ticket 5 (AI mapping proposals)
- Ticket 6 (mapping review workflow)

This sequence keeps risk low: it builds deterministic gates before introducing AI-driven proposal volume.
