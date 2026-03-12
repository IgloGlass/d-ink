import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const appUrl = process.env.DINK_PLAYWRIGHT_APP_URL ?? "http://localhost:5173";
const outputDir = path.join(process.cwd(), "output", "playwright");
const screenshotPath = path.join(outputDir, "annual-report-module.png");

function createLaunchOptions() {
  return {
    headless: true,
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      ...createLaunchOptions(),
      channel: "msedge",
    });
  } catch {
    // Fallback to bundled Chromium if Edge channel resolution is unavailable.
    return chromium.launch(createLaunchOptions());
  }
}

async function openWorkspaceFromCompanyLanding(page) {
  const openCompanyButton = page.getByRole("button", { name: "Open company" });
  const createWorkspaceButton = page.getByRole("button", {
    name: /Create .* workspace/,
  });

  if ((await openCompanyButton.count()) > 0) {
    await openCompanyButton.first().click();
    return;
  }

  if ((await createWorkspaceButton.count()) > 0) {
    await createWorkspaceButton.first().click();
    return;
  }

  throw new Error(
    `Unable to find an Open company or Create workspace action. Current URL: ${page.url()}`,
  );
}

async function main() {
  mkdirSync(outputDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
  });
  const page = await context.newPage();

  try {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.waitForURL(/\/app\/workspaces/, { timeout: 30_000 });

    await openWorkspaceFromCompanyLanding(page);
    await page.waitForURL(/\/app\/workspaces\/[^/]+$/, { timeout: 30_000 });

    const workspaceId = page.url().split("/").at(-1);
    if (!workspaceId) {
      throw new Error("Unable to resolve a workspace id from the workspace page.");
    }

    await page.goto(
      `${appUrl}/app/workspaces/${workspaceId}/annual-report-analysis`,
      {
        waitUntil: "networkidle",
      },
    );

    await page
      .locator(".module-shell--annual-report .module-shell__layout")
      .waitFor({ timeout: 30_000 });

    const mainWorkbench = page.locator(".annual-report-sidebar--main").first();
    const forensicRail = page.locator(".annual-report-side-rail").first();

    await mainWorkbench.waitFor({ timeout: 30_000 });
    await forensicRail.waitFor({ timeout: 30_000 });

    const mainBox = await mainWorkbench.boundingBox();
    const railBox = await forensicRail.boundingBox();

    if (!mainBox || !railBox) {
      throw new Error("Unable to measure annual report layout columns.");
    }

    if (mainBox.width <= railBox.width) {
      throw new Error(
        `Expected main extraction workbench to be wider than the forensic rail, got ${mainBox.width} <= ${railBox.width}.`,
      );
    }

    const clearButtonCount = await page
      .getByRole("button", { name: "Clear annual report data" })
      .count();

    if (clearButtonCount > 1) {
      throw new Error(
        `Expected at most one clear-data button, found ${clearButtonCount}.`,
      );
    }

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        clearButtonCount,
        forensicRailWidth: Math.round(railBox.width),
        screenshotPath,
        workspaceId,
        workbenchWidth: Math.round(mainBox.width),
      })}\n`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
