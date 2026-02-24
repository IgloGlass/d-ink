# 00-design-system

## Purpose
Define the visual + interaction system for D.ink V1 so the UI stays consistent across modules (Mapping, Tax adjustments, Inbox, etc.) and remains buildable for a solo founder.

## Brand and identity
### Brand posture
- **D.ink is its own brand** with subtle Deloitte alignment.
- **Subtle Deloitte**: neutral base, restrained use of Deloitte green, no heavy Deloitte-branded surfaces.

### Signature motif
- **Deloitte green dot** is the key visual anchor.
- Use it as:
  - Active tab indicator (small dot + underline)
  - “AI-applied” indicator (dot + label)
  - Loader animation (dot pulse)
  - Micro-accent in empty states (illustration uses dot as focal point)

### App shell branding
- Top-left: **“D.ink” wordmark** always visible.
- Clicking wordmark opens **Landing (new tab or same tab, product decision)**.

## Theme and color system
### Themes
- Support **Light** and **Dark** themes from day one.
- Theme selection:
  - Follows **OS/system** by default.
  - Manual toggle available in UI.
- Must be consistent across all pages, dialogs, drawers, toasts.

### Core palette approach
- Neutral grayscale dominates.
- **Deloitte Green** is the primary accent color (not a background fill color).
- Use green for:
  - Primary actions
  - Key status “Ready/Success”
  - Selection indicator (dot/underline)
  - “AI-applied” label accent

### Token model
Use semantic tokens, not raw colors in components.

#### Light theme tokens (suggested)
- `color.bg` = `#FAFAFA`
- `color.surface` = `#FFFFFF`
- `color.surface2` = `#F5F5F5` (secondary panels)
- `color.text.primary` = `#111111`
- `color.text.secondary` = `#53565A`
- `color.border` = `#E6E6E6`
- `color.brand` = `#86BC25` (Deloitte green dot/accent)
- `color.focus` = brand green with alpha (focus ring)
- `color.shadow` = very subtle, sparing use

#### Dark theme tokens (suggested)
- `color.bg` = `#0F1115`
- `color.surface` = `#161A1F`
- `color.surface2` = `#1C2128`
- `color.text.primary` = `#E6E6E6`
- `color.text.secondary` = `#BBBCBC`
- `color.border` = `#2A2F36`
- `color.brand` = `#86BC25`
- `color.focus` = brand green with alpha, stronger than light
- `color.shadow` = avoid heavy shadows; prefer borders

### Semantic status tokens (app-wide)
Three-level attention model (must be consistent across Inbox, tabs, tables, steppers):

- `severity.info`
  - Meaning: FYI, non-blocking guidance.
  - Use: neutral or info tint; never red.
- `severity.needsReview`
  - Meaning: AI-applied but not reviewed; or something needs human confirmation.
  - Primary default filter target.
- `severity.blocking`
  - Meaning: prevents approval/export or later “Filed” state.

Also define:
- `state.success` (Ready/Complete)
- `state.error` (true errors)
- `state.warning` (optional; keep minimal; mostly use needsReview)

**Rule:** do not invent more severities in V1.

