import type { WorkspaceStatusV1 } from "../lib/http/workspace-api";

const statusLabelByValueV1: Record<WorkspaceStatusV1, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  ready_for_approval: "Ready for approval",
  approved_for_export: "Approved for export",
  exported: "Exported",
  client_accepted: "Client accepted",
  filed: "Filed",
};

export function StatusPill({ status }: { status: WorkspaceStatusV1 }) {
  return (
    <span className={`status-pill status-pill--${status.replaceAll("_", "-")}`}>
      {statusLabelByValueV1[status]}
    </span>
  );
}
