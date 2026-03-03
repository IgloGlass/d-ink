# V1 Functional Specification
## AI-assisted Swedish Corporate Income Tax Return Drafting and Review (INK2)

This document defines **how the product behaves** in V1 (pilot version).
It is intentionally detailed enough to guide implementation and testing.

---

## 1. Purpose
Define functional behavior for:
- workspace setup
- file uploads
- annual report extraction
- trial balance import and reconciliation
- mapping module
- tax adjustment module(s)
- tax calculation summary
- INK2 form module
- comments/tasks/statuses
- exports
- audit logging behavior

---

## 2. Roles and access

### 2.1 Roles
- **Admin**: manages firm users, company/group access
- **Preparer**: uploads files, reviews AI suggestions, edits return
- **Reviewer**: reviews, comments, requests changes, approves export

Implementation lock (2026-03-03): V1 runtime roles are `Admin` and `Editor`.
`Preparer`/`Reviewer` remains a conceptual workflow split and does not change auth role codes in V1.

### 2.2 Access rules (V1)
- Users can only access firms they belong to
- Workspace access is scoped to assigned firm and company/group visibility
- All changes must be attributable to a user (or system process)

### 2.3 Out of scope (V1)
- SSO
- Fine-grained field-level permissions
- Custom role definitions

---

## 3. Workflow statuses

### 3.1 Return workspace statuses
- `draft`
- `in_review`
- `changes_requested`
- `ready_for_approval`
- `approved_for_export`
- `exported`

### 3.2 Status transition rules (draft)
Initial recommendation:
- `draft` -> `in_review`
- `in_review` -> `changes_requested`
- `changes_requested` -> `draft`
- `in_review` -> `ready_for_approval`
- `ready_for_approval` -> `approved_for_export`
- `approved_for_export` -> `exported`
- `approved_for_export` -> `draft` (reopen with audit event)

---

## 4. Module specifications

# 4.1 Workspace module

## Goal
Create and manage return workspaces per company and fiscal year.

## Inputs
- Firm
- Company
- Fiscal year
- Optional group association

## Outputs
- Return workspace record
- Workspace dashboard view

## User actions
- Create company
- Create/select fiscal year
- Open workspace

## Validation
- Only one active workspace per company + fiscal year (draft rule)
- Company and fiscal year are required

## Errors
- Duplicate workspace attempt
- Invalid firm/company access

## Audit events
- `workspace.created`
- `workspace.opened`

---

# 4.2 File upload module

## Goal
Allow upload and storage of annual report and trial balance files.

## Supported inputs (V1)
- Annual report: PDF
- Trial balance: Excel/CSV template
- Trial balance (advanced): free-form file import (explicit disclaimer required)

## User actions
- Upload annual report
- Upload trial balance
- Choose template/free-form mode
- Accept free-form disclaimer (if applicable)

## Functional behavior
- File is stored and linked to workspace
- File status is tracked:
  - `uploaded`
  - `parsing`
  - `ready`
  - `failed`
  - `needs_review`

## Validation
- File type allowed
- File size within configured limit
- For free-form TB: disclaimer acceptance required before processing

## Errors
- Unsupported file type
- Corrupt file
- Parse failure

## Audit events
- `file.uploaded`
- `file.parse_started`
- `file.parse_failed`
- `file.parse_succeeded`
- `tb.freeform_disclaimer_accepted`

---

# 4.3 Annual report extraction module

## Goal
Extract core financial statement values and identifying information from annual report.

## V1 extraction targets
- Company name
- Org number
- Fiscal year start/end
- Income statement values (minimum set)
- Balance sheet values (minimum set)
- Profit before tax
- Source snippets for extracted values
- Extraction confidence per field

## Functional behavior
- Parse PDF text (OCR fallback only if needed)
- Attempt structured extraction of target fields
- Store extracted values and source snippets
- Mark low-confidence or missing fields as `needs_review`

