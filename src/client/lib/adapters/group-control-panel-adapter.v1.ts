import type { CompanySummaryV1 } from "../http/company-api";
import type { WorkspaceStatusV1, WorkspaceV1 } from "../http/workspace-api";

export type GroupCompanySummaryV1 = {
  companyId: string;
  companyName: string;
  fiscalYearEnd: string;
  fiscalYearStart: string;
  latestStatus: WorkspaceStatusV1;
  organizationNumber: string;
  workspaceId: string;
};

export type GroupControlPanelDataV1 = {
  companies: GroupCompanySummaryV1[];
  groupId: string;
  profile: {
    legalName: string;
    organizationNumber: string;
  };
  stageSummary: Array<{
    label: string;
    value: number;
  }>;
};

export interface GroupControlPanelAdapterV1 {
  getGroupOverview: (input: {
    companies: CompanySummaryV1[];
    groupId: string;
    workspaces: WorkspaceV1[];
  }) => GroupControlPanelDataV1;
}

export const groupControlPanelAdapterV1: GroupControlPanelAdapterV1 = {
  getGroupOverview: ({ companies, groupId, workspaces }) => {
    const companyRows = workspaces.map((workspace) => {
      const company =
        companies.find((candidate) => candidate.id === workspace.companyId) ?? null;

      return {
        companyId: workspace.companyId,
        companyName:
          company?.legalName ?? `Company ${workspace.companyId.slice(0, 8)}`,
        organizationNumber: company?.organizationNumber ?? "Unknown",
        fiscalYearStart: workspace.fiscalYearStart,
        fiscalYearEnd: workspace.fiscalYearEnd,
        latestStatus: workspace.status,
        workspaceId: workspace.id,
      };
    });

    return {
      groupId,
      profile: {
        legalName: companyRows.length === 1 ? companyRows[0].companyName : `Group (${companyRows.length} companies)`,
        organizationNumber: companyRows.length === 1 ? companyRows[0].organizationNumber : "Multiple",
      },
      companies: companyRows,
      stageSummary: [
        {
          label: "Draft",
          value: companyRows.filter((company) => company.latestStatus === "draft")
            .length,
        },
        {
          label: "In review",
          value: companyRows.filter(
            (company) => company.latestStatus === "in_review",
          ).length,
        },
        {
          label: "Approved",
          value: companyRows.filter(
            (company) => company.latestStatus === "approved_for_export",
          ).length,
        },
        {
          label: "Filed",
          value: companyRows.filter((company) => company.latestStatus === "filed")
            .length,
        },
      ],
    };
  },
};
