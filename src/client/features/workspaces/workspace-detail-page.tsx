import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { StatusPill } from "../../components/status-pill";
import { ApiClientError, toUserFacingErrorMessage } from "../../lib/http/api-client";
import {
  type GenerateMappingReviewSuggestionsResponseV1,
  type WorkspaceStatusV1,
  applyMappingOverridesV1,
  applyWorkspaceTransitionV1,
  generateMappingReviewSuggestionsV1,
  getActiveMappingDecisionsV1,
  getWorkspaceByIdV1,
  runTrialBalancePipelineV1,
} from "../../lib/http/workspace-api";
import {
  listSilverfinTaxCategoriesV1,
  type SilverfinTaxCategoryCodeV1,
} from "../../../shared/contracts/mapping.v1";
import type { TrialBalanceFileTypeV1 } from "../../../shared/contracts/trial-balance.v1";

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

const categoriesV1 = listSilverfinTaxCategoriesV1();

const workspaceDetailKeyV1 = (tenantId: string, workspaceId: string) => [
  "workspace",
  tenantId,
  workspaceId,
];
const workspaceListKeyV1 = (tenantId: string) => ["workspaces", tenantId];
const activeMappingKeyV1 = (tenantId: string, workspaceId: string) => [
  "active-mapping",
  tenantId,
  workspaceId,
];

type OverrideDraftV1 = {
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
  scope: "return" | "user";
  reason: string;
};

function inferFileTypeV1(name: string): TrialBalanceFileTypeV1 | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xlsm")) return "xlsm";
  if (lower.endsWith(".xlsb")) return "xlsb";
  if (lower.endsWith(".xls")) return "xls";
  if (lower.endsWith(".csv")) return "csv";
  return undefined;
}

