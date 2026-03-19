import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  type WorkspaceStatusV1,
  applyWorkspaceTransitionV1,
} from "../lib/http/workspace-api";

interface WorkspaceStatusTransitionV1Props {
  currentStatus: WorkspaceStatusV1;
  tenantId: string;
  workspaceId: string;
  onTransitionSuccess: (newStatus: WorkspaceStatusV1) => void;
}

const ALLOWED_TRANSITIONS: Record<WorkspaceStatusV1, WorkspaceStatusV1[]> = {
  draft: ["in_review"],
  in_review: ["changes_requested", "ready_for_approval"],
  changes_requested: ["draft"],
  ready_for_approval: ["approved_for_export"],
  approved_for_export: ["exported", "draft"],
  exported: ["client_accepted", "draft"],
  client_accepted: ["filed", "draft"],
  filed: ["draft"],
};

const TRANSITION_LABELS: Record<WorkspaceStatusV1, string> = {
  in_review: "Submit for Review",
  changes_requested: "Request Changes",
  ready_for_approval: "Mark Ready for Approval",
  approved_for_export: "Approve for Export",
  exported: "Mark as Exported",
  client_accepted: "Mark Client Accepted",
  filed: "Mark as Filed",
  draft: "Reopen as Draft",
};

// Only filed → draft requires a reason (per backend transition rules)
function requiresReason(fromStatus: WorkspaceStatusV1, toStatus: WorkspaceStatusV1): boolean {
  return fromStatus === "filed" && toStatus === "draft";
}

export function WorkspaceStatusTransitionV1({
  currentStatus,
  tenantId,
  workspaceId,
  onTransitionSuccess,
}: WorkspaceStatusTransitionV1Props) {
  const [pendingTarget, setPendingTarget] = useState<WorkspaceStatusV1 | null>(
    null
  );
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      toStatus,
      reasonText,
    }: {
      toStatus: WorkspaceStatusV1;
      reasonText?: string;
    }) => {
      return applyWorkspaceTransitionV1({
        tenantId,
        workspaceId,
        toStatus,
        reason: reasonText,
      });
    },
    onSuccess: (_, variables) => {
      onTransitionSuccess(variables.toStatus);
      setPendingTarget(null);
      setReason("");
      setError(null);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to update workspace status";
      setError(message);
    },
  });

  const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];

  const handleTransitionClick = (toStatus: WorkspaceStatusV1) => {
    setError(null);

    if (requiresReason(currentStatus, toStatus)) {
      setPendingTarget(toStatus);
    } else {
      mutation.mutate({ toStatus });
    }
  };

  const handleConfirmReason = () => {
    if (!pendingTarget) return;

    if (reason.trim() === "") {
      setError("Please provide a reason");
      return;
    }

    mutation.mutate({ toStatus: pendingTarget, reasonText: reason });
  };

  const handleCancelReason = () => {
    setPendingTarget(null);
    setReason("");
    setError(null);
  };

  const isLoading = mutation.isPending;

  return (
    <div className="workspace-status-transition">
      <div className="status-transition__label">CHANGE STATUS</div>

      {error && <div className="status-transition__error">{error}</div>}

      {pendingTarget === null ? (
        <div className="status-transition__actions">
          {allowedNextStatuses.map((toStatus) => {
            const isSecondary = toStatus === "draft";
            const label = TRANSITION_LABELS[toStatus];

            return (
              <button
                key={toStatus}
                className={`status-transition__btn ${
                  isSecondary ? "status-transition__btn--secondary" : ""
                }`}
                onClick={() => handleTransitionClick(toStatus)}
                disabled={isLoading}
              >
                {isLoading ? "Updating…" : label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="status-transition__reason-form">
          <textarea
            className="status-transition__reason-input"
            placeholder="Please provide a reason for this change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
          />
          <div className="status-transition__reason-actions">
            <button
              className="status-transition__reason-confirm"
              onClick={handleConfirmReason}
              disabled={isLoading}
            >
              {isLoading ? "Confirming…" : "Confirm"}
            </button>
            <button
              className="status-transition__reason-cancel"
              onClick={handleCancelReason}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
