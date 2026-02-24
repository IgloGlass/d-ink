# System Architecture (V1)

## Goals
- Browser-based, multi-tenant SaaS that helps non-tax accountants produce Swedish corporate tax outputs from client documents.
- Workflow: upload annual report + trial balance → extract/normalize → AI suggestions (mapping/adjustments/narratives) → human edits → deterministic compute + deterministic form population → export.
- **Append-only audit trail** for all material actions and version changes.
- Long-running work continues even if user closes the tab (async jobs + in-app status).

## Key decisions
- Cloud: **Azure**
- Region: **Sweden-only** for V1 (single-region deployment)
- Multi-tenancy: **logical isolation** using `tenant_id` (shared DB, strict scoping)
- Tenant isolation: **defense in depth** with **application-layer scoping + Postgres Row-Level Security (RLS)**
- Auth: **Microsoft Entra ID (SSO)** (company == Entra tenant)
- Roles: **Admin**, **Editor**
- Support: **break-glass tenant access** for internal D.ink support, enabled ahead of time by client Admin, time-bounded, auditable, allows edits/actions
- Inputs: annual report **PDF/DOCX**, TB **CSV/XLSX**, evidence **images** (Outlook attachments later)
- Files: raw uploads stored long-term (Blob Storage)
- AI: allowed to extract/suggest/draft narratives; **final calculation and INK2 PDF population are deterministic code**
- AI hosting: **inside Azure** (Azure OpenAI or private Azure model endpoint); no client content sent to non-Azure third parties
- Queue: **Azure Service Bus**
- Backend shape: **modular monolith** (single API service + worker service), internally partitioned by modules with strict interfaces
- Collaboration: no real-time collaboration in V1
- Workflow: no explicit state machine; status derived from artifacts + job states
- Versions: “latest is active” (no pinning/branching in V1)
- Job failures: support **retry** and **re-upload**; preserve attempts in audit trail

---

## High-level components

### Web App (Browser)
- Uploads files, starts jobs, shows status, renders results.
- Allows accept/reject AI proposals and structured edits across modules.
- Generates exports by triggering export jobs.
- Uses Entra ID tokens to call the API.

### Web API (Stateless backend)
- Tenant-scoped authorization + role checks.
- Issues background jobs and provides job status endpoints.
- Serves versioned data to UI (TB, mapping, adjustments, drafts, exports).
- Enforces invariants:
  - No cross-tenant access
  - No silent overwrites (new versions only)
  - AI outputs must pass schema validation before persistence

### Worker Service (Background jobs)
Runs asynchronous tasks:
- Word→PDF conversion (if needed) and text extraction
- Parsing/normalization of TB CSV/XLSX formats to canonical schema
- AI extraction and suggestion generation (schema-bound)
- Deterministic compute (tax summary)
- Deterministic form population (INK2R/INK2S PDFs)
- Export package generation (INK2 PDF + adjustment specification PDF)

### Postgres (Structured data store)
Stores:
- tenants, users, roles, support grants
- company + fiscal-year workspaces (“engagements”)
- file metadata + job state
- normalized TB and derived artifacts (versioned)
- mapping/adjustment decision sets (versioned)
- tax summary outputs (versioned)
- form drafts (versioned)
- export package records
- append-only audit events

### Azure Blob Storage (Object store)
Stores:
- all raw uploads (PDF/DOCX/CSV/XLSX/images)
- generated artifacts (exports)
- access via time-limited SAS issued by API or API-proxied downloads (tenant-scoped)

### Azure Service Bus (Job dispatch)
- Durable queue so work continues after browser disconnect.
- Dead-lettering and retry policies for failed jobs.

### AI Integration Wrapper (Internal module)
- Centralizes prompt/model handling and output validation.
- All AI outputs must be valid JSON per strict schemas:
  - annual report extracted fields
  - mapping suggestions
  - adjustment suggestions
  - narrative drafts
- AI outputs are **proposals**; deterministic modules produce final computation and INK2 PDFs.
- AI executes inside Azure boundary (Azure-hosted).

