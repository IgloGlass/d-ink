import type { WorkspaceStatusV1 } from "../lib/http/workspace-api";
import type { StatusToneV1 } from "./status-badge-v1";

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

const statusToneByValueV1: Record<WorkspaceStatusV1, StatusToneV1> = {
  draft: "neutral",
  in_review: "warning",
  changes_requested: "attention",
  ready_for_approval: "warning",
  approved_for_export: "success",
  exported: "success",
  client_accepted: "success",
  filed: "success",
};

export function StatusPill({ status }: { status: WorkspaceStatusV1 }) {
  return (
    <span className="status-pill" data-tone={statusToneByValueV1[status]}>
      {statusLabelByValueV1[status]}
    </span>
  );
}
