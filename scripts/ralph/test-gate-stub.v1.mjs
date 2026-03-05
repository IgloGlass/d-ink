function parseArgs(argv) {
  let exitCode = Number(process.env.DINK_RALPH_TEST_GATE_EXIT ?? "0");

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--exit-code" && argv[index + 1]) {
      exitCode = Number(argv[index + 1]);
      index += 1;
    }
  }

  if (!Number.isInteger(exitCode) || exitCode < 0) {
    throw new Error("exit code must be a non-negative integer.");
  }

  return exitCode;
}

function main() {
  const exitCode = parseArgs(process.argv.slice(2));
  process.stdout.write(`[ralph:test-gate-stub] exit ${exitCode}\n`);
  process.exit(exitCode);
}

main();
