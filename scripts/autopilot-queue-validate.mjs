#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { parseAutopilotQueueMarkdownV1 } from "./lib/night-autopilot-core.mjs";

const queuePath = process.argv[2] ?? "AUTOPILOT_QUEUE.md";

async function main() {
  const source = await readFile(queuePath, "utf8");
  const queue = parseAutopilotQueueMarkdownV1(source);

  const countsByStatus = new Map();
  for (const ticket of queue.tickets) {
    countsByStatus.set(
      ticket.status,
      (countsByStatus.get(ticket.status) ?? 0) + 1,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        queuePath,
        tickets: queue.tickets.length,
        countsByStatus: Object.fromEntries(countsByStatus),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown queue validation error.";
  console.error(`AUTOPILOT_QUEUE validation failed: ${message}`);
  process.exitCode = 1;
});
