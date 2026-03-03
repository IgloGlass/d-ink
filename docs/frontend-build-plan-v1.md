# Frontend Build Plan (V1, Locked Inputs)

Status: Ready for implementation planning  
Date: 2026-03-03  
Owner: Product + Engineering

## 1. Locked Product Decisions

1. Phase 1 scope is approved:
- company selector,
- group control panel,
- workspace hub,
- core module shell.

2. Group/company data model for UI starts from recommended baseline fields.

3. Company selector must include smart search with type-ahead suggestions.

4. Internationalization architecture must be built now:
- V1 content in English first,
- language switcher included,
- codebase i18n-ready for additional locales.

5. Module shell and interaction pattern follows premium recommendations:
- ordered core module cards in workbench,
- tabbed core module navigation,
- sidebar for submodules where needed.

6. Advanced/technical controls hidden by default behind `Advanced`.

7. Module status model follows recommended states:
- `not_started`, `in_progress`, `completed`, `needs_review`, `blocked`.

8. Role-based UI differences are minimal:
- Admin-specific UI only where explicitly needed (e.g., invite/admin surfaces).

9. Frontend delivery target is desktop-first.
- Mobile optimization is out of primary scope for this phase.

10. Design direction sign-off is approved:
- Deloitte-inspired premium enterprise visual language.

11. Quality target:
- fully workable and polished frontend that demonstrates product potential.

12. Migration approach:
- complete frontend makeover (not incremental legacy preservation).

13. Dual-monitor workflow assumption is locked:
- no embedded PDF viewers in app,
- maximize workspace density for analysis and adjustment tasks.

14. Global context switcher is required:
- persistent top-bar `Cmd+K` style switching for client + fiscal year context.

15. Maker/checker support is required in UI states:
- row/status semantics for `Pending Review`, `AI Confident`, `Manual Override`, `Approved`,
- collapsible audit/comment pane available for reviewers.

## 2. Build Objectives

1. Deliver a premium, coherent Deloitte-style experience across all key flows.
2. Shift UX from endpoint operations to workflow-guided accountant experience.
3. Preserve existing backend contracts while upgrading UI architecture.
4. Make the product demo-ready with clear progression and confidence signals.

## 3. Sequential Implementation Program (No UI Logic Expansion Yet)

### Epic A: Design Foundation and App Shell

Scope:
- Token hardening and design primitives.
- Shared layout shell and navigation baseline.
- i18n scaffolding and language switcher (English active locale only).

Deliverables:
- centralized tokens and typography hierarchy,
- base components for cards, status chips, tabs, sidebar, banners, empty states,
- locale provider + translation key structure.

Exit criteria:
- global shell and primitive system adopted in all new pages,
- no hardcoded user-facing strings in new code paths.

### Epic B: Search-First Company Selector

Scope:
- rebuild `/app/workspaces` into search-first selector with suggestions.
- table/list presentation optimized for scan and quick continue.

Deliverables:
- type-ahead company/workspace search,
- recommended columns (company, org no, fiscal year, status, last updated, action),
- desktop-optimized interaction states.

Exit criteria:
- user can locate and open a workspace quickly via search suggestions.

### Epic C: Group Control Panel

Scope:
- add group-level overview surface for portfolio control.

Deliverables:
- group profile panel (identity/address),
- company directory and quick navigation to workspaces,
- cross-company progress overview.

Exit criteria:
- user can orient at group level before entering company-specific flow.

### Epic D: Workspace Hub (Ordered Modules)

Scope:
- replace current workspace landing with premium ordered workbench.

Deliverables:
- 4 module cards:
  - Annual Report Analysis
  - Account Mapping
  - Tax Adjustments
  - Tax Return INK2
- clear recommended sequence guidance (advisory, not hard lock),
- status and latest artifact/run signals per module.

Exit criteria:
- users see exactly where they are and what to do next.

### Epic E: Core Module Shell

Scope:
- implement shared core module page structure.

Deliverables:
- top tabs for core module switching,
- left sidebar for submodules where applicable,
- standardized content zones (main content + guidance/metadata panels).
- top-level command surface for fast context switching (Cmd+K interaction model).

Exit criteria:
- all core module pages follow one consistent interaction framework.

### Epic F: Tax Adjustments Sidebar IA Integration

Scope:
- integrate approved usability-first submodule grouping.

Reference:
- `docs/tax-adjustments-submodules.v1.md`

Deliverables:
- Group A/B/C/D sections,
- Group A expanded default,
- B/C under `Advanced`,
- calculation chain pinned near bottom with `Final Tax Calculation` last.

Exit criteria:
- adjustments navigation supports both common-return speed and advanced breadth.

### Epic G: Polish, QA, and Acceptance

Scope:
- visual polish, interaction consistency, and test hardening.

Deliverables:
- consistent premium styling and hierarchy,
- accessibility pass (focus/contrast/semantic checks),
- skeleton loaders (no spinner-first loading in core surfaces),
- frontend test updates for core flows,
- final sign-off walkthrough.

Exit criteria:
- polished, coherent, demo-ready frontend with stable behavior.

### Epic H: Premium Module Interaction Behaviors

Scope:
- implement high-value interaction patterns from V3/V4 references.

Deliverables:
- Account Mapping:
  - virtualized high-density grid,
  - `View All` vs `Exceptions Only` toggle,
  - search-first category override combobox,
  - contextual inline AI command bar for multi-row correction.
- Tax Adjustments:
  - persistent pinned impact block for `Final Tax Calculation`.
- Tax Return INK2:
  - premium Skatteverket replica layout treatment in constrained page canvas.

Exit criteria:
- core module interactions feel like a premium financial workbench and support fast operator workflows.

## 4. Non-Goals for This Frontend Program

- No new tax logic/rule engine expansion.
- No account-to-submodule mapping logic changes.
- No schema-breaking backend contract changes.
- No mobile-first redesign effort.
- No embedded in-app PDF viewer.

## 5. Acceptance Gate

1. Desktop user can:
- select company quickly,
- navigate group/company/workbench/module flows without confusion,
- understand recommended sequence and statuses,
- operate major screens with premium clarity.

2. New UI is i18n-ready with English locale active.
3. Advanced controls are hidden by default and intentionally discoverable.
4. Frontend is fully usable and polished for pilot demos.
