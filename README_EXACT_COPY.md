# AI INK2 V1 Pilot

AI-assisted Swedish corporate income tax return drafting and review for **INK2** (K2/K3 AB), designed for small accounting firms and non-tax specialists.

## What this is
This product is an **AI tax reviewer + draft engine**, not a full enterprise tax suite.

It takes:
- Annual report (Årsredovisning, PDF)
- Trial balance (template import first, free-form fallback)

And helps produce:
- Tax-sensitive account mapping
- Draft tax adjustments
- Draft INK2R / INK2S
- Review workflow with comments/tasks/statuses
- Audit trail
- PDF export (SRU later)

## V1 scope
### Supported
- Swedish AB
- K2 and K3
- Single entities
- Small groups (3–5 companies)
- Human-in-the-loop workflow (assistant mode)

### Out of scope (V1)
- Branches / PE
- Withholding tax-heavy scenarios
- Advanced cross-border tax
- Complex interest limitation scenarios
- Automated filing submission
- Global app-wide learning from user behavior

## Product principles
1. **Human-in-the-loop**  
   AI proposes. User reviews/approves.

2. **Deterministic where possible**  
   Calculations, reconciliations, form population, and exports should be code-first (not LLM-first).

3. **Structured AI outputs**  
   AI must return strict JSON (schema-validated), never free-text blobs driving calculations.

4. **Auditability first**  
   Every material action must be traceable.

5. **Scoped memory only**  
   Saved treatments may apply to current return, group, or user — never globally.

## Current priority build order
1. Core data model and workspaces
2. File upload and storage
3. TB template parser
4. Annual report extraction (core fields)
5. Reconciliation checks
6. Mapping engine
7. Tax adjustment modules (2–3)
8. Tax summary calculation
9. INK2R/INK2S draft view
10. Comments/tasks/statuses
11. PDF export + audit/debug tools

## Repo documentation
- `AGENTS.md` — coding and architecture rules for Codex/developers
- `docs/01-product-prd.md` — product requirements
- `docs/02-v1-functional-spec.md` — detailed behavior by module
- `docs/03-system-architecture.md` — high-level technical design
- `docs/04-data-model.md` — DB schema and entity relationships
- `docs/05-ai-decision-schema.md` — required AI output contracts
- `docs/06-tax-policy-rulebook/` — versioned tax policy and mapping rules

## Development workflow (recommended)
- Use small tickets only (one function/endpoint/component at a time)
- Always include tests
- Avoid broad refactors unless explicitly requested
- Follow `AGENTS.md` for all architectural and coding decisions

## Status
Early-stage pilot build. The primary goal is a **reviewable draft INK2 with evidence and audit trail**, not full automation.
