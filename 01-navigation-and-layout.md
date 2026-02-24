# 01-navigation-and-layout

## Purpose
Define the workspace information architecture and navigation patterns:
- Workspace tabs (modules)
- Submodule left rail
- Always-visible right drawer (minimizable)
- Workspace Inbox (top-level)
- Client files tab and folder structure
- Onboarding checklist
- Global search behavior
So each module can be specified consistently and built once.

## User roles and access model (UI perspective)
Roles in V1:
- **Admin**
  - sees Admin area (users, templates, settings)
- **Preparer**
  - edits mapping and adjustments, uploads documents, resolves issues
- **Reviewer**
  - reviews, comments, requests changes, approves for export

Core UI rule:
- **Front end never enforces permissions alone.** Backend is the source of truth.
- UI must still reflect permissions (hide or read-only) to reduce confusion.

## Workspace structure
A workspace corresponds to a company/year return workflow (and optionally group context).

### Workspace header (always visible within workspace)
Contains:
- Company name
- Year
- Current workspace status pill (e.g., Draft / In review / Changes requested / Ready for approval / Approved for export / Exported / Client accepted / Filed)
- “Last updated”
- Assigned to (optional)
- Primary actions (role-gated):
  - Export
  - Approve (Reviewer only)
  - Mark filed (when applicable)
- Onboarding checklist indicator (until complete)

## Primary navigation: Workspace tabs (modules)
Tabs across top of workspace content area:

1. **Inbox** (top-level, always available)
2. **Overview**
3. **Documents**
4. **Trial balance**
5. **Mapping**
6. **Tax adjustments**
7. **Review**
8. **Client files**
9. **Audit trail**
10. **Export**

Notes:
- Tabs are stable and always in the same order.
- Tabs show badges:
  - blocking count (high priority)
  - needs-review count (medium)
  - optionally open comments count (low)
- Tabs can be read-only if user lacks permission.

### Tab badge rules
Badge logic is based on three-level attention system:

- **Blocking**: prevents progress to approval/export/filing states.
- **Needs review**: AI-applied not reviewed; not necessarily blocking.
- **Info**: FYI items; shown inside modules, not as primary badge.

Recommendation:
- Tab shows:
  - blocking count (if >0)
  - else needs-review count (if >0)
  - else ✓ if “ready”
  - else • if “in progress”

## Secondary navigation: Submodules inside a tab
For tabs with multiple sections (Mapping, Tax adjustments, Review), use a left rail list.

### Standard module layout
- Left rail: submodule list
- Main pane: table or structured content for selected submodule
- Right drawer: details/comments/provenance (visible by default, minimizable)

### URL structure
Deep linking required:
- `/workspaces/:workspaceId/inbox`
- `/workspaces/:workspaceId/mapping/:submoduleId`
- `/workspaces/:workspaceId/adjustments/:submoduleId`
- Drawer selection can optionally be encoded:
  - `?selected=:rowId`

## Right drawer behavior
### Default
- Visible by default on desktop.
- Shows content for selected row/item.
- If nothing selected:
  - shows contextual help or “Select an item to view details.”

### Minimize
- User can minimize drawer.
- Minimized state persists within the session (optional persist in user prefs later).

### Drawer content modules
Depending on context, drawer shows:
- Summary details
- AI rationale + provenance (snippets + links)
- Field-level comments thread
- Audit snippet (“last changed by …”) + link to history
- Row-level confidence (drawer only)

## Workspace Inbox (top-level tab)
### Purpose
A single view to manage all work requiring attention across modules, especially in group contexts (multiple companies).

### Scope and grouping
Inbox is divided by:
- **Group → Company → Module → Submodule**
(If group context not applicable, omit group header.)

### What appears in Inbox
Items that are:
- **Blocking**
- **Needs review**
Also optional: unresolved comments/tasks.

### Actionability
Inbox supports:
- Inline actions (fast):
  - Reject
  - Mark reviewed
  - Edit (opens drawer or navigates)
- Navigation link:
  - “Open in module” deep links to the exact row.