## Typography
### Typefaces
- UI: **Open Sans** if licensed/approved internally; otherwise a modern system stack.
- Fallback stack:
  - `Open Sans, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
- Use **tabular numerals** for all monetary/amount columns:
  - `font-variant-numeric: tabular-nums;`

### Sizes (comfortable density)
- Default body: 14–15px
- Table text: 13–14px
- Small labels/badges: 12px
- Headings: restrained (no oversized hero headers inside the app)

### Tone
- **Neutral corporate** microcopy. No playful language, no cheerleading.

## Layout primitives
### Grid and spacing
- 8pt spacing system (8, 16, 24, 32 etc).
- Comfortable density:
  - Avoid “terminal density”
  - Avoid overly spacious padding

### Surface styling
- **Mostly flat** surfaces with crisp borders.
- Minimal shadows only where needed for hierarchy:
  - dropdown menus
  - right drawer separation (optional subtle elevation)
  - modal dialogs

### Desktop-first constraints
- Assume desktop screens as primary target.
- Responsiveness:
  - Must not break on smaller laptops.
  - Mobile support is not a V1 requirement.

## Iconography
- Use **Phosphor icons** (standard library for V1).
- Use consistent weight (e.g., regular).
- Icons support clarity, not decoration.
- Avoid excessive icons in tables; use badges and labels first.

## Motion and animation
### Style
- **Subtle and functional**.
- Premium feel, never obstructive.

### Where animation is allowed
- Dot loader (pulse/bounce, short loop)
- Drawer open/close transition (fast)
- Table row highlight on selection (fade)
- Toast appearance/disappearance
- Empty state illustration can be static; dot can subtly pulse

### Where animation is not allowed
- Confetti
- Long celebratory sequences
- Excessive hover animations

### Performance constraints
- Animations must remain smooth on typical Deloitte laptop hardware.
- Respect “reduce motion” OS setting.

## Core component patterns
These are the canonical components. Modules reference these patterns rather than redefining behavior.

### Tabs (Workspace modules)
- Horizontal tab bar within workspace.
- Active tab indicator uses:
  - green dot + underline (subtle)
- Tabs show status badge/count:
  - `•` incomplete / has items
  - `!` issues
  - `✓` ready
  - optional counts: open blockers, needs review

### Left rail (Submodules)
- Inside a module tab, left rail lists submodules.
- Each submodule shows:
  - Name
  - Status indicator + counts (needs review, blocking, comments)
- Clicking updates URL and loads submodule.

### Right drawer (Details)
- Default visible on wide desktop screens.
- Can be minimized.
- Used for:
  - Details/provenance
  - Comments thread (field-level)
  - Per-item audit snippet + link to full history
  - Per-row confidence (allowed here only)

### Data tables (TanStack Table)
- Used for: Trial balance, Mapping, Adjustments, Inbox.
- Fixed columns for V1 (no user column customization).
- Supports:
  - Sorting (essential)
  - Filtering (at least “needs review”, “blocking”, “show all”)
  - Row selection
  - Inline actions (Accept/Reject/Edit/Comment/Mark reviewed where relevant)
- Avoid complex spreadsheet-like editing in V1; prefer drawer-based edits.

### Badges/chips and row highlighting (mix)
- Use a mix:
  - Badges for categorical states (AI-applied, Not reviewed, Blocking)
  - Light row tint for attention states (very restrained, must work in dark mode)

### Empty states (restrained illustrations)
- Use standard illustration set (V1) with green dot accent.
- Also used for limited onboarding prompts (max 2–3).

## AI interaction design
### Principle
AI is a tax assistant: it should **reduce work**, not create it.

### Default behavior
- AI suggestions are **auto-applied** immediately.
- They are clearly labeled: **AI-applied · Not reviewed**.
- Users primarily:
  - **Reject** (if wrong)
  - **Edit** (if partially correct)
  - **Comment** (if needs discussion)
  - **Mark reviewed** (explicit acknowledgement)

### Review acknowledgement
- Explicit “Mark reviewed” exists:
  - per-row
  - “Mark all reviewed” per submodule
- Review status is distinct from acceptance/rejection.

### Confidence display
- Confidence shown at **submodule level** (header) as a percentage.
- Per-row confidence:
  - Not shown in the table
  - Can be shown in the right drawer only

### Provenance
For each AI-applied item, drawer shows:
- Rationale (short)
- Source links:
  - Trial balance line references
  - Annual report references (page number)
- **Snippet + link**:
  - show excerpt snippet inline
  - include link to open the PDF in a new tab at the relevant page

## Comments design
- Primary mode is **field-level** comments anchored to a row/item.
- Comments appear in the right drawer for the selected item.
- Comments support:
  - resolve/unresolve
  - role visibility (preparer/reviewer)
  - referencing an item is automatic (no manual linking required)

## Audit trail design
Hybrid approach:
- Per item:
  - drawer shows “Last changed by … at …” + “View full history”
- Full audit trail:
  - dedicated tab with filtering and export
- Audit must track:
  - AI applied action
  - human edits
  - rejects
  - approvals
  - “mark reviewed”
  - “mark filed” + attachments

## Internationalization (SV/EN)
### Language support
- Swedish + English day one.
- Language selection:
  - System-detected default
  - Manual toggle available

### Number formats
- Swedish:
  - thousands separator: space
  - decimals: comma
- English:
  - thousands separator: comma
  - decimals: period

### Terminology
- Use official Swedish accounting/tax terms wherever they fit (not abbreviations).
- Avoid abbreviations like “ÅR” in UI labels if the full term fits; use full terms.

## Global search (V1)
- UI: search bar + command palette style.
- Hotkey: **Ctrl+J**
- Scope:
  - Search companies
  - Search within company/workspace: adjustments, accounts, mapping entries, comments, issues
- Behavior:
  - Results navigate to item (no direct action needed in V1)
  - Permission-aware: never show inaccessible items
  - Audit-safe: do not store user search queries (no query logging)

## Client files (in-app, workflow-driven)
- Dedicated “Client files” tab exists.
- Files are uploaded through **specific workflows only** (prompted by app).
- No general file manager behavior.
- Structured folders (V1):
  - `/Inputs/Trial balance`
  - `/Inputs/Annual report`
  - `/Outputs/Exports`
  - `/Approvals`
- “Filed” requires uploading approval/filing proof to `/Approvals` (see navigation doc for flow).
