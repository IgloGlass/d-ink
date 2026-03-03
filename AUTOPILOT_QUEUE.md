# AUTOPILOT_QUEUE v1

Each ticket must be represented as a standalone JSON block. Keep IDs stable.

## Ticket NIGHT-001
```json
{
  "ticket_id": "NIGHT-001",
  "status": "DONE",
  "title": "Create nightly autopilot kickoff artifact",
  "goal": "Create a deterministic kickoff artifact proving ticket execution and branch isolation work end-to-end.",
  "files_to_edit": [
    "docs/autopilot-demo/night-001-kickoff.md"
  ],
  "files_not_to_edit": [
    "src/**",
    "package.json",
    "pnpm-lock.yaml"
  ],
  "requirements": [
    "Write only the file listed in files_to_edit.",
    "Record run id, ticket id, and timestamp in the artifact."
  ],
  "acceptance_criteria": [
    "Artifact file exists with deterministic metadata fields.",
    "Autopilot updates queue metadata and opens a PR."
  ],
  "tests_to_add_or_run": [
    "corepack pnpm run autopilot:validate"
  ],
  "output_summary_format": "Include changed file, metadata captured, and validation results.",
  "notes": "Synthetic bootstrap ticket for first continuous run.\r\nBranch: codex/ticket-night-001 | Run: run-1772498497259",
  "risk_level": "low"
}
```

## Ticket NIGHT-002
```json
{
  "ticket_id": "NIGHT-002",
  "status": "DONE",
  "title": "Create nightly autopilot follow-up artifact",
  "goal": "Create a second independent artifact so the same run processes multiple tickets back-to-back.",
  "files_to_edit": [
    "docs/autopilot-demo/night-002-follow-up.json"
  ],
  "files_not_to_edit": [
    "src/**",
    "package.json",
    "pnpm-lock.yaml"
  ],
  "requirements": [
    "Write only the file listed in files_to_edit.",
    "Output JSON with run id, ticket id, branch name, and timestamp."
  ],
  "acceptance_criteria": [
    "JSON artifact is valid and includes the required fields.",
    "Ticket is handled in the same continuous run after NIGHT-001."
  ],
  "tests_to_add_or_run": [
    "corepack pnpm run autopilot:validate"
  ],
  "output_summary_format": "Include changed file, JSON fields emitted, and validation results.",
  "notes": "Synthetic bootstrap ticket to verify no downtime between tickets.\r\nBranch: codex/ticket-night-002 | Run: run-1772498560422\r\nCommit: 6f59136103b7443cbc80b5b131452e5200d820ff | Branch: codex/ticket-night-002 | PR: https://github.com/IgloGlass/d-ink/pull/10 | Run: run-1772498560422",
  "risk_level": "low"
}
```
