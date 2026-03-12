import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const esbuildModulePath = path.join(
  repoRoot,
  "node_modules",
  ".pnpm",
  "node_modules",
  "esbuild",
  "lib",
  "main.js",
);
const { build } = await import(pathToFileURL(esbuildModulePath).href);
const entryPoint = path.join(
  repoRoot,
  "scripts",
  "run-annual-report-speed-regression.v1.ts",
);
const outputDirectory = path.join(
  repoRoot,
  "output",
  "annual-report-speed-regression",
);
const outputFile = path.join(
  outputDirectory,
  "run-annual-report-speed-regression.bundle.cjs",
);

mkdirSync(outputDirectory, { recursive: true });

await build({
  bundle: true,
  entryPoints: [entryPoint],
  format: "cjs",
  outfile: outputFile,
  platform: "node",
  sourcemap: false,
  target: "node20",
});

process.stdout.write(`${outputFile}\n`);
