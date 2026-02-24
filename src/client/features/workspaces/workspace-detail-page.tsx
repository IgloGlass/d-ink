import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useRequiredSessionPrincipalV1 } from "../../app/router";
import { StatusPill } from "../../components/status-pill";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import {
  type WorkspaceStatusV1,
  applyWorkspaceTransitionV1,
  getWorkspaceByIdV1,
} from "../../lib/http/workspace-api";

const allStatusesV1: WorkspaceStatusV1[] = [
  "draft",
  "in_review",
  "changes_requested",
  "ready_for_approval",
  "approved_for_export",
  "exported",
  "client_accepted",
  "filed",
];

const workspaceDetailQueryKeyV1 = (tenantId: string, workspaceId: string) => [
  "workspace",
  tenantId,
  workspaceId,
];

const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams();
  const principal = useRequiredSessionPrincipalV1();
  const queryClient = useQueryClient();

  const [toStatus, setToStatus] = useState<WorkspaceStatusV1>("in_review");
  const [reason, setReason] = useState("");

  if (!workspaceId) {
    return (
      <section className="card">
        <h1>Workspace detail</h1>
        <p className="error-text">Workspace ID is missing.</p>
      </section>
    );
  }

  const workspaceQuery = useQuery({
    queryKey: workspaceDetailQueryKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getWorkspaceByIdV1({
        tenantId: principal.tenantId,
        workspaceId,
      }),
  });

  useEffect(() => {
    if (workspaceQuery.data?.workspace.status) {
      setToStatus(workspaceQuery.data.workspace.status);
    }
  }, [workspaceQuery.data?.workspace.status]);

  const transitionMutation = useMutation({
    mutationFn: () =>
      applyWorkspaceTransitionV1({
        tenantId: principal.tenantId,
        workspaceId,
        toStatus,
        reason: reason.trim().length === 0 ? undefined : reason.trim(),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceDetailQueryKeyV1(principal.tenantId, workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceListQueryKeyV1(principal.tenantId),
        }),
      ]);
      setReason("");
    },
  });

  const currentStatus = workspaceQuery.data?.workspace.status;
  const requiresReason = currentStatus === "filed" && toStatus === "draft";

  return (
    <section className="panel-stack">
      <div className="card">
        <p>
          <Link to="/app/workspaces">Back to workspace list</Link>
        </p>
        <h1>Workspace detail</h1>

        {workspaceQuery.isPending ? <p>Loading workspace...</p> : null}
        {workspaceQuery.isError ? (
          <p className="error-text" role="alert">
            {toUserFacingErrorMessage(workspaceQuery.error)}
          </p>
        ) : null}

        {workspaceQuery.isSuccess ? (
          <dl className="workspace-meta-grid">
            <div>
              <dt>ID</dt>
              <dd>{workspaceQuery.data.workspace.id}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{workspaceQuery.data.workspace.companyId}</dd>
            </div>
            <div>
              <dt>Fiscal year</dt>
              <dd>
                {workspaceQuery.data.workspace.fiscalYearStart} to{" "}
                {workspaceQuery.data.workspace.fiscalYearEnd}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusPill status={workspaceQuery.data.workspace.status} />
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      {workspaceQuery.isSuccess ? (
        <div className="card">
          <h2>Apply status transition</h2>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              transitionMutation.mutate();
            }}
          >
            <label>
              Target status
              <select
                value={toStatus}
                onChange={(event) =>
                  setToStatus(event.target.value as WorkspaceStatusV1)
                }
              >
                {allStatusesV1.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  requiresReason
                    ? "Required for filed to draft"
                    : "Optional transition reason"
                }
                rows={3}
              />
            </label>

            <button
              type="submit"
              className="primary"
              disabled={
                transitionMutation.isPending ||
                (requiresReason && reason.trim().length === 0)
              }
            >
              {transitionMutation.isPending
                ? "Applying..."
                : "Apply transition"}
            </button>
          </form>

          {requiresReason ? (
            <p className="hint-text">
              Reopening from filed to draft requires a reason.
            </p>
          ) : null}

          {transitionMutation.isError ? (
            <p className="error-text" role="alert">
              {toUserFacingErrorMessage(transitionMutation.error)}
            </p>
          ) : null}

          {transitionMutation.isSuccess ? (
            <p className="success-text">
              Workspace status updated successfully.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
