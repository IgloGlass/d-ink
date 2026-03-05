import { spawnSync } from "node:child_process";
import process from "node:process";

const forwardedArgs = process.argv.slice(2);
const defaultArgs = [
  "--name",
  "ralph-frontend-program",
  "--progress-file",
  "scripts/ralph/progress-frontend-program.txt",
  "--gate-command",
  "node scripts/ralph/check-frontend-premium-gates.v1.mjs",
];

const result = spawnSync(
  process.execPath,
  ["scripts/ralph/ralph-program.v1.mjs", ...defaultArgs, ...forwardedArgs],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
