import fs from "node:fs";
import path from "node:path";

import XLSX from "xlsx";

const TEMPLATE_VERSION = "v1";

// Keep column metadata centralized so adding/reordering columns remains trivial.
const columns = [
  { key: "account_name", header: "Account Name" },
  { key: "account_number", header: "Account Number" },
  { key: "opening_balance", header: "Opening Balance" },
  { key: "closing_balance", header: "Closing Balance" },
];

const sampleRows = [
  {
    account_name: "Share capital",
    account_number: "2081",
    opening_balance: 50000,
    closing_balance: 50000,
  },
  {
    account_name: "Bank",
    account_number: "1930",
    opening_balance: 150000,
    closing_balance: 162500,
  },
  {
    account_name: "Consulting revenue",
    account_number: "3041",
    opening_balance: 0,
    closing_balance: -240000,
  },
];

const dataSheetRows = [
  columns.map((column) => column.header),
  ...sampleRows.map((row) => columns.map((column) => row[column.key] ?? "")),
];

const workbook = XLSX.utils.book_new();
const dataSheet = XLSX.utils.aoa_to_sheet(dataSheetRows);
dataSheet["!cols"] = [{ wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

const instructionsSheet = XLSX.utils.aoa_to_sheet([
  ["D.ink Trial Balance Template", TEMPLATE_VERSION.toUpperCase()],
  [""],
  ["Required columns (do not rename):"],
  ...columns.map((column) => [`- ${column.header}`]),
  [""],
  ["Notes:"],
  ["- Extra columns are allowed; required columns must remain present."],
  ["- Account numbers are treated as text and can include custom patterns."],
  ["- Duplicate account numbers are allowed; parser will suffix duplicates."],
  [""],
  ["Download source", "/templates/trial-balance-template-v1.xlsx"],
]);
instructionsSheet["!cols"] = [{ wch: 70 }, { wch: 20 }];

XLSX.utils.book_append_sheet(workbook, dataSheet, "Trial Balance");
XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

const outputPath = path.resolve(
  process.cwd(),
  "public",
  "templates",
  "trial-balance-template-v1.xlsx",
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
XLSX.writeFile(workbook, outputPath);

// eslint-disable-next-line no-console
console.log(`Generated: ${outputPath}`);
