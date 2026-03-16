import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";
import * as XLSX from "xlsx";

const appUrl = process.env.DINK_PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:5173";
const outputDir = path.join(process.cwd(), "output", "playwright");
const tbFilePath = path.join(outputDir, "account-mapping-bs-is-smoke.xlsx");
const screenshotPath = path.join(outputDir, "account-mapping-bs-is-smoke-result.png");

function createWorkbook(filePath) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Account Name", "Account Number", "Opening Balance", "Closing Balance"],
    ["Software platform", "1012", "1000", "1500"],
    ["Consulting revenue", "3010", "0", "400"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "TB");
  XLSX.writeFile(workbook, filePath);
}

function createLaunchOptions() {
  return { headless: true };
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      ...createLaunchOptions(),
      channel: "msedge",
    });
  } catch {
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
  createWorkbook(tbFilePath);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
  });
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  try {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.waitForURL(/\/app\/workspaces/, { timeout: 30_000 });

    await openWorkspaceFromCompanyLanding(page);
    await page.waitForURL(/\/app\/workspaces\/[^/]+$/, { timeout: 30_000 });

    const workspaceId = page.url().split("/").at(-1);
    if (!workspaceId) {
      throw new Error("Unable to resolve workspace id from URL.");
    }

    await page.goto(`${appUrl}/app/workspaces/${workspaceId}/account-mapping`, {
      waitUntil: "networkidle",
    });

    await page.getByText("Upload trial balance", { exact: true }).waitFor({ timeout: 30_000 });

    const fileInput = page.locator(".module-upload-drop-zone__input").first();
    await fileInput.setInputFiles(tbFilePath);

    const importButton = page
      .getByRole("button", { name: /Import trial balance|Import a new trial balance/ })
      .first();
    await importButton.click();

    const softwareCategorySelect = page.getByLabel("Category for 1012");
    await softwareCategorySelect.waitFor({ timeout: 240_000 });

    const optionValues = await page.$$eval(
      'select[aria-label="Category for 1012"] option',
      (options) => options.map((option) => option.getAttribute("value") ?? ""),
    );

    const hasBalanceFallback = optionValues.includes("100000");
    const hasIncomeFallback = optionValues.includes("950000");

    if (!hasBalanceFallback) {
      throw new Error("Expected BS fallback category 100000 to be available for account 1012.");
    }
    if (hasIncomeFallback) {
      throw new Error("Unexpected IS fallback category 950000 in BS account dropdown for 1012.");
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        workspaceId,
        screenshotPath,
        optionValuesCount: optionValues.length,
        includes100000: hasBalanceFallback,
        includes950000: hasIncomeFallback,
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
