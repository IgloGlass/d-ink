import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function collectTypeScriptFilesV1(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFilesV1(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      absolutePath.endsWith(".ts") &&
      !absolutePath.endsWith(".test.ts")
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

function main() {
  const repoRoot = process.cwd();
  const srcRoot = resolve(repoRoot, "src");
  const files = collectTypeScriptFilesV1(srcRoot);
  const disallowedConsoleFiles = [];

  for (const absoluteFilePath of files) {
    const source = readFileSync(absoluteFilePath, "utf8");
    const hasConsoleCall = /console\.(?:error|warn|log|info|debug)\(/.test(
      source,
    );
    if (!hasConsoleCall) {
      continue;
    }

    const relPath = relative(repoRoot, absoluteFilePath).replace(/\\/g, "/");
    if (relPath !== "src/worker.ts") {
      disallowedConsoleFiles.push(relPath);
    }
  }

  if (disallowedConsoleFiles.length > 0) {
    throw new Error(
      [
        "Unsafe logging guard failed:",
        "Console logging is only allowed in src/worker.ts with redaction.",
        ...disallowedConsoleFiles.map((filePath) => `- ${filePath}`),
      ].join("\n"),
    );
  }

  const workerPath = resolve(repoRoot, "src", "worker.ts");
  const workerSource = readFileSync(workerPath, "utf8");
  if (!workerSource.includes("redactSensitiveLogFieldsV1")) {
    throw new Error(
      "Unsafe logging guard failed: src/worker.ts must use redactSensitiveLogFieldsV1.",
    );
  }
}

main();

