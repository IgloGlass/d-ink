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

const workspaceStatusesNeedingAttentionV1 = new Set<WorkspaceStatusV1>([
  "changes_requested",
]);
const workspaceStatusesInProgressV1 = new Set<WorkspaceStatusV1>([
  "in_review",
  "ready_for_approval",
]);
const workspaceStatusesCompletedV1 = new Set<WorkspaceStatusV1>([
  "approved_for_export",
  "exported",
  "client_accepted",
  "filed",
]);

function getWorkspaceStatusToneV1(status: WorkspaceStatusV1): StatusToneV1 {
  if (workspaceStatusesNeedingAttentionV1.has(status)) {
    return "attention";
  }

  if (workspaceStatusesCompletedV1.has(status)) {
    return "success";
  }

  if (workspaceStatusesInProgressV1.has(status)) {
    return "warning";
  }

  return "neutral";
}

export function getWorkspaceStatusBadgeMetaV1(status: WorkspaceStatusV1): {
  label: string;
  tone: StatusToneV1;
} {
  return {
    label: workspaceStatusLabelByValueV1[status],
    tone: getWorkspaceStatusToneV1(status),
  };
}

export function getWorkspaceStatusAggregateToneV1(
  statuses: WorkspaceStatusV1[],
): StatusToneV1 {
  if (statuses.some((status) => workspaceStatusesNeedingAttentionV1.has(status))) {
    return "attention";
  }

  if (statuses.some((status) => workspaceStatusesInProgressV1.has(status))) {
    return "warning";
  }

  if (
    statuses.length > 0 &&
    statuses.every((status) => workspaceStatusesCompletedV1.has(status))
  ) {
    return "success";
  }

  return "neutral";
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
