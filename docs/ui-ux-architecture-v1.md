# D.ink UI/UX Architecture Spec (V1 Alignment, Pre-Implementation)

Status: Draft for leadership/product sign-off  
Date: 2026-03-03  
Scope: UX architecture and design system alignment only (no implementation code)

## 1. Purpose

Define a premium, coherent, and testable UI architecture for D.ink before frontend implementation.

This spec reflects:
- Product reality (AI-assisted Swedish INK2 workflow for non-specialist accountants).
- The agreed chronological build order.
- Deloitte-inspired enterprise design guardrails (credible, restrained, green-led, typography-first).

## 2. Current UI Assessment

Current frontend is functionally strong but structurally developer-centric:
- Key workflows are exposed as long operational forms in one large workspace screen.
- Interaction model is endpoint-driven, not accountant task-driven.
- Visual language is coherent but not yet premium/decision-oriented.

Conclusion:
- Keep underlying React/query/API architecture.
- Redesign information architecture, workflow framing, and visual hierarchy before adding more features.

## 3. Target Product UX Model

### 3.1 Entry experience: Company workspace selection

Primary page after auth:
- Search-first company/workspace selector.
- Fast filters (status, fiscal year, assigned user later).
- Clear row cards/table with:
  - company name and org number,
  - fiscal year,
  - current stage/status,
  - "Continue" action.

Purpose:
- Users should immediately choose "what company I am working on" with minimal friction.

### 3.2 Workspace hub: Ordered core modules

After selecting company/workspace, show a premium "Return Workbench" hub with four core modules:
1. Annual Report Analysis
2. Account Mapping
3. Tax Adjustments
4. Tax Return INK2

Presentation:
- Large module cards (preferred default) in a clear sequence row/grid.
- Each card shows:
  - stage number,
  - status (not started/in progress/review blocked/completed),
  - last run timestamp/version,
  - primary CTA ("Start", "Continue", "Review").

Order signaling:
- Persistent numbered sequence.
- Connector/progress rail between modules.
- Clear recommended-order messaging (advisory guidance, not hard locking).

### 3.4 Group control panel

Add a dedicated group-level control surface above company-level execution:
- Group identity and profile (name, organization number, address).
- Company directory for all companies in the group.
- Workspace/stage progress overview across companies.
- Quick action entry to each company workspace.

Purpose:
- Give operators and reviewers an executive view before diving into a single company return.

### 3.3 Core module shell: Tabs + optional left sidebar

Inside a core module, use a shared shell:
- Top: module tabs for fast switching across the 4 core modules.
- Left sidebar (when needed): submodule navigation within current core module.
- Main panel: active submodule content.
- Right utility rail (optional later): audit/version/activity context.

Tax Adjustments requirement:
- Left sidebar must support submodules, including:
  - non-deductible expenses,
  - representation/entertainment,
  - depreciation differences,
  - manual review bucket,
  - Final Tax Calculation pinned at bottom.

## 4. Information Architecture (V1)

### Level A: App routes

- `/app/groups/:groupId/control-panel` -> group control panel (group profile + company portfolio view)
- `/app/workspaces` -> company/workspace selector (search-first)
- `/app/workspaces/:workspaceId` -> workbench hub (core module cards + progress)
- `/app/workspaces/:workspaceId/:coreModule` -> core module shell
- `/app/workspaces/:workspaceId/:coreModule/:subModule` -> specific submodule

### Level B: Core modules

- `annual-report`
- `mapping`
- `adjustments`
- `tax-return-ink2`

### Level C: Submodules (initial)

Annual Report:
- upload/run
- extracted fields review
- overrides
- confirm extraction

Mapping:
- decision table
- review suggestions
- overrides/preferences

Adjustments:
- non-deductible expenses
- representation entertainment
- depreciation differences
- manual review bucket
- final tax calculation (summary checkpoint)

Tax Return:
- INK2 draft fields/codes
- field validation
- approvals
- export preparation

## 5. UX Principles for D.ink

1. Guide first, configure second.
- Default UI shows next action and outcome.
- Advanced controls are available but collapsed by default.

