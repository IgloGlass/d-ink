import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link } from "react-router-dom";

import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { InputV1 } from "../../components/input-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
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
  const companyIdInputId = useId();
  const fiscalYearStartInputId = useId();
  const fiscalYearEndInputId = useId();

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
      <CardV1>
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
          <label htmlFor={companyIdInputId}>Company ID (UUID)</label>
          <div className="inline-row">
            <InputV1
              id={companyIdInputId}
              type="text"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              required
              placeholder="xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx"
            />
            <ButtonV1
              type="button"
              onClick={() => {
                if (typeof crypto !== "undefined" && crypto.randomUUID) {
                  setCompanyId(crypto.randomUUID());
                }
              }}
            >
              Generate
            </ButtonV1>
          </div>

          <label htmlFor={fiscalYearStartInputId}>Fiscal year start</label>
          <InputV1
            id={fiscalYearStartInputId}
            type="date"
            value={fiscalYearStart}
            onChange={(event) => setFiscalYearStart(event.target.value)}
            required
          />

          <label htmlFor={fiscalYearEndInputId}>Fiscal year end</label>
          <InputV1
            id={fiscalYearEndInputId}
            type="date"
            value={fiscalYearEnd}
            onChange={(event) => setFiscalYearEnd(event.target.value)}
            required
          />

          <ButtonV1
            type="submit"
            variant="primary"
            disabled={createMutation.isPending || companyId.trim().length === 0}
          >
            {createMutation.isPending ? "Creating..." : "Create workspace"}
          </ButtonV1>
        </form>
      </CardV1>

      {createMutation.isError ? (
        <p className="error-text" role="alert">
          {toUserFacingErrorMessage(createMutation.error)}
        </p>
      ) : null}

      <CardV1>
        <h2>Tenant workspace list</h2>

        {listQuery.isPending ? (
          <div className="panel-stack">
            <SkeletonV1 height={40} />
            <SkeletonV1 height={40} />
            <SkeletonV1 height={40} />
          </div>
        ) : null}
        {listQuery.isError ? (
          <EmptyStateV1
            title="Workspace list unavailable"
            description={toUserFacingErrorMessage(listQuery.error)}
            tone="error"
            role="alert"
            action={
              <ButtonV1 onClick={() => listQuery.refetch()}>Retry</ButtonV1>
            }
          />
        ) : null}

        {listQuery.isSuccess ? (
          listQuery.data.workspaces.length === 0 ? (
            <EmptyStateV1
              title="No workspaces yet"
              description="Create your first workspace to start the tax workflow."
            />
          ) : (
            <div className="table-wrap">
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
            </div>
          )
        ) : null}
      </CardV1>
    </section>
  );
}
