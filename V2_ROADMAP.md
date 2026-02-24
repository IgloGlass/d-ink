# D.ink V2 Roadmap

Status: Living document  
Last updated: 2026-02-24  
Owner: Product + Engineering

## Purpose

Define the post-demo evolution path from V1 to a more production-grade platform while preserving modularity and auditability.

## V2 Goals

- Introduce enterprise identity and tenancy controls
- Expand tax and evidence handling coverage
- Improve collaboration and governance
- Increase reliability, observability, and operational maturity

## Baseline Carried from V1

- Human-in-the-loop default
- Deterministic compute/forms/exports
- Structured AI outputs and schema validation
- Versioned artifacts and append-only audit trail
- Strict module boundaries and contract tests

## Roadmap Tracks

## Track A: Platform and Identity

Target outcomes:

- Azure hosting baseline
- Entra ID SSO
- stronger tenant administration controls
- clean migration from V1 magic-link auth to enterprise identity

Candidate deliverables:

- Move API/worker/data plane from V1 stack to Azure
- Entra ID auth and tenant onboarding flow
- migration path from V1 invite-based magic links to SSO-backed identities
- role model evolution (optionally reintroduce `Preparer`/`Reviewer`)
- support access policy hardening (time-boxing + reason enforcement + alerting)

## Track B: Inputs and Evidence

Target outcomes:

- richer supporting material ingestion
- improved evidence provenance

Candidate deliverables:

- image/email/attachment evidence uploads
- evidence-to-finding linking in mapping/adjustments/form fields
- stronger extraction confidence and review UX for mixed document sets

## Track C: Tax Coverage and Exports

Target outcomes:

- broader case coverage beyond V1 baseline
- more complete handoff outputs

Candidate deliverables:

- SRU export stabilization
- deeper adjustment module set
- out-of-scope detection improvements
- extended INK2 field coverage and validation rules

## Track D: Workflow and Controls

Target outcomes:

- stronger review governance and task workflows
- better control for multi-user teams

Candidate deliverables:

- expanded review states/rules if needed
- role-aware approval gates
- SLA-like inbox/task handling and assignment controls

## Track E: Reliability, Security, and Ops

Target outcomes:

- lower operational risk
- stronger observability and incident response

Candidate deliverables:

- upload malware/content scanning pipeline
- improved retries, dead-letter handling, and recovery tooling
- operational dashboards for job health and model runs
- data retention and compliance controls

## Suggested Delivery Sequence

1. Platform and Identity (Track A)
2. Reliability and Security foundations from Track E
3. Inputs and Evidence (Track B)
4. Tax Coverage and Exports (Track C)
5. Workflow/controls enhancements (Track D)

This order reduces platform rework and keeps feature work on a stable base.

## Definition of Ready (V2 Epics)

Each V2 epic should include:

- module boundary impact statement
- schema contract changes and versioning plan
- migration strategy (`V1 -> V2` adapters if required)
- unit tests + contract tests + golden-case updates
- audit event additions/changes

## Definition of Done (V2)

- code compiles
- tests pass
- schemas validate
- auditability preserved
- no cross-module regressions
- rollout and rollback plan documented

## Change Log

- 2026-02-24: Initial V2 roadmap drafted from resolved V1 baseline.
- 2026-02-24: Added explicit V1 auth-to-V2 identity migration scope (magic-link to Entra SSO).
