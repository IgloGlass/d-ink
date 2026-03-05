import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const workspaceRoot = process.cwd();

const requiredTokenMap = {
  "--color-brand-primary": "#86bc25",
  "--color-brand-hover": "#26890d",
  "--color-brand-deep": "#046a38",
  "--color-surface-app": "#f5f7fa",
  "--color-surface-panel": "#ffffff",
  "--color-text-heading": "#111827",
  "--color-text-body": "#374151",
  "--color-text-muted": "#6b7280",
  "--radius-sm": "4px",
  "--radius-md": "8px",
};

const bannedPatternRules = [
  {
    pattern: /backdrop-filter\s*:/i,
    reason: "Glassmorphism effect is disallowed.",
  },
  {
    pattern: /#(?:6366f1|4f46e5|4338ca|8b5cf6|7c3aed|6d28d9|a855f7)\b/i,
    reason: "Indigo/purple accents are disallowed.",
  },
];

const bannedImportRules = [
  /from\s+["']@mui\//,
  /from\s+["']antd["']/,
  /from\s+["']bootstrap["']/,
  /from\s+["']@chakra-ui\//,
];

function readFile(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  return readFileSync(absolutePath, "utf8");
}

function fail(message, failures) {
  failures.push(message);
}

function normalizeHex(input) {
  return input.trim().toLowerCase();
}

function parseTokenMap(input) {
  const matches = [...input.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)];
  const map = new Map();
  for (const match of matches) {
    const name = match[1].trim();
    const value = match[2].trim();
    map.set(name, value);
  }
  return map;
}

function checkRequiredTokens(tokensCss, failures) {
  const found = parseTokenMap(tokensCss);
  for (const [name, expected] of Object.entries(requiredTokenMap)) {
    if (!found.has(name)) {
      fail(`Missing required token: ${name}`, failures);
      continue;
    }
    const actual = found.get(name);
    const expectedNormalized = expected.startsWith("#")
      ? normalizeHex(expected)
      : expected;
    const actualNormalized = expected.startsWith("#")
      ? normalizeHex(actual)
      : actual;
    if (actualNormalized !== expectedNormalized) {
      fail(
        `Token ${name} mismatch. Expected ${expectedNormalized}, found ${actualNormalized}.`,
        failures,
      );
    }
  }
}

function checkGlobalCssRules(globalCss, failures) {
  if (
    !/font-family\s*:\s*["']Open Sans["'],\s*Arial,\s*sans-serif\s*;/i.test(
      globalCss,
    )
  ) {
    fail("Global font stack must be Open Sans, Arial, sans-serif.", failures);
  }

  if (!/\.app-header[\s\S]*?height\s*:\s*56px\s*;/i.test(globalCss)) {
    fail("Global header must enforce height: 56px.", failures);
  }

  if (
    !/\.app-shell[\s\S]*?grid-template-rows\s*:\s*56px\s+1fr\s*;/i.test(
      globalCss,
    )
  ) {
    fail(
      "App shell must reserve 56px top row in grid-template-rows.",
      failures,
    );
  }

  for (const rule of bannedPatternRules) {
    if (rule.pattern.test(globalCss)) {
      fail(`Banned style detected in global.css: ${rule.reason}`, failures);
    }
  }

  const gradientRegex =
    /(linear-gradient|radial-gradient|conic-gradient)\s*\(/gi;
  const gradientMatches = [...globalCss.matchAll(gradientRegex)];
  for (const match of gradientMatches) {
    const index = match.index ?? 0;
    const contextStart = Math.max(0, index - 260);
    const context = globalCss.slice(contextStart, index);
    const isSkeletonGradient = /\.skeleton-v1[\s\S]*$/i.test(context);
    if (!isSkeletonGradient) {
      fail(
        "Gradient detected outside allowed skeleton loading styles.",
        failures,
      );
      break;
    }
  }

  const radiusMatches = [
    ...globalCss.matchAll(/border-radius\s*:\s*(\d+)px\s*;/gi),
  ];
  for (const match of radiusMatches) {
    const value = Number(match[1]);
    if (value > 8) {
      fail(
        `Detected border-radius ${value}px in global.css. Max allowed is 8px.`,
        failures,
      );
    }
  }
}

function checkClientImports(frontendSource, failures) {
  for (const regex of bannedImportRules) {
    if (regex.test(frontendSource)) {
      fail(
        `Disallowed component-library import found in client source: ${regex}`,
        failures,
      );
    }
  }
}

function main() {
  const failures = [];

  const tokensCss = readFile("src/client/styles/tokens.css");
  const globalCss = readFile("src/client/styles/global.css");
  const appShellTsx = readFile("src/client/components/app-shell.tsx");
  const workbenchTsx = readFile(
    "src/client/features/workspaces/workspace-workbench-page.v1.tsx",
  );
  const moduleShellTsx = readFile(
    "src/client/features/modules/core-module-shell-page.v1.tsx",
  );
  const localeJson = readFile("src/client/lib/i18n/locales/en.v1.json");

  checkRequiredTokens(tokensCss, failures);
  checkGlobalCssRules(globalCss, failures);
  checkClientImports(
    [appShellTsx, workbenchTsx, moduleShellTsx].join("\n"),
    failures,
  );

  const hasLauncherBinding =
    /event\.key\.toLowerCase\(\)\s*===\s*["']j["']/.test(appShellTsx) &&
    /event\.ctrlKey/.test(appShellTsx);
  if (!hasLauncherBinding) {
    fail("Global launcher shortcut binding for Ctrl + J is missing.", failures);
  }

  if (!/"nav\.commandHint"\s*:\s*"Ctrl \+ J"/.test(localeJson)) {
    fail("Locale command hint must remain 'Ctrl + J'.", failures);
  }

  if (!/workspace-layout--tax/i.test(globalCss)) {
    fail("Tax workspace layout class is missing from global styles.", failures);
  }

  if (failures.length > 0) {
    process.stderr.write("[ralph:guardrails] FAIL\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("[ralph:guardrails] PASS\n");
}

main();
