import type { CompanySummaryV1 } from "./http/company-api";
import type { WorkspaceV1 } from "./http/workspace-api";

function readYearPartV1(isoDate: string): number {
  return Number.parseInt(isoDate.slice(0, 4), 10);
}

function replaceYearPartV1(isoDate: string, year: number): string {
  return `${year}${isoDate.slice(4)}`;
}

export function getFiscalYearKeyV1(input: {
  fiscalYearEnd: string;
}): string {
  return String(readYearPartV1(input.fiscalYearEnd));
}

export function formatFiscalYearLabelV1(input: {
  fiscalYearStart: string;
  fiscalYearEnd: string;
}): string {
  return `${input.fiscalYearStart} to ${input.fiscalYearEnd}`;
}

export function buildFiscalYearOptionsV1(input: {
  companies: CompanySummaryV1[];
  workspaces: WorkspaceV1[];
  includeCurrentYear?: boolean;
}): string[] {
  const years = new Set<string>();

  for (const workspace of input.workspaces) {
    years.add(getFiscalYearKeyV1({ fiscalYearEnd: workspace.fiscalYearEnd }));
  }

  for (const company of input.companies) {
    years.add(
      getFiscalYearKeyV1({ fiscalYearEnd: company.defaultFiscalYearEnd }),
    );
  }

  if (input.includeCurrentYear ?? true) {
    years.add(String(new Date().getFullYear()));
  }

  return [...years].sort((left, right) => Number(right) - Number(left));
}

export function resolveWorkspaceForCompanyAndFiscalYearV1(input: {
  companyId: string;
  fiscalYearKey: string | null;
  workspaces: WorkspaceV1[];
}): WorkspaceV1 | null {
  const matchingWorkspaces = input.workspaces.filter(
    (workspace) => workspace.companyId === input.companyId,
  );

  if (matchingWorkspaces.length === 0) {
    return null;
  }

  if (!input.fiscalYearKey) {
    return matchingWorkspaces[0] ?? null;
  }

  return (
    matchingWorkspaces.find(
      (workspace) =>
        getFiscalYearKeyV1({ fiscalYearEnd: workspace.fiscalYearEnd }) ===
        input.fiscalYearKey,
    ) ?? null
  );
}

export function deriveFiscalYearRangeForSelectionV1(input: {
  company: CompanySummaryV1;
  fiscalYearKey: string;
}): {
  fiscalYearEnd: string;
  fiscalYearStart: string;
} {
  const selectedEndYear = Number.parseInt(input.fiscalYearKey, 10);
  const defaultEndYear = readYearPartV1(input.company.defaultFiscalYearEnd);
  const yearDelta = selectedEndYear - defaultEndYear;
  const defaultStartYear = readYearPartV1(input.company.defaultFiscalYearStart);

  return {
    fiscalYearStart: replaceYearPartV1(
      input.company.defaultFiscalYearStart,
      defaultStartYear + yearDelta,
    ),
    fiscalYearEnd: replaceYearPartV1(
      input.company.defaultFiscalYearEnd,
      defaultEndYear + yearDelta,
    ),
  };
}

export function replaceWorkspaceIdInPathnameV1(input: {
  nextWorkspaceId: string;
  pathname: string;
}): string {
  return input.pathname.replace(
    /^(\/app\/workspaces\/)([^/]+)/i,
    `$1${input.nextWorkspaceId}`,
  );
}