2. Deterministic trust signaling.
- Every stage shows what is code-deterministic vs AI-proposed.
- Include confidence/review flags where AI contributes.

3. Version and audit visibility.
- Users can see active artifact version and latest run metadata.
- "Why blocked" and "what changed" are explicit in UI copy.

4. Sequential clarity, not hard friction.
- Enforce stage order with clear dependency messaging.
- Allow back-navigation and review without confusion.

5. Fast operator loops.
- Reduce context switching and scrolling.
- Keep common actions in predictable positions.

## 6. Visual System Direction (Deloitte-Aligned)

Design language:
- Enterprise premium, restrained, credible.
- Green-led accents on neutral surfaces.
- Open Sans typography hierarchy.
- Low-noise composition with sharp spacing rhythm.

Must-have styling traits:
- Clean white/gray surfaces with controlled green emphasis.
- Strong heading/body hierarchy.
- Subtle borders and restrained elevation.
- Minimal motion (150-200ms), no decorative effects.
- Accessible focus states and WCAG AA contrast.

Must avoid:
- Startup-style playful gradients and novelty motion.
- Over-rounded consumer UI.
- Loud color palettes competing with primary green.

## 7. Component Architecture (Pre-build)

Required primitives before page builds:
- App shell (header/nav/workspace context).
- Module progress rail.
- Core module card.
- Stage status badge/pill (shared semantics).
- Empty/loading/error/blocked state panels.
- Tab bar (core module switcher).
- Sidebar nav (submodules).
- Action bar (primary/secondary/advanced actions).
- Run/version metadata chip set.

Rules:
- Token-first styling, then components, then pages.
- Reuse primitives; avoid per-page one-off style systems.

## 8. Interaction and State Rules

1. Module order states:
- `not_started`, `in_progress`, `completed`, `needs_review`, `blocked`.
- Modules remain manually editable regardless of sequence.

2. CTA rules:
- All modules are always accessible.
- When opened out of recommended order, show guidance banner with recommended prerequisites.
- Primary CTA always singular per card ("Start/Continue/Review").

3. Error and retry handling:
- Error messages must be operational and actionable.
- Include retry path and "view details" only when relevant.

4. Long-running actions:
- Show progress and run completion states clearly.
- Reflect active version immediately after successful runs.

## 9. Delivery Plan (UI-Only, No Domain Logic Expansion Yet)

Phase 1: Foundations
- Lock tokens and typography hierarchy.
- Implement app shell, module cards, progress rail, tabs, sidebar primitives.

Phase 2: IA migration
- Build company selector page.
- Build workspace hub page.
- Build core module shell routing.

Phase 3: Module surface migration
- Migrate Annual Report, Mapping, Adjustments, Tax Return UIs into shell.
- Keep existing backend contracts; avoid schema changes in UI phase.

Phase 4: Premium polish and QA
- Responsive and accessibility pass.
- Consistency pass for copy, states, and interaction patterns.

## 10. Acceptance Criteria for UI Alignment Sign-Off

1. Users can select company/workspace via search-first landing.
2. Workbench hub presents 4 core modules with explicit sequence and status.
3. Core module tabs allow fast switching between modules.
4. Tax adjustments has a left sidebar with required submodules and final calculation entry.
5. All modules remain manually editable while still presenting clear recommended sequence guidance.
6. Visual language is coherent, premium, and Deloitte-aligned.
7. Group control panel exists for group/company overview and navigation.
8. No backend contract/schema changes required for UI architecture phase.
## 11. Locked Product Decisions (2026-03-03)

1. Premium interaction pattern:
- Search-first company selector + premium ordered module-card workbench.

2. Workspace selector default fields:
- Company name, organization number, fiscal year, current status, last updated, continue action.

3. Access policy:
- All core modules are always manually editable.
- Sequence is guidance, not hard lock.

4. Module naming:
- Use "Tax Return INK2".

5. Advanced controls:
- Hide technical controls behind collapsed "Advanced" sections by default.

6. Group governance surface:
- Include a Group Control Panel with profile + company portfolio + cross-company progress and entry points.
