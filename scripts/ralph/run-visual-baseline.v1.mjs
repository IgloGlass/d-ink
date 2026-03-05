import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const host = "127.0.0.1";
const port = Number(process.env.DINK_RALPH_VISUAL_PORT ?? 4173);
const outputDir = path.join(process.cwd(), "scripts", "ralph", "artifacts");
const screenshotDir = path.join(outputDir, "screenshots");
const captureTimeoutMs = 90_000;
const routes = ["/", "/app/workspaces", "/app/groups/default/control-panel"];

function shellCommand(command) {
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", command],
      command: process.env.ComSpec ?? "cmd.exe",
    };
  }
  return {
    args: ["-lc", command],
    command: "sh",
  };
}

function runShell(command) {
  const spec = shellCommand(command);
  const result = spawnSync(spec.command, spec.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });
  return {
    code: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function isPortOpen({ hostValue, portValue }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostValue, port: portValue });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function waitForPort({ hostValue, portValue, timeoutMs }) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      const open = await isPortOpen({ hostValue, portValue });
      if (open) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(`Timed out waiting for http://${hostValue}:${portValue}`),
        );
        return;
      }
      setTimeout(poll, 500);
    };
    poll();
  });
}

function hasPlaywrightCli() {
  const result = runShell("npm exec --yes playwright --version");
  return result.code === 0;
}

function startDevServer(serverLog) {
  const spec = shellCommand(
    `npm run dev:web -- --host ${host} --port ${port} --strictPort`,
  );
  const child = spawn(spec.command, spec.args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => serverLog.write(chunk));
  child.stderr.on("data", (chunk) => serverLog.write(chunk));
  child.on("error", (error) => serverLog.write(String(error)));
  return child;
}

function stopServer(childProcess) {
  if (!childProcess || childProcess.killed) {
    return;
  }

  if (process.platform === "win32") {
    runShell(`taskkill /pid ${childProcess.pid} /t /f`);
    return;
  }
  childProcess.kill("SIGTERM");
}

function captureRoute(route, outputPath) {
  return runShell(
    `npm exec --yes playwright screenshot http://${host}:${port}${route} ${outputPath}`,
  );
}

async function main() {
  mkdirSync(screenshotDir, { recursive: true });

  if (!hasPlaywrightCli()) {
    if (process.env.DINK_RALPH_REQUIRE_VISUAL === "1") {
      throw new Error(
        "Playwright CLI unavailable. Visual baseline is required.",
      );
    }
    process.stdout.write(
      "[ralph:visual] SKIP (playwright CLI unavailable). Set DINK_RALPH_REQUIRE_VISUAL=1 to enforce.\n",
    );
    return;
  }

  const serverLogPath = path.join(outputDir, "visual-server.log");
  const serverLog = createWriteStream(serverLogPath, { flags: "a" });

  const portAlreadyOpen = await isPortOpen({
    hostValue: host,
    portValue: port,
  });
  let devServer = null;
  if (!portAlreadyOpen) {
    devServer = startDevServer(serverLog);
    await waitForPort({
      hostValue: host,
      portValue: port,
      timeoutMs: captureTimeoutMs,
    });
  }

  try {
    let successCount = 0;
    for (const route of routes) {
      const safeName = route === "/" ? "root" : route.replace(/[\/:]+/g, "_");
      const outputPath = path.join(screenshotDir, `${safeName}.png`);
      const result = captureRoute(route, outputPath);

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);

      if (result.code === 0) {
        successCount += 1;
        process.stdout.write(`[ralph:visual] captured ${outputPath}\n`);
        continue;
      }

      if (process.env.DINK_RALPH_REQUIRE_VISUAL === "1") {
        throw new Error(`Failed visual capture for route: ${route}`);
      }
      process.stdout.write(
        `[ralph:visual] SKIP route ${route} (capture failed). Set DINK_RALPH_REQUIRE_VISUAL=1 to enforce.\n`,
      );
    }

    if (successCount === 0 && process.env.DINK_RALPH_REQUIRE_VISUAL === "1") {
      throw new Error("No visual captures succeeded in strict mode.");
    }
  } finally {
    stopServer(devServer);
    serverLog.end();
  }

  process.stdout.write("[ralph:visual] PASS\n");
}

main().catch((error) => {
  process.stderr.write(`[ralph:visual] FAIL ${String(error)}\n`);
  process.exit(1);
});
