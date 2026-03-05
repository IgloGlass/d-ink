# UI Design References & Architecture Pack (V4 - AI Builder Edition)

Status: Active reference set for UI implementation  
Date: 2026-03-03  
Theme: "Next-Gen Enterprise" - Premium, Authoritative, AI-Powered  
Purpose: Provide exact, unambiguous design directives, CSS tokens, and architectural constraints to guarantee a premium Deloitte output without AI hallucination or fallback to default web patterns.

## 0. Governance and Relationship to V3

- This V4 pack is the highest-precedence UI directive.
- Use `docs/ui-design-references-v3-final.md` for complementary interaction/atmospheric directives where V4 is silent.
- If V3 and V4 conflict on explicit values/behavior, V4 wins.

## 1. Core Directives for AI Builders

- STRICT COMPLIANCE: You must not use default browser styles, standard Bootstrap/MUI aesthetics, or generic "modern web" templates.
- NO GUESSING: If a value is not specified below, use the defined 4px/8px baseline grid and the exact color tokens provided.
- ANTI-STARTUP: Do NOT use gradients, glassmorphism (`backdrop-filter: blur`), heavy rounded corners (pills), or purple/indigo accents.
- ANTI-LEGACY: Do NOT use inset shadows, heavy gray table headers, thick borders, or microscopic (sub-12px) text.

## 2. The CSS Token Blueprint (MANDATORY VALUES)

The frontend must implement these exact values in `tokens.css` or the equivalent styling layer.

### 2.1 Color Palette (Hex Codes)

Brand & AI Action (Deloitte Green):
- `--color-brand-primary: #86BC25`  
Use for: Primary buttons, Active Tab underlines, AI Confidence High indicators.
- `--color-brand-hover: #26890D`  
Use for: Button hover states.
- `--color-brand-deep: #046A38`  
Use for: Top-level global header background.
- `--color-ai-highlight: rgba(134, 188, 37, 0.08)`  
Use for: Background tint on AI-populated input fields or AI-mapped table rows.

Surfaces & Layout:
- `--color-surface-app: #F5F7FA`  
The main app background. A very cool, crisp grey/slate. NEVER pure white.
- `--color-surface-panel: #FFFFFF`  
Pure white. Used for main content cards, tables, and sidebars.
- `--color-surface-hover: #F9FAFB`  
Ultra-light grey for table row hovers. Do not use dark grey.

Typography & Borders (Precision Neutral):
- `--color-text-heading: #111827`  
Deep slate. NEVER `#000000`.
- `--color-text-body: #374151`  
Medium-dark slate.
- `--color-text-muted: #6B7280`  
Use for: Placeholder text, table column headers, secondary timestamps.
- `--color-border-subtle: #E5E7EB`  
Use for: All dividing lines, table row borders, card outlines. Must be exactly `1px solid`.
- `--color-border-input: #D1D5DB`  
Slightly darker for form input borders.

### 2.2 Spacing & Grid System (The 4/8 Baseline)

- Micro-spacing (inside components): `4px`, `8px`, `12px`.
- Macro-spacing (between panels/sections): `24px`, `32px`.
- Rule: Padding inside a main white layout panel should always be exactly `24px` (`padding: 24px;`).

### 2.3 Typography Scale (Open Sans)

All text must render using:
- `font-family: 'Open Sans', Arial, sans-serif;`

Scale:
- Page Title: `24px`, `font-weight: 700`, `letter-spacing: -0.02em`, `color: var(--color-text-heading)`.
- Section Header: `16px`, `font-weight: 600`, `color: var(--color-text-heading)`.
- Table Header / Micro-label: `11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `color: var(--color-text-muted)`.
  - This uppercase/tracking treatment is critical for the premium feel.
- Data Grid Body Text: `13px`, `font-weight: 400`, `line-height: 1.5`, `color: var(--color-text-body)`.
- Numeric Data: `13px`, `font-variant-numeric: tabular-nums;` (Mandatory for accounting alignment).

### 2.4 Shape, Elevation & Animation

- Radius:
  - `--radius-sm: 4px` (Inputs, Buttons).
  - `--radius-md: 8px` (Cards, Modals).
  - Do not exceed `8px`.
- Shadow (Floating):
  - `--shadow-float: 0 10px 30px -5px rgba(17, 24, 39, 0.08)`.
  - Use ONLY for dropdowns, popovers, and modals.
  - Main layout panels should have `border: 1px solid var(--color-border-subtle)` and NO shadow.
- Focus Ring (Accessibility):
  - `--focus-ring: 0 0 0 2px #FFFFFF, 0 0 0 4px #86BC25`.
  - Applied on `:focus-visible`.
- Transitions:
  - `transition: all 0.15s ease-in-out`.
  - No bouncy spring animations.

## 3. Component-Level Specifications (How to Build the UI)

### 3.1 High-Density Data Grids (The Account Mapping Table)

This is the most important component in the app. It must look like a high-end financial instrument.