## User actions
- Review extracted values
- Manually correct values
- Confirm extraction

## Audit events
- `annual_report.extracted`
- `annual_report.extraction_field_overridden`
- `annual_report.extraction_confirmed`

---

# 4.4 Trial balance import module

## Goal
Parse and normalize TB data into structured rows.

## Modes
1. **Template mode (recommended)**
2. **Free-form mode (advanced, lower reliability)**

## Template mode requirements
Minimum required columns (exact names TBD):
- `account_no`
- `account_name`
- `amount`

## Functional behavior
- Validate columns
- Normalize values (numbers, signs, strings)
- Create TB line records
- Store parse warnings/errors
- Provide preview to user

## Free-form mode behavior (V1)
- Explicitly marked advanced mode
- More warnings and review prompts
- Lower confidence defaults downstream

## Audit events
- `tb.import_started`
- `tb.import_succeeded`
- `tb.import_failed`

---

# 4.5 Reconciliation module

## Goal
Run deterministic checks before AI mapping/tax reasoning.

## Checks (V1)
- Balance sheet balances
- Profit before tax matches annual report extracted value
- Missing/invalid values in TB
- Basic consistency checks

## Outputs
- Reconciliation status:
  - `pass`
  - `pass_with_warnings`
  - `failed`

## Validation
- Reconciliation must be run before mapping
- `failed` blocks progression (unless admin override is later added)

## Audit events
- `reconciliation.run`
- `reconciliation.result`

---

# 4.6 Mapping module

## Goal
Map TB accounts into tax-sensitive categories using expert policy + AI reasoning.

## Inputs
- TB lines
- Annual report context (available snippets)
- Mapping policy version
- Scoped memory (group/user preferences)

## Outputs
Structured mapping decisions:
- account reference
- proposed category
- confidence
- evidence
- policy rule reference
- review flag
- status (`proposed`, `accepted`, `overridden`)

## Functional behavior
- AI produces schema-validated mapping decisions
- Low-confidence or unsupported items are flagged
- User can override category
- User can save override scope:
  - current return
  - group
  - user

## Audit events
- `mapping.run`
- `mapping.generated`
- `mapping.override_created`
- `mapping.preference_saved`

---

# 4.7 Tax adjustment module (submodules)

## Goal
Convert mapped categories into draft tax adjustments and target INK2 codes.

## V1 submodules (initial target)
- Non-deductible expenses
- Representation / entertainment
- Basic depreciation differences
- Basic provisions/reserves review flags
- Other tax-sensitive manual review bucket (structured)

## Outputs
Structured adjustment decisions:
- module name
- finding
- evidence
- policy rule ID
- legal/tax reference
- proposed treatment
- adjustment amount
- target INK2 code
- confidence
- review flag
- status

## Functional behavior
- Run each submodule independently
- Persist outputs
- Recalculate summary after user edits
- Flag unsupported cases explicitly

## Audit events
- `adjustment.run`
- `adjustment.generated`
- `adjustment.overridden`
- `adjustment.accepted`
- `adjustment.marked_not_applicable`

---

# 4.8 Tax calculation summary module

## Goal
Produce deterministic tax summary from approved adjustments.

## Outputs
- Accounting result before tax
- Total adjustments (+/-)
- Taxable income
- Draft tax amount
- Traceable line-item breakdown

## Functional behavior
- Recompute on each approved/edited adjustment
- Show trace from totals to source adjustments

## Audit events
- `tax_summary.calculated`

---

# 4.9 INK2 form module

## Goal
Populate and review a draft INK2 form (INK2R + INK2S).

## Functional behavior
- INK2R populated from financial statements / reconciled values
- INK2S populated from tax adjustments
- User can edit fields manually
- Each field stores source type:
  - extracted
  - calculated
  - adjustment
  - manual

## Audit events
- `ink2.form_populated`
- `ink2.field_overridden`
- `ink2.form_approved`

