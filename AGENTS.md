# AGENTS.md

## Project overview
This repository contains an AI-assisted application for drafting and reviewing Swedish corporate income tax returns (INK2) for small accounting firms.

The product is an **AI tax reviewer + draft engine**, not a full professional tax suite.

### V1 target users
- Small accounting firms / redovisningsbyråer, mainly non-tax specialists
- Single-user completion is common, but V1 must support light preparer+reviewer workflow (comments/tasks/statuses)

### V1 scope (supported)
- Swedish AB (aktiebolag)
- K2 and K3
- Single entities and small groups (3–5 companies) for organization and policy memory
- Template-first TB import, free-form fallback behind disclaimer
- Human-in-the-loop (assistant mode)

### V1 out of scope
- Branches / permanent establishments
- Withholding tax-heavy scenarios
- Advanced cross-border tax
- Complex net interest limitation cases
- Automated filing submission
- Global app-wide learning from user behavior

---

## Core product principles
1. **Human-in-the-loop by default**: AI proposes; users review/approve.
2. **Deterministic where possible**: calculations, reconciliations, form population, exports must be code-first.
3. **Structured AI outputs only**: schema-validated JSON; no free-text driving computations.
4. **Auditability is a feature**: every decision/change must be traceable.
5. **Scoped memory only**: save treatments at return/group/user scope; never globally.
6. **Structured AI reasoning only**: AI logic must be module-scoped, policy-driven, and versioned outside prompt prose.

## UI/UX Standards (Deloitte Ascend)
All frontend work must strictly follow the **Deloitte Ascend** design language implemented in `src/client/styles/tokens.css` and `global.css`.

### 1) Visual Constraints
- **Color**: Only use the High-Contrast Zinc palette. The only allowed accent color is Deloitte Green (`#86BC25`).
- **Shape**: Use sharp corners (`radius: 0`) for primary cards, tables, and buttons to maintain an enterprise "Precision Instrument" feel.
- **Typography**: Open Sans 800 for headings; monospace tabular numerals for all financial data.

### 2) Interaction Standards
- **Drag and Drop**: Support PDF/Excel drops as primary input methods. Use `drop-zone` patterns.
- **Performance**: Use virtualized grids for any list exceeding 100 items. Support column resizing.
- **Persistence**: Navigation between module tabs must use CSS hiding (`display: none`) to ensure React state and background processes (AI runs) are not reset.

### 3) Layout Hierarchy
- **Entry**: Always search-first.
- **Workbench**: Dashboard with high-level metrics before deep-diving into tasks.
- **Workbench Persistence**: The right-rail tax summary must be pinned and update in real-time.

---

## Modularity requirements (critical)
A key risk is that changes in one module unintentionally break others. To reduce this, the system must be **highly modular** with **rigid contracts** between modules.

### 1) Hard module boundaries
Code must be organized into modules with clear ownership and responsibilities:

- **parsing**: file parsing only (TB, PDF text extraction)
- **validation**: deterministic reconciliation checks
- **ai**: model adapters, prompts, schema parsing/validation
- **mapping**: mapping decision generation + overrides
- **adjustments**: tax adjustment modules + overrides
- **calculation**: deterministic tax summaries/totals
- **forms**: INK2 field population + field validation
- **exports**: PDF (V1), SRU (later)
- **workflow**: comments, tasks, statuses, approvals
- **audit**: event logging + version history
- **db/repositories**: persistence access (no business logic)

Rules:
- Modules may call other modules only through **public interfaces/contracts**.
- No “reach-in” imports (e.g., UI importing DB models directly, adjustment module reading raw file objects).
- No cross-module circular dependencies.

### 2) Strict contracts (schema first)
All module inputs/outputs must be defined as **typed, versioned schemas** (e.g., TypeScript types + runtime validation):

- `TrialBalanceNormalized`
- `AnnualReportExtraction`
- `ReconciliationResult`
- `MappingDecision[]`
- `TaxAdjustmentDecision[]`
- `TaxSummary`
- `INK2FormDraft`
- `ExportPackage`

