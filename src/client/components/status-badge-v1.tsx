import type { WorkspaceStatusV1 } from "../lib/http/workspace-api";

export type StatusToneV1 = "neutral" | "success" | "warning" | "attention";

const workspaceStatusLabelByValueV1: Record<WorkspaceStatusV1, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  ready_for_approval: "Ready for approval",
  approved_for_export: "Approved for export",
  exported: "Exported",
  client_accepted: "Client accepted",
  filed: "Filed",
};

const workspaceStatusToneByValueV1: Record<WorkspaceStatusV1, StatusToneV1> = {
  draft: "neutral",
  in_review: "warning",
  changes_requested: "attention",
  ready_for_approval: "warning",
  approved_for_export: "success",
  exported: "success",
  client_accepted: "success",
  filed: "success",
};

export function getWorkspaceStatusBadgeMetaV1(status: WorkspaceStatusV1): {
  label: string;
  tone: StatusToneV1;
} {
  return {
    label: workspaceStatusLabelByValueV1[status],
    tone: workspaceStatusToneByValueV1[status],
  };
}

export function StatusBadgeV1({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusToneV1;
}) {
  return (
    <span className="status-badge-v1" data-tone={tone}>
      <span className="status-badge-v1__dot" aria-hidden="true" />
      <span className="status-badge-v1__label">{label}</span>
    </span>
  );
}
