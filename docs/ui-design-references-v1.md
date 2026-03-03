# UI Design References Pack (V1)

Status: Active reference set for UI implementation  
Date: 2026-03-03  
Purpose: Provide the exact design references to use during frontend build

## Precedence Rule

When UI instructions conflict, use this order:
1. `docs/ui-design-references-v4-ai-builder.md`
2. `docs/ui-design-references-v3-final.md`
3. `docs/ui-design-references-v1.md` (this file, index/governance)
4. `docs/ui-ux-architecture-v1.md`
5. `SINGLE_SOURCE_OF_TRUTH.md` and `AGENTS.md`

Interpretation rule:
- Newer user instruction wins on overlap.
- V4 is currently the newest and wins where both define the same behavior/value.
- V3 remains the fallback for interaction/atmospheric guidance where V4 is silent.

## 1. Primary Design Reference (Visual Language)

1. Deloitte-inspired enterprise design system reference:
- `C:/Users/slemi/.codex/skills/deloitte-frontend-design/references/deloitte-design-system.md`

This is the authoritative visual direction for:
- color behavior,
- typography hierarchy,
- radius/shadow restraint,
- navigation and card patterns,
- motion limits,
- icon style,
- accessibility guardrails.

## 2. Project UI Architecture References

1. `docs/ui-ux-architecture-v1.md`
- Defines IA, screen hierarchy, module flow, shell behavior.

2. `docs/frontend-build-plan-v1.md`
- Defines phased implementation order and delivery gates.

3. `docs/tax-adjustments-submodules.v1.md`
- Defines Tax Adjustments sidebar structure and prioritization.

4. `docs/ui-design-references-v3-final.md`
- Adds final atmospheric and interaction behavior directives (Cmd+K switching, dual-monitor assumptions, maker/checker patterns, mapping grid interaction).

5. `docs/ui-design-references-v4-ai-builder.md`
- Adds strict AI-builder hard constraints with exact mandatory token values and component/layout specs.

## 3. Token and Styling References (Code Baseline)

1. `src/client/styles/tokens.css`
- Existing color tokens and semantic variables to evolve.

2. `src/client/styles/global.css`
- Existing global component patterns to be refactored into premium system.

## 4. Locked Style Attributes to Apply

### 4.1 Color system

- Primary brand accent: Deloitte green family
  - `#86BC25` primary
  - `#26890D` strong
  - `#046A38` deep
- Neutral-first surfaces for enterprise clarity.
- Avoid purple/indigo-led branding.

### 4.2 Typography

- Primary font stack: `Open Sans, Arial, Helvetica, sans-serif`.
- Typography-first hierarchy:
  - strong heading contrast,
  - disciplined body text density,
  - restrained emphasis.

### 4.3 Shape, elevation, motion

- Radius restrained (`~6px-10px` feel).
- Shadow subtle, only where needed.
- Motion minimal (`~150-200ms`), no decorative animation patterns.

## 5. Interaction Pattern References

1. Search-first company selector:
- smart type-ahead suggestions,
- scan-friendly table/list,
- fast continue action.

2. Ordered module workbench:
- four core module cards,
- explicit recommended sequence,
- advisory progression (not hard lock).

3. Core module shell:
- top tabs for module switching,
- left sidebar for submodule navigation,
- advanced controls hidden by default.

4. Tax Adjustments navigation:
- Group A common-return items prioritized high,
- Group B/C contextual and specialized items progressively disclosed,
- calculation chain pinned at bottom with `Final Tax Calculation` last.

## 6. Accessibility and Quality References

1. WCAG AA target for contrast and interaction states.
2. Visible focus states for all interactive controls.
3. Semantic heading and landmark structure.
4. Desktop-first optimization is primary in this phase.

## 7. Content and Localization References

1. English-first content for V1 UI delivery.
2. i18n-ready architecture from start (language switcher included).
3. No new hardcoded strings in newly built surfaces.

## 8. Explicitly Not Used as Design Direction

1. Startup-style hero gradients as primary motif.
2. Glassmorphism and decorative blob aesthetics.
3. Over-rounded consumer app styling.
4. High-motion/novelty interactions that reduce clarity.

## 9. Reference Governance

When conflicts occur:
1. `docs/ui-design-references-v4-ai-builder.md`
2. `docs/ui-design-references-v3-final.md`
3. `docs/ui-design-references-v1.md` (this file, governance index)
4. `docs/ui-ux-architecture-v1.md` for UX/IA structure
5. `SINGLE_SOURCE_OF_TRUTH.md` and `AGENTS.md` for product/engineering constraints