Rules:
- A module may evolve its internal implementation freely as long as it preserves its output contract.
- Breaking schema changes require a version bump (e.g., `MappingDecisionV2`) and a migration plan.

### 3) Domain layer isolation
Business rules must live in the **domain/services** layer, not in:
- API handlers/controllers
- UI components
- DB repositories

API handlers must be thin: parse request → call service → return response.

### 4) Deterministic vs AI: enforced separation
- Deterministic modules must be **pure and testable** (no model calls).
- AI modules must never do arithmetic or final form population.
- AI output is always **validated** and converted into domain objects before use.

### 4b) Structured AI reasoning framework (mandatory)
All AI modules/submodules must follow the structured reasoning framework in:
- `references/ai-module-spec-v1.md`
- `references/templates/ai-module-spec.template.json`
- `references/templates/ai-policy-pack.template.json`
- `references/templates/ai-policy-patch.template.json`

Required design pattern:
- `module-spec` defines contracts, runtime, gates, audit fields, and active policy versions.
- `policy-pack` contains ordered decision rules, fallback behavior, and review thresholds.
- `policy-patch` applies minimal hotfix overlays without rewriting prompts.

Rules:
- Prompts must stay thin; domain decision logic belongs in policy files.
- Every AI decision must include a `policyRuleReference`.
- AI outputs use canonical codes/IDs, then deterministic code resolves labels/derived fields.
- Any policy change requires module tests + boundary contract tests + golden pack run.
- Policy/prompt/model versions must be stored with run artifacts for audit/replay.

### 5) Versioning and immutability for outputs
Each pipeline run creates versioned artifacts:
- model run records
- decision sets (mapping/adjustments)
- form drafts
- exports

No silent overwrites. “Re-run” produces a new run/version and marks which version is currently active.

---

## Repository structure (recommended)
- `/src/server/parsing` — TB/PDF parsing
- `/src/server/validation` — reconciliation checks
- `/src/server/ai` — model adapters, prompt templates, schema validation
- `/src/server/mapping` — mapping engine + overrides + preferences
- `/src/server/adjustments` — adjustment modules + orchestration
- `/src/server/calculation` — deterministic tax summary
- `/src/server/forms` — INK2 population + validation
- `/src/server/exports` — PDF/SRU generation
- `/src/server/workflow` — statuses/comments/tasks
- `/src/server/audit` — audit event logging
- `/src/db` — migrations, repositories
- `/src/shared` — shared types/schemas/enums
- `/tests` and `/fixtures` — tests and golden cases

---

## Coding standards
- Prefer clarity over cleverness.
- One responsibility per function.
- No broad refactors unless explicitly requested.
- Use structured errors (`code`, `message`, `context`, `user_message`).
- Use structured logs; include workspace/file/run IDs.

---

## Testing and change control (how we prevent module breakage)

### 1) Unit tests per module (mandatory)
Every module must have unit tests for:
- expected inputs
- edge cases
- failure paths

### 2) Contract tests between modules (mandatory)
For each module boundary, maintain tests that assert:
- output conforms to schema
- downstream module accepts the output without changes

Examples:
- TB parser → Mapping engine
- Mapping engine → Adjustment modules
- Adjustments → Tax summary
- Tax summary → INK2 form population

### 3) Golden test pack (mandatory for AI modules)
Maintain a small set of gold-standard cases with expected:
- key mappings
- key adjustments
- key totals
- key INK2 fields
- out-of-scope flags

These act as regression tests when prompts/policies change.

### 4) Backwards compatibility rule
If a module output changes shape, you must:
- add a new version of the schema (V2)
- keep V1 supported until all downstream modules are migrated
- add migration/adapter code if needed

### 5) Dependency boundary checks in CI (mandatory)
Automated dependency checks must run in the main quality gate to prevent accidental cross-module coupling.

At minimum, enforce:
- no circular dependencies
- no client imports from `server`/`db`
- no `server`/`db` imports from `client`
- no direct repository imports from HTTP route handlers

If a rule must change:
- update the dependency-check configuration in the same PR
- document why the boundary change is required
- add/adjust contract tests at the affected module boundary