- Row Height: Exactly `40px` for standard rows. `32px` for compact view.
- Borders: Only horizontal dividers (`border-bottom: 1px solid var(--color-border-subtle)`).
  - No vertical borders between columns (allows data to breathe horizontally).
- Hover State: `background-color: var(--color-surface-hover)` on the entire row.
- AI Mapped State:
  - `border-left: 3px solid var(--color-brand-primary)`
  - `background-color: var(--color-ai-highlight)`.
- Alignment:
  - Text aligned left.
  - All financial numbers aligned RIGHT.
- Scrolling:
  - Table header (`<th>`) must be `position: sticky; top: 0; background-color: #FFFFFF; z-index: 10;`.

### 3.2 Forms & Inputs

- Standard Input:
  - Height `36px`.
  - `border: 1px solid var(--color-border-input)`.
  - `border-radius: 4px`.
  - `padding: 0 12px`.
- AI Auto-filled Input:
  - `background-color: var(--color-ai-highlight)`.
  - Place a tiny, minimal spark/bot icon (`14px`, color `#86BC25`) inside the right edge of the input to denote provenance.
- Search-First Combobox:
  - Height `36px`.
  - When clicked, dropdown menu floats using `--shadow-float`.
  - The list inside must have `padding: 4px`, with options having `border-radius: 4px` and highlighting to `#F3F4F6` on hover.

### 3.3 Buttons & Actions

- Primary Button:
  - `background-color: var(--color-brand-primary)`.
  - `color: #FFFFFF`.
  - `border: none`.
  - `border-radius: 4px`.
  - `height: 36px`.
  - `padding: 0 16px`.
  - `font-weight: 600`.
  - `font-size: 13px`.
- Secondary Button:
  - `background-color: #FFFFFF`.
  - `color: var(--color-text-heading)`.
  - `border: 1px solid var(--color-border-input)`.
  - `border-radius: 4px`.
  - `height: 36px`.
- Icon Buttons:
  - Exact `32px x 32px` square with `4px` radius.
  - Centered SVG icon.

### 3.4 The Top Global Header (Cmd+K Context)

- Height: Exactly `56px`.
- Background: `--color-brand-deep` (`#046A38`).
  - This immediately grounds the app in the Deloitte brand while keeping the main workspace bright and white.
- Context Selector:
  - Display the Active Client and Year prominently.
  - Make it look like a clickable, premium badge:
    - `background: rgba(255,255,255,0.1)`
    - `color: #FFF`
    - `border: 1px solid rgba(255,255,255,0.2)`
    - `border-radius: 4px`
    - `padding: 4px 12px`

## 4. Layout & Architecture Directives

### 4.1 Global Layout

- App Shell: `100vw / 100vh`. `overflow: hidden`.
- Top Bar: `56px` fixed height (as defined above).
- Main Workspace:
  - The area below the top bar.
  - Split into functional columns based on the module.
  - Background must be `--color-surface-app`.

### 4.2 The Tax Adjustments Workbench Layout

- Left Sidebar:
  - Exact width `280px`.
  - `background-color: #FFFFFF`.
  - `border-right: 1px solid var(--color-border-subtle)`.
- Center Content:
  - Flex-grow (`flex: 1`).
  - Contains data grids or adjustment forms.
  - Generous `24px` padding around white content panels.
- Right/Bottom Pinned Panel (Final Calculation):
  - Must be `position: sticky` or anchored to layout framework so it NEVER scrolls out of view.
  - Use slightly elevated shadow (`0 -4px 12px rgba(0,0,0,0.05)`) if anchored at bottom to imply it floats above work.

### 4.3 The Final Tax Return (Skatteverket Visual Replica)

- Container:
  - Render a white "page" centered in the grey app shell.
  - Constrained to exact `max-width: 850px` to mimic A4 proportions.
  - Add `--shadow-float` to this page.
- Grid:
  - Recreate official INK2/SRU layouts using CSS Grid (`display: grid`).
  - Use strict `1px solid var(--color-text-heading)` borders to draw literal form boxes (mimicking government form lines).
- Typography in Replica:
  - SRU Codes (e.g., `7310`) must be bold and prominent.
  - Values must use `font-variant-numeric: tabular-nums`.

## 5. Summary of AI Rules for Generation

- Do not invent colors outside of section 2.1.
- Ensure all text respects the typography scale in 2.3.
- Keep all radii at `4px` or `8px`.
- Assume all layout is meant for a high-resolution desktop screen (no hamburger menus or mobile stacking required for V1).

## 6. Final Consistency Cutover (FEP-12)

- The selector -> workbench -> module-shell route sequence is the mandatory premium validation path before sign-off.
- Native semantic elements must be used as-is; do not add redundant ARIA roles to `<ul>`, `<li>`, or button-based option lists.
- Keyboard access is required on all route-critical controls (launcher/search suggestions/module rows) using native focus behavior and `:focus-visible` token ring.
- Final gate command for this cutover: `node scripts/ralph/check-frontend-premium-gates.v1.mjs`.
