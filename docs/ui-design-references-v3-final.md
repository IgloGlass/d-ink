# UI Design References & Architecture Pack (V3 - Final)

Status: Active reference set for UI implementation  
Date: 2026-03-03  
Theme: "Next-Gen Enterprise" - Premium, Authoritative, AI-Powered  
Purpose: Provide exact design references, atmospheric goals, interactive behaviors, and component constraints for the frontend build.

## 0. Governance and Relationship to V4

- This V3 pack is an active companion reference for interaction and atmospheric direction.
- `docs/ui-design-references-v4-ai-builder.md` is currently newer and has precedence on overlap/conflict.
- Use V3 where V4 is silent.

## 1. Visual Design Language: "Premium Deloitte Ascend"

The overarching aesthetic is "Elegant Density." It must feel like a high-end, precision financial tool.

- Trust over Trend: We are building a Deloitte product. It must convey security, precision, and authority.
- Crisp, not Clunky: Move away from heavy, boxed-in aesthetics of legacy tax software (for example legacy SAP). Use generous macro-whitespace (padding between major layout sections) while maintaining micro-density (tight, scannable data rows).
- The AI Vibe: AI is a quiet, brilliant assistant. We signify AI through smart defaults, subtle brand-aligned highlights, and confidence scoring - not magic wands, chat bubbles, or purple gradients.

## 2. Technical & UI Foundation

- Stack: React + TypeScript + Vite.
- Component System: No external visual component libraries (for example MUI, Ant Design). The team will build an internal, Deloitte-aligned component layer (tokens + reusable primitives) extending the existing CSS architecture (`tokens.css` and `global.css`).
- Focus State Mandatory: Because components are custom, developers must strictly build explicit, accessible focus, hover, and disabled states from day one.

## 3. Global Architecture & Navigation

- Dual-Monitor Optimized: The app assumes the accountant has external documents (for example annual reports) open on a second screen. Do not build embedded PDF viewers. Maximize screen real-estate for high-density data and AI analysis.
- Global Context Switching (Cmd+K): A persistent top-bar global command menu allows instantaneous switching between clients (for example Volvo AB) and fiscal years (for example 2024). This must feel as fast as a developer IDE.
- Maker/Checker Workflows: The UI must natively support formal review processes. Data rows require states for `Pending Review`, `AI Confident`, `Manual Override`, and `Approved`. A clear, collapsible audit trail/comment pane must be available for senior reviewers.

## 4. Core Module Specifications

### 4.1 Account Mapping (The Virtualized Grid)

- Continuous Spreadsheet Feel: Render massive SIE account lists as a hyper-smooth, virtualized, infinite-scroll grid (Excel-like).
- Toggle Views: By default, show all accounts. Provide a prominent, snappy toggle: `View All` vs. `Exceptions Only` (filtering down to low AI confidence, unmapped, or overridden rows).
- Hybrid AI-Correction: When AI miscategorizes an account, the user has two correction methods:
  - Direct Override: Clicking the category opens a search-first combobox (type-ahead dropdown) for instant manual correction.
  - Inline AI Command: Selecting single or multiple rows reveals a contextual text input (command bar) to instruct AI (for example "Move all 5000-level accounts to non-deductible").

### 4.2 Tax Adjustments (The Workbench)

- Left-Hand Navigation: Clean sidebar for sub-modules. Group A (Common) is highly visible; Groups B/C are progressively disclosed via smooth accordions.
- Persistent Impact: Pinned `Final Tax Calculation` block at the bottom right or bottom sidebar so users always see live, real-time impact of adjustments.

### 4.3 Drafting the Tax Return (The Cleaned-Up Replica)

- Visual Government Replica: The final output module must visually mirror official Swedish Skatteverket forms (for example INK2/SRU layouts) so accountants recognize the physical layout instantly.
- Modern Execution: Recreate the form using premium UI tokens - crisp typography, thin borders, and subtle Deloitte-green background tints on AI-populated fields. It is a digital-first, elegant homage to the paper form.

## 5. Locked Style Attributes (Strict CSS Constraints)

### 5.1 Color System

- Primary Brand Accent: Deloitte Green family.
  - `#86BC25` (Deloitte Core Green) - Primary buttons, active tabs, AI highlights.
  - `#26890D` (Strong Green) - Hover states, success indicators.
  - `#046A38` (Deep Forest) - Top-level navigation backgrounds.
- Surfaces:
  - `#FFFFFF` (Pure White) for work areas.
  - `#F5F7FA` (Cool, crisp grey) for app shells to make white panels pop.
- Typography:
  - Never pure black.
  - `#111827` (Deep Slate) for primary headings.
  - `#4B5563` (Medium Slate) for secondary text/table headers.

### 5.2 Typography & Shape

- Font Stack: `Open Sans, Arial, Helvetica, sans-serif`.
- Use uppercase + wide letter-spacing for micro-labels (for example `ACCOUNT MAPPING`).
- Border Radius: Strict `4px` (buttons/inputs) to `8px` (panels). No pills.
- Borders & Elevation:
  - Rely on ultra-crisp `1px solid #E5E7EB` borders to separate data.
  - Use large blur, low-opacity shadows (`0 10px 30px rgba(17, 24, 39, 0.05)`) only for floating menus, AI command bars, or dropdowns.

## 6. Accessibility and Motion

- Keyboard Power-User Centric: Visible focus rings (`2px solid #86BC25` with offset) are mandatory. Full grid traversal via arrow keys, Tab, and Enter.
- Snappy Motion: Performance is a feature. Transitions are strict (`150ms - 200ms ease-in-out`).
- Loading: No spinning wheels. Use low-contrast skeleton loaders to make document parsing feel lightning fast.

## 7. Explicit "DO NOT USE" List (Anti-Patterns)

- NO Startup Cliches: Zero glassmorphism, floating 3D blobs, neon glows, or purple/indigo gradient AI motifs.
- NO Legacy ERP Density: Avoid grey-on-grey nested boxes, outdated bevels, microscopic fonts (sub-12px), or overwhelming pagination clicks.
- NO Consumer App Styling: Avoid fully rounded pill buttons, oversized bubbly inputs, or springy/bouncy physics animations.

## 8. Reference Governance

When conflicts occur:

1. `docs/ui-design-references-v4-ai-builder.md`
2. `docs/ui-design-references-v3-final.md`
3. `docs/ui-design-references-v1.md` (governance/index)
4. `docs/ui-ux-architecture-v1.md` for information architecture and screen flows
5. `SINGLE_SOURCE_OF_TRUTH.md` and `AGENTS.md` for product and engineering logic constraints
