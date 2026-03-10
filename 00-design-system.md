# 00-design-system (Deloitte Ascend / Next-Gen Enterprise)

## Purpose
Define the high-contrast, professional, and AI-powered visual + interaction system for D.ink V1. This system prioritizes authority, precision, and efficiency for financial professionals.

## Brand and identity
### Brand posture
- **Deloitte Ascend**: A "Next-Gen Enterprise" aesthetic. High contrast, sharp, and authoritative.
- **Posture**: Trust over trend. Precision over playfulness.

### Signature motif
- **Deloitte Green (#86BC25)**: The primary visual anchor. Used sparingly as a high-impact accent.
- **Motif usage**:
  - Active tab indicators (solid bottom border).
  - AI confidence bars and highlights.
  - Primary action buttons.
  - Status "Success" indicators.
  - Drag-and-drop active states.

## Theme and color system (High Contrast)
### Core palette: High-Contrast Zinc
Dominated by a grayscale palette from pure white to deep zinc black.

- **Background (App)**: `#FAFAFA` (Zinc-50) - Crisp, cool gray to make white panels pop.
- **Surface (Primary)**: `#FFFFFF` - Pure white for work areas and cards.
- **Surface (Muted)**: `#F4F4F5` (Zinc-100) - For headers, sidebars, and nested panels.
- **Text (Primary)**: `#18181B` (Zinc-900) - Deep, almost-black for maximum readability.
- **Text (Secondary)**: `#71717A` (Zinc-500) - For hints and metadata.
- **Border (Subtle)**: `#E4E4E7` (Zinc-200).
- **Border (Strong)**: `#D4D4D8` (Zinc-300).

### Accent palette: Deloitte Green
- **Primary**: `#86BC25`.
- **Hover**: `#76A820`.
- **Muted**: `rgba(134, 188, 37, 0.1)`.
- **Highlight**: `rgba(134, 188, 37, 0.25)`.

## Typography
### Typefaces
- **Primary**: **Open Sans** (400, 600, 700, 800 weights).
- **Fallback**: Modern system stack.
- **Monospace**: Tabular numerals for all financial data (`font-variant-numeric: tabular-nums`).

### Hierarchy
- **Brand Wordmark**: 18-20px, Extra Bold (800), tracking -0.025em.
- **Hero Headings**: 30-36px, Extra Bold, Black.
- **Section Headings**: 18-24px, Bold, Black.
- **Micro-labels**: 10-12px, Extra Bold, Uppercase, Tracking 0.05em+.

## Layout and Shape
### Surface styling
- **Sharp Corners**: `radius: 0px` for primary cards and tables to convey a "Precision Instrument" feel.
- **Subtle Elevation**: Minimal use of `shadow-sm` and `shadow-md`.
- **Hero Cards**: Top-border accent (4px solid Black or Deloitte Green).

### Grid and Spacing
- **8pt system**: (8, 16, 24, 32, 48, 64).
- **Micro-density**: Tight data rows (40-48px height).
- **Macro-whitespace**: Generous padding (24-48px) between major layout sections.

## Interaction Patterns
### Drag and Drop (First-Class)
- **Drop Zones**: Large, dashed-border areas for PDF/Excel uploads.
- **Active State**: Ring highlight (`#86BC25`) and background tint on drag-over.
- **Grid Drag**: Support for file drops directly onto data tables for import.

### Performance and Persistance
- **Persistent State**: Use CSS-based tab switching (display: block/hidden) instead of conditional rendering.
- **Why**: Ensures long-running AI parsing/mapping tasks are not interrupted by navigation.

### Specialized Module Components
- **Virtualized Grid (`AccountMappingGridV1`)**:
  - High-performance rendering for 1000+ rows.
  - Column resizing via drag-handles.
  - Bulk action bar (fixed overlay when rows selected).
- **Dual-Pane Workbench (`TaxAdjustmentsWorkbenchV1`)**:
  - Pinned sidebar navigation + Pinned real-time tax impact panel.
- **Form Replica (`Ink2FormReplicaV1`)**:
  - Digital twin of official Skatteverket forms.
  - High-contrast grid with AI field highlighting.

## Global Search / Launcher (V1)
- **Hotkey**: `Ctrl+J` or `Cmd+K`.
- **UI**: Modal command palette with backdrop-blur.
- **Scope**: Search clients, workspaces, and navigation modules.

## AI interaction design
- **AI-Applied**: Tinted backgrounds (`#86BC25` at 5-10% opacity).
- **Confidence**: Integrated micro-progress bars (Green/Yellow/Red).
- **Provenance**: Manual override indicators (pencil icon) clearly distinguish human from machine.