### V1 refresh behavior
- Counts/badges update on navigation or refresh.
- Real-time global syncing not required in V1.

## Documents tab
### Purpose
Upload and manage:
- Annual report (Årsredovisning PDF)
- Trial balance import

Key rules:
- Upload is guided (no general file manager behavior here).
- Processing states visible (uploaded, extracting, ready, failed).
- Document references used in provenance (page numbers).

PDF viewing:
- V1 acceptable: open PDF in a **new tab**.
- Drawer shows snippet + link to open page.

## Client files tab (in-app, structured folders)
### Purpose
Provide a controlled “client file folder” feel without becoming a general drive.

### Folder structure (fixed V1)
- `/Inputs/Trial balance`
- `/Inputs/Annual report`
- `/Outputs/Exports`
- `/Approvals`

### Upload constraints
Users can upload only when prompted by workflows:
- Upload Annual report → saved to `/Inputs/Annual report`
- Upload Trial balance → saved to `/Inputs/Trial balance`
- Export output → saved to `/Outputs/Exports`
- Mark filed requires proof → saved to `/Approvals`

UI in Client files tab:
- Folder tree left (or top)
- File list main
- File metadata drawer right (reuse right drawer pattern)
- Actions:
  - download/open
  - view metadata
  - (limited) upload only when workflow allows

## Export tab
### Purpose
Generate export artifacts (PDF; SRU later).
- Export action creates a versioned output stored in `/Outputs/Exports`.
- Export does not lock the return in V1 by default (locking comes later at Filed).

## Filing and locking behavior
### Principle
You requested hard locking only after:
- client has reviewed and accepted, and
- return has been filed.

### Status progression (UI)
At minimum include:
- Draft
- In review
- Changes requested
- Ready for approval
- Approved for export
- Exported
- Client accepted
- Filed (locked)

### Filed (V1)
Because V1 doesn’t submit electronically:
- “Filed” is set manually by user:
  - **Button: “Mark as filed”**
  - **Requires** uploading proof/approval artifact (attachment)
  - Stored in `/Approvals`

### Locked UI (Filed)
When status is Filed:
- UI becomes “sealed”
  - lock icon in header
  - inputs disabled + visually muted
  - destructive actions hidden
  - drawer shows read-only state
- Still allow:
  - view
  - export/download artifacts
  - audit trail access

## Onboarding checklist (lightweight)
### Purpose
Help novices without turning the app into a wizard.

Displayed in workspace header until complete:
- 1) Upload Annual report
- 2) Upload Trial balance
- 3) Review mapping
- 4) Review tax adjustments
- 5) Export (and optionally: Client accepted, Filed)

Behavior:
- Checklist shows progress counts.
- Once complete:
  - collapses to “All steps complete ✓” indicator.

## Global search
### Entry points
- Search icon/field in app shell
- Hotkey **Ctrl+J**

### Results
- Permission-aware results only.
- Clicking a result navigates to the relevant company/workspace/module row.
- V1: results are navigation-only (no actions).

### Privacy
- Search queries are not stored (audit-safe).
- Analytics may track usage event “search_opened” and “result_clicked” without storing query string.

## Language and formatting controls
- Language toggle accessible from user menu or app shell.
- Theme toggle accessible from user menu or app shell.
- Both respect system defaults.

## Acceptance criteria checklist (for engineers/QA)
- Tabs render consistently across modules with correct badge logic.
- Left rail appears only where defined; selection updates URL.
- Right drawer default visible and minimizable; stable behavior across modules.
- Inbox groups by Company → Module → Submodule; supports inline action + navigate link.
- AI-applied items show “AI-applied · Not reviewed”; Mark reviewed exists per row and mark-all per submodule.
- Default filters show needs-review items; “Show all” exists.
- Client files show structured folders and restrict uploads to workflow prompts.
- PDF opens in new tab; drawer shows snippet + link to page.
- Filed requires attachment; Filed state locks editing and shows sealed UI.
- SV/EN language toggle works; number formats match locale.
- Ctrl+J opens global search; results are permission-aware; query string not logged.
