import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { StatusPill } from "../../components/status-pill";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import {
  createWorkspaceV1,
  listWorkspacesByTenantV1,
} from "../../lib/http/workspace-api";

const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];

export function WorkspaceListPage() {
  const principal = useRequiredSessionPrincipalV1();
  const queryClient = useQueryClient();

  const [companyId, setCompanyId] = useState("");
  const [fiscalYearStart, setFiscalYearStart] = useState("2025-01-01");
  const [fiscalYearEnd, setFiscalYearEnd] = useState("2025-12-31");

  const listQuery = useQuery({
    queryKey: workspaceListQueryKeyV1(principal.tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId: principal.tenantId }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkspaceV1({
        tenantId: principal.tenantId,
        companyId,
        fiscalYearStart,
        fiscalYearEnd,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceListQueryKeyV1(principal.tenantId),
      });
    },
  });

  return (
    <section className="panel-stack">
      <div className="card">
        <h1>Workspaces</h1>
        <p>Create and manage tenant workspaces.</p>
        <p>
          <a href="/templates/trial-balance-template-v1.xlsx" download>
            Download trial balance template (.xlsx)
          </a>
        </p>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <label>
            Company ID (UUID)
            <div className="inline-row">
              <input
                type="text"
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                required
                placeholder="xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx"
              />
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (typeof crypto !== "undefined" && crypto.randomUUID) {
                    setCompanyId(crypto.randomUUID());
                  }
                }}
              >
                Generate
              </button>
            </div>
          </label>

          <label>
            Fiscal year start
            <input
              type="date"
              value={fiscalYearStart}
              onChange={(event) => setFiscalYearStart(event.target.value)}
              required
            />
          </label>

          <label>
            Fiscal year end
            <input
              type="date"
              value={fiscalYearEnd}
              onChange={(event) => setFiscalYearEnd(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="primary"
            disabled={createMutation.isPending || companyId.trim().length === 0}
          >
            {createMutation.isPending ? "Creating..." : "Create workspace"}
          </button>
        </form>
      </div>

      {createMutation.isError ? (
        <p className="error-text" role="alert">
          {toUserFacingErrorMessage(createMutation.error)}
        </p>
      ) : null}

      <div className="card">
        <h2>Tenant workspace list</h2>

        {listQuery.isPending ? <p>Loading workspaces...</p> : null}
        {listQuery.isError ? (
          <p className="error-text" role="alert">
            {toUserFacingErrorMessage(listQuery.error)}
          </p>
        ) : null}

        {listQuery.isSuccess ? (
          listQuery.data.workspaces.length === 0 ? (
            <p>No workspaces yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Company</th>
                  <th>Fiscal year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.workspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>
                      <Link to={`/app/workspaces/${workspace.id}`}>
                        {workspace.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{workspace.companyId.slice(0, 8)}</td>
                    <td>
                      {workspace.fiscalYearStart} to {workspace.fiscalYearEnd}
                    </td>
                    <td>
                      <StatusPill status={workspace.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>
    </section>
  );
}