---

## Coding pipeline impact (how we work day-to-day)
To keep changes safe and modular, the coding pipeline becomes more rigid (on purpose).

### Ticket rules (small steps)
Each ticket should touch **one module** (or one interface) at a time:
- one function/endpoint/component
- one schema change + adapters (if needed)
- one job/pipeline step

### Change workflow (required)
1. **Define/confirm the contract** (types/schema) before coding behavior.
2. Implement inside one module.
3. Add/update **unit tests** for that module.
4. Add/update **contract tests** at the boundary.
5. Run the golden test pack (for AI-related changes).
6. Run the relevant automated checks for the change before handoff (for example typecheck, unit/contract tests, and UI/browser checks when applicable). If a test fails, improve the change until the relevant checks pass before handing work back.
7. Only then integrate into the next module.

### “No cross-module edits” default
Unless the ticket explicitly says otherwise:
- do not modify multiple modules in one change set
- do not refactor unrelated code
- do not change schemas without a version bump + tests
- when a task exposes a reusable environment, testing, or workflow fix, codify it in-repo during the same pass instead of leaving it as one-off terminal knowledge

### When you must touch multiple modules
If a change requires it (e.g., schema version upgrade):
- do it in two steps:
  1) add V2 schema + adapter (keep old behavior working)
  2) migrate consumers to V2 and remove V1 later

---

## Audit trail requirements
Log at minimum:
- file uploaded
- parse succeeded/failed
- extraction created/overridden/confirmed
- reconciliation run/result
- mapping generated/overridden/preference saved
- adjustments generated/overridden/accepted
- form populated/field edited/approved
- status changed
- comment/task created/completed
- export created
- module rerun

Audit payload must include:
- actor (user/system)
- workspace ID
- event type
- target type + ID
- before/after values (when relevant)
- policy/model run IDs (when relevant)
- timestamp

---

## Security and data handling
- Sensitive financial/tax data: authenticated access only; firm-scoped authorization.
- Store files securely; do not leak file contents in logs.
- When calling AI providers: send only what is needed, store model metadata per run.

---

## Codex usage rules (important)
Codex should work on small, explicit tasks only.

Required prompt format for Codex tasks:
- Goal
- Files to edit
- Files not to edit
- Requirements
- Acceptance criteria
- Tests to add/run
- Output summary format

Plan-first for larger tasks:
1) propose plan (no code)
2) implement step 1 only
3) repeat

Definition of done:
- code compiles
- relevant tests/checks have been run for the change and pass before handoff
- schemas validate
- errors handled
- audit event added when relevant
- no unrelated changes

---

## Commenting standards (follow these rules)

Comments are encouraged, but they must be **high-signal** and must not restate obvious code.

### Default rule
- Code should be self-explanatory for **what** it does (names, types, small functions).
- Comments should explain **why** it does it that way, plus any **constraints** and **non-obvious** behavior.

### REQUIRED: comment these cases
1) **Tax/domain intent and assumptions**
- explain the rule, threshold, or interpretation being applied
- note K2/K3 differences where relevant

2) **Safety boundaries**
- e.g., “this must remain deterministic; do not call LLM here”
- e.g., “block mapping if reconciliation failed”

3) **Module contracts**
- document input/output expectations and invariants at module boundaries
- use doc-comments for public functions and schemas

4) **Edge cases and gotchas**
- sign conventions, rounding, account number formatting, missing data behavior

5) **Security and privacy**
- clarify redaction requirements and what must not be logged

6) **TODOs with context**
- TODOs must include *why* and (if possible) a target milestone (e.g., v1.x)

### AVOID: these comment patterns
- “what” comments that just repeat the code
- comments describing implementation details likely to change
- large narrative blocks inside long functions (prefer refactoring into named helpers)

### Prefer these alternatives before adding a comment
- better names (`runReconciliationChecks`, `shouldRequireManualReview`)
- smaller functions (single responsibility)
- types/schemas that encode constraints
- tests that demonstrate behavior (tests are living documentation)
