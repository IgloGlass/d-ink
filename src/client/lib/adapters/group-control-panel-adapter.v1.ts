import type { WorkspaceStatusV1, WorkspaceV1 } from "../http/workspace-api";

export type GroupCompanySummaryV1 = {
  companyId: string;
  fiscalYearEnd: string;
  fiscalYearStart: string;
  latestStatus: WorkspaceStatusV1;
  workspaceId: string;
};

export type GroupControlPanelDataV1 = {
  companies: GroupCompanySummaryV1[];
  groupId: string;
  profile: {
    legalName: string;
    organizationNumber: string;
    registeredAddress: string;
  };
  stageSummary: Array<{
    label: string;
    value: number;
  }>;
};

export interface GroupControlPanelAdapterV1 {
  getGroupOverview: (input: {
    groupId: string;
    workspaces: WorkspaceV1[];
  }) => GroupControlPanelDataV1;
}

export const groupControlPanelAdapterV1: GroupControlPanelAdapterV1 = {
  getGroupOverview: ({ groupId, workspaces }) => {
    const companies = workspaces.map((workspace) => ({
      companyId: workspace.companyId,
      fiscalYearStart: workspace.fiscalYearStart,
      fiscalYearEnd: workspace.fiscalYearEnd,
      latestStatus: workspace.status,
      workspaceId: workspace.id,
    }));

    return {
      groupId,
      profile: {
        legalName: "Nordic Group AB",
        organizationNumber: "556000-0000",
        registeredAddress: "Sveavagen 10, 111 57 Stockholm",
      },
      companies,
      stageSummary: [
        {
          label: "Draft",
          value: companies.filter((company) => company.latestStatus === "draft")
            .length,
        },
        {
          label: "In review",
          value: companies.filter(
            (company) => company.latestStatus === "in_review",
          ).length,
        },
        {
          label: "Approved",
          value: companies.filter(
            (company) => company.latestStatus === "approved_for_export",
          ).length,
        },
        {
          label: "Filed",
          value: companies.filter((company) => company.latestStatus === "filed")
            .length,
        },
      ],
    };
  },
};
