import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();

function createPrdFixture(input) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "ralph-loop-smoke-"));
  const prdPath = path.join(tempDir, "prd.fixture.json");
  const initialPass = input.initialPass ?? false;
  const userStories = Array.from({ length: input.storyCount }, (_, index) => ({
    id: `T-${String(index + 1).padStart(2, "0")}`,
    title: `Fixture story ${index + 1}`,
    priority: index + 1,
    passes: initialPass,
    description: "Fixture story for loop smoke testing.",
    filesToEdit: ["src/client/styles/global.css"],
    acceptanceCriteria: ["N/A fixture"],
    verificationCommands: ['node -e "process.exit(0)"'],
  }));
  writeFileSync(
    prdPath,
    `${JSON.stringify({ contextNotes: [], userStories }, null, 2)}\n`,
    "utf8",
  );
  return { prdPath, tempDir };
}

function runNodeScript({ scriptPath, args, env }) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function assertExitCode(result, expected, label) {
  assert.equal(
    result.status,
    expected,
    `${label}: expected exit ${expected}, received ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function runScenario(name, fn) {
  process.stdout.write(`\n[smoke] ${name}\n`);
  fn();
  process.stdout.write(`[smoke] PASS: ${name}\n`);
}

function genericBaseArgs(input) {
  return [
    "--name",
    "smoke-program",
    "--prd",
    input.prdPath,
    "--sweeps",
    String(input.sweeps ?? 1),
    "--max-per-sweep",
    String(input.maxPerSweep ?? 1),
    "--consecutive-green",
    String(input.consecutiveGreen ?? 1),
    "--progress-file",
    input.progressFile,
  ];
}

function main() {
  const genericScript = "scripts/ralph/ralph-program.v1.mjs";
  const frontendWrapperScript = "scripts/ralph/ralph-frontend-program.v1.mjs";

  runScenario("auto-adjust max-per-sweep to story count", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 3 });
    const progressFile = path.join(tempDir, "progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: [
          ...genericBaseArgs({
            consecutiveGreen: 1,
            maxPerSweep: 1,
            prdPath,
            progressFile,
            sweeps: 1,
          }),
          "--gate-command",
          "node scripts/ralph/test-gate-stub.v1.mjs --exit-code 0",
        ],
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(result, 0, "auto-adjust max-per-sweep to story count");
      assert.match(result.stdout, /max-per-sweep raised to 3/i);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("clamp consecutive-green when higher than sweeps", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 2 });
    const progressFile = path.join(tempDir, "progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: [
          ...genericBaseArgs({
            consecutiveGreen: 5,
            maxPerSweep: 2,
            prdPath,
            progressFile,
            sweeps: 2,
          }),
          "--gate-command",
          "node scripts/ralph/test-gate-stub.v1.mjs --exit-code 0",
        ],
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(
        result,
        0,
        "clamp consecutive-green when higher than sweeps",
      );
      assert.match(result.stdout, /consecutive-green reduced to 2/i);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("retry transient loop exit and recover", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 1 });
    const progressFile = path.join(tempDir, "progress.txt");
    const stateFile = path.join(tempDir, "state.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: [
          ...genericBaseArgs({
            consecutiveGreen: 1,
            maxPerSweep: 1,
            prdPath,
            progressFile,
            sweeps: 1,
          }),
          "--gate-command",
          "node scripts/ralph/test-gate-stub.v1.mjs --exit-code 0",
        ],
        env: {
          DINK_RALPH_LOOP_COMMAND: `node scripts/ralph/test-loop-stub.v1.mjs --mode fail-once-then-pass --exit-code 3221226091 --state-file ${stateFile} --prd {PRD}`,
          DINK_RALPH_LOOP_RETRIES: "1",
        },
      });

      assertExitCode(result, 0, "retry transient loop exit and recover");
      assert.match(result.stdout, /Retrying loop command \(2\/2\)/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("do not retry non-transient loop failure", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 1 });
    const progressFile = path.join(tempDir, "progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: genericBaseArgs({
          consecutiveGreen: 1,
          maxPerSweep: 1,
          prdPath,
          progressFile,
          sweeps: 1,
        }),
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode fail --exit-code 9 --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "3",
        },
      });

      assertExitCode(result, 1, "do not retry non-transient loop failure");
      assert.doesNotMatch(result.stdout, /Retrying loop command/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("gate failure keeps sweep red even when stories pass", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 2 });
    const progressFile = path.join(tempDir, "progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: [
          ...genericBaseArgs({
            consecutiveGreen: 1,
            maxPerSweep: 2,
            prdPath,
            progressFile,
            sweeps: 1,
          }),
          "--gate-command",
          "node scripts/ralph/test-gate-stub.v1.mjs --exit-code 1",
        ],
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(
        result,
        1,
        "gate failure keeps sweep red even when stories pass",
      );
      assert.match(result.stdout, /Sweep 1 => RED/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("source PRD remains unchanged across sweeps", () => {
    const { prdPath, tempDir } = createPrdFixture({
      initialPass: true,
      storyCount: 1,
    });
    const progressFile = path.join(tempDir, "progress.txt");
    const before = readFileSync(prdPath, "utf8");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: genericBaseArgs({
          consecutiveGreen: 1,
          maxPerSweep: 1,
          prdPath,
          progressFile,
          sweeps: 1,
        }),
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(result, 0, "source PRD remains unchanged across sweeps");
      const after = readFileSync(prdPath, "utf8");
      assert.equal(
        after,
        before,
        "source PRD should not be rewritten by runner",
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("generic mode works with no gate command", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 1 });
    const progressFile = path.join(tempDir, "progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: genericBaseArgs({
          consecutiveGreen: 1,
          maxPerSweep: 1,
          prdPath,
          progressFile,
          sweeps: 1,
        }),
        env: {
          DINK_RALPH_GATES_COMMAND: "",
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(result, 0, "generic mode works with no gate command");
      assert.match(result.stdout, /Sweep 1 => GREEN/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("default loop command template uses unquoted runner path", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 1 });
    const progressFile = path.join(tempDir, "progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: [
          ...genericBaseArgs({
            consecutiveGreen: 1,
            maxPerSweep: 1,
            prdPath,
            progressFile,
            sweeps: 1,
          }),
          "--dry-run",
        ],
        env: {
          DINK_RALPH_GATES_COMMAND: "",
        },
      });

      assertExitCode(
        result,
        0,
        "default loop command template uses unquoted runner path",
      );
      assert.doesNotMatch(result.stdout, /node "/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("custom progress file is honored", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 1 });
    const progressFile = path.join(tempDir, "custom-progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: genericScript,
        args: genericBaseArgs({
          consecutiveGreen: 1,
          maxPerSweep: 1,
          prdPath,
          progressFile,
          sweeps: 1,
        }),
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(result, 0, "custom progress file is honored");
      assert.equal(
        existsSync(progressFile),
        true,
        "progress file should exist",
      );
      const progressContents = readFileSync(progressFile, "utf8");
      assert.match(progressContents, /Run configuration/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  runScenario("frontend wrapper delegates to generic program", () => {
    const { prdPath, tempDir } = createPrdFixture({ storyCount: 1 });
    const progressFile = path.join(tempDir, "frontend-progress.txt");
    try {
      const result = runNodeScript({
        scriptPath: frontendWrapperScript,
        args: [
          "--prd",
          prdPath,
          "--sweeps",
          "1",
          "--max-per-sweep",
          "1",
          "--consecutive-green",
          "1",
          "--progress-file",
          progressFile,
          "--gate-command",
          "node scripts/ralph/test-gate-stub.v1.mjs --exit-code 0",
        ],
        env: {
          DINK_RALPH_LOOP_COMMAND:
            "node scripts/ralph/test-loop-stub.v1.mjs --mode pass-all --prd {PRD}",
          DINK_RALPH_LOOP_RETRIES: "0",
        },
      });

      assertExitCode(
        result,
        0,
        "frontend wrapper delegates to generic program",
      );
      assert.match(result.stdout, /\[ralph-frontend-program\]/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  process.stdout.write("\n[smoke] All loop smoke tests passed.\n");
}

main();
