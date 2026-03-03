# Ralph (Codex Loop)

This project includes a Codex-native Ralph loop for iterative implementation.

## Files

- `scripts/ralph/ralph-codex.mjs` - Iterative loop runner
- `scripts/ralph/prd.ui-ux-polish.v1.json` - UI/UX polish stories
- `scripts/ralph/progress.txt` - Append-only loop log

## Run

```bash
node scripts/ralph/ralph-codex.mjs --prd scripts/ralph/prd.ui-ux-polish.v1.json --max 3
```

## How it works

1. Reads PRD stories from JSON.
2. Picks the highest-priority story with `"passes": false`.
3. Spawns a fresh `codex exec` process with strict story instructions.
4. Runs verification commands from the story.
5. Marks the story as passed only if:
   - Codex returns `RALPH_STATUS:PASS`
   - All verification commands pass
6. Appends notes to `scripts/ralph/progress.txt`.