---

# 4.10 Collaboration module (comments, tasks, statuses)

## Goal
Support preparer/reviewer collaboration inside the return workflow.

## Functional behavior
- Comments attachable to mapping decisions, adjustment decisions, and form fields
- Tasks attachable to same targets
- Tasks have assignee + status (`open`, `completed`)
- Status transitions are tracked and validated

## Audit events
- `comment.created`
- `task.created`
- `task.completed`
- `workspace.status_changed`

---

# 4.11 Export module

## Goal
Generate export outputs from approved return data.

## V1 output
- PDF export (required)
- SRU export (optional in V1, recommended in V1.x when stable)

## Functional behavior
- Export available only after `approved_for_export` (recommended)
- Export package should include:
  - INK2 draft output
  - tax calculation summary
  - key adjustment summary
  - audit trail snapshot (or separate report)

## Audit events
- `export.pdf_generated`
- `export.sru_generated` (if implemented)

---

## 5. Cross-cutting functional requirements

### 5.1 Audit trail
All material actions must log:
- actor
- timestamp
- workspace ID
- event type
- target
- before/after values (when relevant)
- policy/model version refs (when relevant)

### 5.2 Versioning and reruns
Re-running a module must not silently overwrite prior results.
Preserve prior outputs for audit/debugging.

### 5.3 Explainability display
Show structured reasoning only:
- Finding
- Evidence
- Rule applied
- Proposed treatment
- Confidence
- Review flag
- References

No chain-of-thought style output.

### 5.4 Unsupported cases
If outside scope:
- flag clearly
- require manual review
- prevent false certainty
- preserve evidence and rationale

---

## 6. Non-functional requirements (V1 baseline)

### 6.1 Reliability
- Deterministic calculations must be tested
- AI outputs must be schema-validated
- Parse failures must be recoverable

### 6.2 Performance (initial)
- Async processing is acceptable for extraction and AI runs
- UI must show progress/status

### 6.3 Security (baseline)
- Authenticated access only
- Firm-scoped authorization
- Sensitive files stored securely
- Secrets not stored in code

### 6.4 Observability
- Structured logs
- Error tracking
- Model run logging (model, prompt version, policy version, runtime)

---

## 7. Open items (to finalize before implementation)
- [ ] Exact TB template column names and format
- [x] Minimum annual report extraction field list (field-by-field): `companyName`, `organizationNumber`, `fiscalYearStart`, `fiscalYearEnd`, `accountingStandard`, `profitBeforeTax` (hybrid manual-first)
- [x] INK2 field coverage list (V1): `INK2R.profit_before_tax`, `INK2S.non_deductible_expenses`, `INK2S.representation_non_deductible`, `INK2S.depreciation_adjustment`, `INK2S.other_manual_adjustments`, `INK2S.total_adjustments`, `INK2S.taxable_income`, `INK2S.corporate_tax`
- [x] Corporate tax rate source/config by fiscal year: deterministic rule `20.6%` for fiscal year end >= `2021-01-01`, else `INPUT_INVALID`
- [ ] Exact status transition matrix
- [x] Which submodule is in the first 2–3 adjustment modules: `non_deductible_expenses`, `representation_entertainment`, `depreciation_differences_basic`, `manual_review_bucket`
- [ ] PDF export layout requirements
- [ ] SRU inclusion in V1 or V1.x

---

## 8. Acceptance criteria for V1 pilot (functional)
A return is successfully completed if:
1. User creates/opens a workspace
2. User uploads annual report + TB
3. System extracts and stores core financial values
4. System parses TB and runs reconciliation checks
5. System generates mapping decisions with review flags
6. System generates tax adjustment decisions for supported modules
7. User can review/override and recalculate tax summary
8. System populates a draft INK2 view
9. Users can comment/assign tasks and change statuses
10. User exports a PDF and audit trail is preserved
