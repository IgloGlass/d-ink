# AUTOPILOT_QUEUE v1

Each ticket must be represented as a standalone JSON block. Keep `ticket_id` stable forever.

## Ticket TEMPLATE-001
```json
{
  "ticket_id": "TEMPLATE-001",
  "status": "BLOCKED",
  "title": "Template ticket - duplicate before use",
  "goal": "Use this template to add real tickets for overnight automation runs.",
  "files_to_edit": [
    "src/path/to/file.ts"
  ],
  "files_not_to_edit": [
    "src/server/http/**",
    "src/db/migrations/**"
  ],
  "requirements": [
    "One module boundary per ticket unless explicitly required by contract versioning."
  ],
  "acceptance_criteria": [
    "Feature behavior is implemented and validated against the ticket goal.",
    "No edits are made outside files_to_edit except tests and queue metadata."
  ],
  "tests_to_add_or_run": [
    "corepack pnpm run test:server"
  ],
  "output_summary_format": "Include: changed files, behavior summary, tests run, risks.",
  "depends_on": [],
  "notes": "Duplicate this block and change ticket_id before setting status to READY.",
  "risk_level": "low"
}
```