async function fileToBase64V1(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams();
  const principal = useRequiredSessionPrincipalV1();
  const queryClient = useQueryClient();

  const [toStatus, setToStatus] = useState<WorkspaceStatusV1>("in_review");
  const [statusReason, setStatusReason] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [policyVersion, setPolicyVersion] = useState("deterministic-bas.v1");
  const [drafts, setDrafts] = useState<Record<string, OverrideDraftV1>>({});
  const [reviewScope, setReviewScope] = useState<"return" | "user">("return");
  const [reviewMax, setReviewMax] = useState(30);
  const [reviewResult, setReviewResult] =
    useState<GenerateMappingReviewSuggestionsResponseV1 | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);

  if (!workspaceId) {
    return <section className="card">Workspace ID missing.</section>;
  }

  const workspaceQuery = useQuery({
    queryKey: workspaceDetailKeyV1(principal.tenantId, workspaceId),
    queryFn: () => getWorkspaceByIdV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const mappingQuery = useQuery({
    queryKey: activeMappingKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getActiveMappingDecisionsV1({ tenantId: principal.tenantId, workspaceId }),
  });

  useEffect(() => {
    if (workspaceQuery.data?.workspace.status) {
      setToStatus(workspaceQuery.data.workspace.status);
    }
  }, [workspaceQuery.data?.workspace.status]);

  useEffect(() => {
    const decisions = mappingQuery.data?.mapping.decisions;
    if (!decisions) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const d of decisions) {
        if (!next[d.id]) {
          next[d.id] = {
            selectedCategoryCode: d.selectedCategory.code,
            scope: "return",
            reason: "",
          };
        }
      }
      return next;
    });
  }, [mappingQuery.data?.active.artifactId, mappingQuery.data?.active.version]);

  const statusMutation = useMutation({
    mutationFn: () =>
      applyWorkspaceTransitionV1({
        tenantId: principal.tenantId,
        workspaceId,
        toStatus,
        reason: statusReason.trim() ? statusReason.trim() : undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceDetailKeyV1(principal.tenantId, workspaceId),
        }),
        queryClient.invalidateQueries({ queryKey: workspaceListKeyV1(principal.tenantId) }),
      ]);
      setStatusReason("");
    },
  });

  const runPipelineMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("Select a trial balance file first.");
      return runTrialBalancePipelineV1({
        tenantId: principal.tenantId,
        workspaceId,
        fileName: uploadFile.name,
        fileType: inferFileTypeV1(uploadFile.name),
        fileBytesBase64: await fileToBase64V1(uploadFile),
        policyVersion,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeMappingKeyV1(principal.tenantId, workspaceId),
      });
      setReviewResult(null);
      setSelectedSuggestionIds([]);
    },
  });

  const applyOverrideMutation = useMutation({
    mutationFn: async (decisionId: string) => {
      const active = mappingQuery.data?.active;
      const draft = drafts[decisionId];
      if (!active || !draft) throw new Error("Active mapping not loaded.");
      if (!draft.reason.trim()) throw new Error("Override reason is required.");
      return applyMappingOverridesV1({
        tenantId: principal.tenantId,
        workspaceId,
        expectedActiveMapping: {
          artifactId: active.artifactId,
          version: active.version,
        },
        overrides: [
          {
            decisionId,
            selectedCategoryCode: draft.selectedCategoryCode,
            scope: draft.scope,
            reason: draft.reason.trim(),
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeMappingKeyV1(principal.tenantId, workspaceId),
      });
      setReviewResult(null);
      setSelectedSuggestionIds([]);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      generateMappingReviewSuggestionsV1({
        tenantId: principal.tenantId,
        workspaceId,
        scope: reviewScope,
        maxSuggestions: reviewMax,
      }),
    onSuccess: (result) => {
      setReviewResult(result);
      setSelectedSuggestionIds(result.suggestions.suggestions.map((s) => s.decisionId));
    },
  });

  const applySuggestionsMutation = useMutation({
    mutationFn: async () => {
      const active = mappingQuery.data?.active;
      if (!active || !reviewResult) throw new Error("Generate suggestions first.");
      const selected = reviewResult.suggestions.suggestions.filter((s) =>
        selectedSuggestionIds.includes(s.decisionId),
      );
      if (selected.length === 0) throw new Error("Select at least one suggestion.");
      return applyMappingOverridesV1({
        tenantId: principal.tenantId,
        workspaceId,
        expectedActiveMapping: {
          artifactId: active.artifactId,
          version: active.version,
        },
        overrides: selected.map((s) => ({
          decisionId: s.decisionId,
          selectedCategoryCode: s.selectedCategoryCode,
          scope: s.scope,
          reason: s.reason,
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeMappingKeyV1(principal.tenantId, workspaceId),
      });
      setReviewResult(null);
      setSelectedSuggestionIds([]);
    },
  });

  const mappingNotFound =
    mappingQuery.isError &&
    mappingQuery.error instanceof ApiClientError &&
    mappingQuery.error.code === "MAPPING_NOT_FOUND";

  const decisionById = useMemo(() => {
    const decisions = mappingQuery.data?.mapping.decisions ?? [];
    return new Map(decisions.map((d) => [d.id, d]));
  }, [mappingQuery.data?.mapping.decisions]);
  const requiresReason =
    workspaceQuery.data?.workspace.status === "filed" && toStatus === "draft";

  return (
    <section className="workspace-page-layout">
      <article className="card card--hero">
        <p className="eyebrow">Tax workspace</p>
        <h1>Mapping cockpit</h1>
        <p className="hint-text">
          Upload trial balance files, run deterministic mapping, apply overrides, and
          test advisory review suggestions.
        </p>
        <p>
          <Link to="/app/workspaces">Back to workspace list</Link>
        </p>
      </article>

      <div className="dashboard-grid">
        <article className="card card--section">
          <h2>Workspace snapshot</h2>
          {workspaceQuery.isPending ? <p>Loading workspace...</p> : null}
          {workspaceQuery.isError ? (
            <p className="error-text">{toUserFacingErrorMessage(workspaceQuery.error)}</p>
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
        </article>

        <article className="card card--section">
          <h2>Run trial balance pipeline</h2>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              runPipelineMutation.mutate();
            }}
          >
            <label>
              Trial balance file
              <input
                type="file"
                accept=".xlsx,.xlsm,.xls,.xlsb,.csv"
                onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <label>
              Policy version
              <input
                type="text"
                value={policyVersion}
                onChange={(event) => setPolicyVersion(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="primary"
              disabled={runPipelineMutation.isPending || uploadFile === null}
            >
              {runPipelineMutation.isPending ? "Running..." : "Run pipeline"}
            </button>
          </form>
          {runPipelineMutation.isError ? (
            <p className="error-text">{toUserFacingErrorMessage(runPipelineMutation.error)}</p>
          ) : null}
          {runPipelineMutation.isSuccess ? (
            <p className="success-text">
              Mapping v{runPipelineMutation.data.pipeline.artifacts.mapping.version} is
              now active.
            </p>
          ) : null}
        </article>
      </div>

      <article className="card card--section">
        <div className="section-heading-row">
          <h2>Active mapping decisions</h2>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: activeMappingKeyV1(principal.tenantId, workspaceId),
              })
            }
          >
            Refresh
          </button>
        </div>
        {mappingQuery.isPending ? <p>Loading mapping...</p> : null}
        {mappingNotFound ? (
          <p className="hint-text">No mapping yet. Run the trial balance pipeline first.</p>
        ) : null}
        {mappingQuery.isError && !mappingNotFound ? (
          <p className="error-text">{toUserFacingErrorMessage(mappingQuery.error)}</p>
        ) : null}
        {mappingQuery.isSuccess ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Current mapping</th>
                  <th>Override scope</th>
                  <th>Target category</th>
                  <th>Reason</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {mappingQuery.data.mapping.decisions.map((decision) => {
                  const draft = drafts[decision.id];
                  const allowedCategories = categoriesV1.filter(
                    (category) =>
                      category.statementType === decision.proposedCategory.statementType,
                  );

                  return (
                    <tr key={decision.id}>
                      <td>
                        <div className="cell-title">{decision.sourceAccountNumber}</div>
                        <div className="cell-subtle">{decision.accountName}</div>
                        <div className="cell-subtle">
                          {Math.round(decision.confidence * 100)}% · {decision.status}
                        </div>
                      </td>
                      <td>
                        <div className="cell-title">{decision.selectedCategory.code}</div>
                        <div className="cell-subtle">{decision.selectedCategory.name}</div>
                      </td>
                      <td>
                        <select
                          value={draft?.scope ?? "return"}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [decision.id]: {
                                ...(current[decision.id] ?? {
                                  selectedCategoryCode: decision.selectedCategory.code,
                                  reason: "",
                                  scope: "return",
                                }),
                                scope: event.target.value as "return" | "user",
                              },
                            }))
                          }
                        >
                          <option value="return">Return</option>
                          <option value="user">User</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={draft?.selectedCategoryCode ?? decision.selectedCategory.code}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [decision.id]: {
                                ...(current[decision.id] ?? {
                                  scope: "return",
                                  reason: "",
                                  selectedCategoryCode: decision.selectedCategory.code,
                                }),
                                selectedCategoryCode: event.target
                                  .value as SilverfinTaxCategoryCodeV1,
                              },
                            }))
                          }
                        >
                          {allowedCategories.map((category) => (
                            <option key={category.code} value={category.code}>
                              {category.code} - {category.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={draft?.reason ?? ""}
                          placeholder="Why override?"
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [decision.id]: {
                                ...(current[decision.id] ?? {
                                  scope: "return",
                                  selectedCategoryCode: decision.selectedCategory.code,
                                  reason: "",
                                }),
                                reason: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={applyOverrideMutation.isPending}
                          onClick={() => applyOverrideMutation.mutate(decision.id)}
                        >
                          Apply
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {applyOverrideMutation.isError ? (
          <p className="error-text">{toUserFacingErrorMessage(applyOverrideMutation.error)}</p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>Advisory mapping review</h2>
        <form
          className="form-grid form-grid--inline"
          onSubmit={(event) => {
            event.preventDefault();
            reviewMutation.mutate();
          }}
        >
          <label>
            Scope
            <select
              value={reviewScope}
              onChange={(event) => setReviewScope(event.target.value as "return" | "user")}
            >
              <option value="return">Return</option>
              <option value="user">User</option>
            </select>
          </label>
          <label>
            Max suggestions
            <input
              type="number"
              min={1}
              max={500}
              value={reviewMax}
              onChange={(event) => setReviewMax(Number(event.target.value) || 30)}
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={reviewMutation.isPending || !mappingQuery.isSuccess}
          >
            {reviewMutation.isPending ? "Generating..." : "Generate suggestions"}
          </button>
        </form>
        {reviewMutation.isError ? (
          <p className="error-text">{toUserFacingErrorMessage(reviewMutation.error)}</p>
        ) : null}
        {reviewResult ? (
          <>
            <p className="hint-text">
              {reviewResult.suggestions.summary.suggestedOverrides} suggestions generated.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Decision</th>
                    <th>Suggested code</th>
                    <th>Confidence</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewResult.suggestions.suggestions.map((suggestion) => {
                    const decision = decisionById.get(suggestion.decisionId);
                    const isChecked = selectedSuggestionIds.includes(suggestion.decisionId);
                    return (
                      <tr key={suggestion.decisionId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => {
                              setSelectedSuggestionIds((current) =>
                                event.target.checked
                                  ? [...current, suggestion.decisionId]
                                  : current.filter((id) => id !== suggestion.decisionId),
                              );
                            }}
                          />
                        </td>
                        <td>{decision?.sourceAccountNumber ?? suggestion.decisionId}</td>
                        <td>{suggestion.selectedCategoryCode}</td>
                        <td>{Math.round(suggestion.confidence * 100)}%</td>
                        <td>{suggestion.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="primary"
              disabled={
                applySuggestionsMutation.isPending || selectedSuggestionIds.length === 0
              }
              onClick={() => applySuggestionsMutation.mutate()}
            >
              {applySuggestionsMutation.isPending
                ? "Applying suggestions..."
                : "Apply selected suggestions"}
            </button>
          </>
        ) : (
          <p className="hint-text">Generate suggestions to review advisory overrides.</p>
        )}
        {applySuggestionsMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(applySuggestionsMutation.error)}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>Workspace status transition</h2>
        <form
          className="form-grid form-grid--inline"
          onSubmit={(event) => {
            event.preventDefault();
            statusMutation.mutate();
          }}
        >
          <label>
            Target status
            <select
              value={toStatus}
              onChange={(event) => setToStatus(event.target.value as WorkspaceStatusV1)}
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
              rows={2}
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Optional reason"
            />
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={statusMutation.isPending || (requiresReason && !statusReason.trim())}
          >
            {statusMutation.isPending ? "Applying..." : "Apply transition"}
          </button>
        </form>
        {requiresReason ? (
          <p className="hint-text">Reopening from filed to draft requires a reason.</p>
        ) : null}
        {statusMutation.isError ? (
          <p className="error-text">{toUserFacingErrorMessage(statusMutation.error)}</p>
        ) : null}
        {statusMutation.isSuccess ? (
          <p className="success-text">Workspace status updated successfully.</p>
        ) : null}
      </article>
    </section>
  );
}