### Audit Module (Append-only events)
- Every module emits append-only events for key actions.
- Audit events are immutable.

---

## Azure reference deployment (V1)
- Azure Container Apps:
  - `api` (HTTP)
  - `worker` (jobs)
- Azure Database for PostgreSQL (RLS enabled for tenant-scoped tables)
- Azure Blob Storage
- Azure Service Bus
- Azure Key Vault for secrets (recommended)
- Entra ID (OIDC/OAuth2)

---

## Product hierarchy (V1)
- **Tenant → Company → Fiscal Year → Workspace/Engagement**
- Workspace is the operational unit: one workspace corresponds to one company + one fiscal year engagement (e.g., “ClientCo – FY2025”).
- Files, jobs, versions, and audit trail attach to the workspace.

---

## Module boundaries (aligned with AGENTS.md)
- ingest/files
- parsing
- validation
- ai
- mapping
- adjustments
- calculation
- forms
- exports
- workflow (job + artifact status aggregation)
- audit

Each module owns its types and exposes contracts; no reach-in imports.

---

## Core workflows

### Upload annual report → extract (async) → review
- Upload → Blob + File record
- Job enqueued → worker extracts text → AI extraction (Azure-hosted) → schema validate → persist extracted fields (new version)
- UI polls job status and renders extracted fields

### Upload TB → normalize (async) → mapping suggestions → user edits
- Upload → normalize TB → persist normalized TB (new version)
- AI suggests mapping → persist proposed mapping decision set version
- User edits/accepts → new mapping decision set version

### Revised TB upload behavior (V1)
- Multiple TB uploads per workspace are allowed.
- When a revised TB arrives:
  - system attempts to carry forward mapping/adjustments where accounts align
  - creates new proposed decision set versions and flags “TB changed—review suggested”
  - latest versions become active

### Adjustments → deterministic compute → deterministic INK2 PDFs → export
- AI suggests adjustments → user edits/accepts (new versions)
- Deterministic compute produces tax summary (new version)
- Deterministic form population produces INK2 PDFs (derived from latest versions)
- Export job generates and stores:
  - INK2 PDF
  - adjustment specification PDF
- SRU export is V2

---

## Tenancy, authorization, and support access

### Tenant isolation (logical + RLS)
- Every DB row includes `tenant_id`.
- Data access layer enforces tenant scoping for all reads/writes.
- **Postgres RLS policies** enforce tenant isolation inside the database (defense in depth), keyed off a per-request/session tenant context (e.g., `app.tenant_id`).
- Blob paths are tenant-prefixed.

### Roles
- **Admin:** manage users/roles, company settings, enable/disable support access, retention defaults.
- **Editor:** upload, trigger jobs/AI actions, edit decision sets and drafts, run compute, export.
- Any **Editor** may trigger AI actions in V1.

### Support (break-glass)
- Client Admin can enable support access in settings ahead of time, with expiry window.
- Internal support users can be granted tenant-scoped access when enabled.
- Support can perform edits/actions for troubleshooting and remediation.
- Support actions require a reason string and emit audit events; touched versions are tagged.

---

## Audit trail and versioning

### Versioning
Key artifacts are versioned (no overwrites):
- extracted fields
- normalized TB
- mapping decision set
- adjustment decision set
- tax summary
- form drafts
- export package metadata

Active artifact = latest version.

### Audit events (append-only)
Minimum fields:
- `tenant_id`, `workspace_id`, `actor_user_id`, `actor_type` (client/support), `timestamp`
- `action`
- `entity_type`, `entity_id`, `version_id` (when applicable)
- `reason` (required for support actions)
- `context` (metadata)

---

## Async jobs and UI status
- Any non-trivial work runs as a job.
- UI supports:
  - polling job status
  - retry failed jobs
  - re-upload to start a new attempt (old attempts remain in audit trail)

---

## Security notes (V1 / V2)
- V1: strict tenant scoping + Entra auth + RLS + versioned artifacts + append-only audit.
- V2: malware scanning/content sanitization in upload pipeline.

---
