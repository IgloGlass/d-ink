# 01-navigation-and-layout

## Purpose
Define the high-velocity workspace navigation and layout patterns for D.ink V1.

## High-Level Information Architecture
1. **App Entry**: `CompanySelectorPageV1` (Search-First Hero)
2. **Workspace Landing**: `WorkspaceWorkbenchPageV1` (Module Stats + Roadmap)
3. **Task Modules**: `CoreModuleShellPageV1` (Tabbed sequential workflow)

---

## 1. App Entry: Company Selector
- **Primary View**: High-impact hero section with a 64px tall search input.
- **Goal**: User finds their client in < 2 seconds.
- **Action**: "Continue" enters the active workspace; "Initialize" bootstraps a new fiscal year.
- **Secondary**: Collapsible "Create Company" form below the main list.

## 2. Workspace Layout (The Shell)
The `AppShell` provides the global context:
- **Header (64px)**:
  - Brand: `Deloitte.`
  - Global Navigation: `Workspaces`, `Groups`.
  - Context Controls: Quick Search (`Ctrl+J`), Locale, Logout.
- **Sub-Header (Secondary Tabs)**:
  - Persistent tabs for the 4 core modules:
    1. `Annual Report`
    2. `Account Mapping`
    3. `Tax Adjustments`
    4. `Tax Return INK2`
  - *Implementation Note*: These tabs use CSS-hiding to keep background AI tasks alive during navigation.

---

## 3. Core Module Layouts

### Module 01: Annual Report Analysis
- **Layout**: Centered single-column.
- **Interaction**: Large drag-and-drop zone for PDF.
- **Output**: Forensic Audit Report + Extracted Financials.

### Module 02: Account Mapping Workbench
- **Layout**: Full-width high-performance grid.
- **Features**:
  - Virtualized scroll (supports 5000+ accounts).
  - Column resizing.
  - Bulk action toolbar (Appears at bottom or top on selection).
  - Inline search for categories.

### Module 03: Tax Adjustments Workbench
- **Layout**: Dual-pane.
- **Left Rail (320px)**: Submodule list (Common vs Advanced) + Pinned "Real-time Tax Summary".
- **Main Area**: Adjustment forms and AI proposals.

### Module 04: Tax Return INK2
- **Layout**: "Form Replica" view.
- **UI**: Visual digital twin of the official paper form.
- **Provenance**: Distinct visual styles for manual entries vs AI-calculated fields.

---

## 4. Navigation Shortcuts
- **Quick Switch**: `Ctrl+J` / `Cmd+K` opens the workspace launcher.
- **Tab Swapping**: Sequential keys (1, 2, 3, 4) for core modules (V2).
- **Esc**: Closes any modal, launcher, or dropdown.

## 5. Mobile / Tablet Strategy
- **Desktop First**: V1 is optimized for 1440p+ displays (tax work is high-density).
- **Responsive**: Layout stacks to single-column below 1280px; Sidebar moves to top-toggle.
