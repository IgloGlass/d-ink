# AI Execution Patterns V1

This document captures reusable implementation rules from the annual-report hardening work. New AI modules should follow these patterns unless a ticket explicitly documents why a different approach is required.

## Goals
- Keep deterministic logic in code and AI logic narrow.
- Reduce token cost, retries, and timeout risk.
- Make degraded behavior visible instead of silent.
- Preserve clean module boundaries so one module can evolve without breaking others.

## Core rules

### 1) Deterministic first, AI second
- Use deterministic routing, shaping, validation, and merge logic before calling AI.
- Use AI only for the parts that genuinely need interpretation or synthesis.
- Do not ask AI to do arithmetic, final totals, schema repair, or cross-stage orchestration.

### 2) Keep stage boundaries explicit
- Each AI stage should have one job, one contract, and one merge responsibility.
- Prefer small stage-specific helpers over large executors that route, prompt, retry, merge, and sanitize in one place.
- Downstream modules should consume stable projections, not executor-internal shapes.

### 3) Use the smallest useful document shape
- Prefer extracted text over PDF/image input when the source is extractable and the stage does not need layout.
- Prefer routed note/page subsets over whole-document prompts.
- Prefer field-specific context over duplicating the same evidence in multiple payload sections.

### 4) Text first, fallback second
- For extractable documents, try text-first prompts before heavier PDF/image prompts.
- Only escalate to a heavier document shape when deterministic quality gates show the lighter result is unusable or materially incomplete.
- Do not pay for both light and heavy modes by default.

### 5) Make degraded states first-class
- Fallback and degraded outputs must be explicit in the artifact contract and UI.
- Do not mark deterministic fallback results as indistinguishable from full AI results.
- If a stage could not use the intended source, surface the reason clearly.

### 6) Bind artifacts to exact source lineage
- Persist enough lineage metadata to reload the exact source that produced an artifact.
- Never switch to a newer or merely similar file silently.
- If the exact source is unavailable, keep going only when the product allows it and mark the result degraded.

### 7) Prefer single-purpose retries
- Retry only when the likely failure mode is transient.
- Keep retry count low and stage-specific.
- Before increasing a timeout, reduce prompt size, chunk size, or document weight.

### 8) Avoid duplicate evidence
- Store note/evidence catalogs once and let downstream contexts reference or selectively backfill them.
- Do not duplicate the same narrative evidence into multiple prompt payloads unless the downstream contract truly requires it.
- When backfilling, only fill missing or sparse sections.

### 9) Long AI work needs durable orchestration
- Any stage that can take more than a few seconds should run as a durable processing run with progress, completion, degraded, and failure states.
- UI mutations should not hide long-running AI work behind one synchronous request.

### 10) Honest fallbacks over clever concealment
- Deterministic fallbacks are allowed when they preserve product continuity.
- They must not hide model failure, missing source data, or schema loss.
- Fallback artifacts should remain useful but clearly labeled.

## Module-boundary checklist
Before an AI stage or module change is merged, confirm:
- The contract is versioned and runtime-validated.
- Deterministic helpers own routing, merge precedence, and final calculations.
- The AI stage receives only the minimum context it needs.
- Retries and time budgets are justified by the document shape and task.
- Degraded and fallback behavior are visible to users and to downstream consumers.
- The output can be consumed through a stable projection instead of executor internals.

## Applying this to account mapper
- Prefer deterministic BAS/account-number and keyword rules before any AI classification.
- Use AI only for genuinely ambiguous or unsupported accounts.
- Keep mapping evidence compact and avoid sending the full trial balance when a smaller subset will do.
- Make fallback mapping states explicit, especially when a deterministic fallback or user override is carrying the decision.
- Keep annual-report ingestion and account-mapper logic connected only through shared contracts, not direct implementation imports.
