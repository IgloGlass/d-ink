import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { AnnualReportProcessingRunV1 } from "../../../shared/contracts/annual-report-processing-run.v1";
import {
  type SilverfinTaxCategoryCodeV1,
  listSilverfinTaxCategoriesV1,
} from "../../../shared/contracts/mapping.v1";
import type { TrialBalanceFileTypeV1 } from "../../../shared/contracts/trial-balance.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ConfirmModalV1 } from "../../components/confirm-modal-v1";
import { StatusPill } from "../../components/status-pill";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import { updateCompanyV1 } from "../../lib/http/company-api";
import {
  type ApplyAnnualReportOverridesResponseV1,
  type ApplyInk2OverridesResponseV1,
  type ApplyTaxAdjustmentsOverridesResponseV1,
  type CreateCommentResponseV1,
  type CreatePdfExportResponseV1,
  type CreateTaskResponseV1,
  type GenerateMappingReviewSuggestionsResponseV1,
  type GetActiveAnnualReportExtractionResponseV1,
  type GetActiveInk2FormResponseV1,
  type GetActiveTaxAdjustmentsResponseV1,
  type GetActiveTaxSummaryResponseV1,
  type GetLatestAnnualReportProcessingRunResponseV1,
  type ListCommentsResponseV1,
  type ListTasksResponseV1,
  type ListWorkspaceExportsResponseV1,
  type RunInk2FormResponseV1,
  type RunTaxAdjustmentsResponseV1,
  type RunTaxSummaryResponseV1,
  type WorkspaceStatusV1,
  applyAnnualReportOverridesV1,
  applyInk2OverridesV1,
  applyMappingOverridesV1,
  applyTaxAdjustmentsOverridesV1,
  applyWorkspaceTransitionV1,
  completeTaskV1,
  createCommentV1,
  createPdfExportV1,
  createTaskV1,
  generateMappingReviewSuggestionsV1,
  getActiveAnnualReportExtractionV1,
  getActiveInk2FormV1,
  getActiveMappingDecisionsV1,
  getActiveTaxAdjustmentsV1,
  getActiveTaxSummaryV1,
  getLatestAnnualReportProcessingRunV1,
  getWorkspaceByIdV1,
  listCommentsV1,
  listTasksV1,
  listWorkspaceExportsV1,
  runInk2FormV1,
  runTaxAdjustmentsV1,
  runTaxSummaryV1,
  runTrialBalancePipelineV1,
} from "../../lib/http/workspace-api";
import {
  isAnnualReportProcessingOpenStatusV1,
  useAnnualReportUploadControllerV1,
} from "../annual-report/use-annual-report-upload-controller.v1";

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
const activeAnnualReportKeyV1 = (tenantId: string, workspaceId: string) => [
  "active-annual-report",
  tenantId,
  workspaceId,
];
const activeTaxAdjustmentsKeyV1 = (tenantId: string, workspaceId: string) => [
  "active-tax-adjustments",
  tenantId,
  workspaceId,
];
const activeTaxSummaryKeyV1 = (tenantId: string, workspaceId: string) => [
  "active-tax-summary",
  tenantId,
  workspaceId,
];
const activeInk2FormKeyV1 = (tenantId: string, workspaceId: string) => [
  "active-ink2-form",
  tenantId,
  workspaceId,
];
const exportsKeyV1 = (tenantId: string, workspaceId: string) => [
  "workspace-exports",
  tenantId,
  workspaceId,
];
const commentsKeyV1 = (tenantId: string, workspaceId: string) => [
  "workspace-comments",
  tenantId,
  workspaceId,
];
const tasksKeyV1 = (tenantId: string, workspaceId: string) => [
  "workspace-tasks",
  tenantId,
  workspaceId,
];
const latestAnnualReportProcessingRunKeyV1 = (
  tenantId: string,
  workspaceId: string,
) => ["latest-annual-report-processing-run", tenantId, workspaceId];

type OverrideDraftV1 = {
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
  scope: "return" | "user";
  reason: string;
};

type AnnualReportFieldKeyV1 =
  | "companyName"
  | "organizationNumber"
  | "fiscalYearStart"
  | "fiscalYearEnd"
  | "accountingStandard"
  | "profitBeforeTax";

type AnnualOverrideDraftV1 = {
  reason: string;
  value: string;
};

const annualReportFieldConfigsV1: Array<{
  key: AnnualReportFieldKeyV1;
  label: string;
  type: "number" | "select" | "text";
}> = [
  { key: "companyName", label: "Company name", type: "text" },
  { key: "organizationNumber", label: "Organization number", type: "text" },
  { key: "fiscalYearStart", label: "Fiscal year start", type: "text" },
  { key: "fiscalYearEnd", label: "Fiscal year end", type: "text" },
  { key: "accountingStandard", label: "Accounting standard", type: "select" },
  { key: "profitBeforeTax", label: "Profit before tax", type: "number" },
];

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

function formatBalanceValueV1(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("sv-SE");
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams();
  const principal = useRequiredSessionPrincipalV1();
  const queryClient = useQueryClient();

  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const requestConfirm = (
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
  ) => {
    setConfirmModal({ message, confirmLabel, onConfirm });
  };

  const [toStatus, setToStatus] = useState<WorkspaceStatusV1>("in_review");
  const [statusReason, setStatusReason] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [policyVersion, setPolicyVersion] = useState("mapping-ai.v1");
  const [annualPolicyVersion, setAnnualPolicyVersion] = useState(
    "annual-report-manual-first.v1",
  );
  const [annualOverrideDrafts, setAnnualOverrideDrafts] = useState<
    Record<AnnualReportFieldKeyV1, AnnualOverrideDraftV1>
  >({
    companyName: { value: "", reason: "" },
    organizationNumber: { value: "", reason: "" },
    fiscalYearStart: { value: "", reason: "" },
    fiscalYearEnd: { value: "", reason: "" },
    accountingStandard: { value: "", reason: "" },
    profitBeforeTax: { value: "", reason: "" },
  });
  const [drafts, setDrafts] = useState<Record<string, OverrideDraftV1>>({});
  const [reviewScope, setReviewScope] = useState<"return" | "user">("return");
  const [reviewMax, setReviewMax] = useState(30);
  const [reviewResult, setReviewResult] =
    useState<GenerateMappingReviewSuggestionsResponseV1 | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>(
    [],
  );
  const [taxAdjustmentsPolicyVersion, setTaxAdjustmentsPolicyVersion] =
    useState("tax-adjustments.v1");
  const [adjustmentOverrideAmount, setAdjustmentOverrideAmount] = useState("");
  const [adjustmentOverrideReason, setAdjustmentOverrideReason] = useState("");
  const [ink2OverrideAmount, setInk2OverrideAmount] = useState("");
  const [ink2OverrideReason, setInk2OverrideReason] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");

  if (!workspaceId) {
    return <section className="card">Workspace ID missing.</section>;
  }

  const workspaceQuery = useQuery({
    queryKey: workspaceDetailKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getWorkspaceByIdV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const mappingQuery = useQuery({
    queryKey: activeMappingKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getActiveMappingDecisionsV1({
        tenantId: principal.tenantId,
        workspaceId,
      }),
  });
  const annualReportQuery = useQuery({
    queryKey: activeAnnualReportKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getActiveAnnualReportExtractionV1({
        tenantId: principal.tenantId,
        workspaceId,
      }),
  });
  const annualReportProcessingRunQuery = useQuery({
    queryKey: latestAnnualReportProcessingRunKeyV1(
      principal.tenantId,
      workspaceId,
    ),
    queryFn:
      async (): Promise<GetLatestAnnualReportProcessingRunResponseV1 | null> => {
        try {
          return await getLatestAnnualReportProcessingRunV1({
            tenantId: principal.tenantId,
            workspaceId,
          });
        } catch (error) {
          if (
            error instanceof ApiClientError &&
            error.code === "PROCESSING_RUN_NOT_FOUND"
          ) {
            return null;
          }

          throw error;
        }
      },
    retry: false,
    refetchInterval: ({ state }) => {
      const data = state.data as
        | GetLatestAnnualReportProcessingRunResponseV1
        | null
        | undefined;
      return isAnnualReportProcessingOpenStatusV1(data?.run?.status)
        ? 2_000
        : false;
    },
  });
  const taxAdjustmentsQuery = useQuery({
    queryKey: activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getActiveTaxAdjustmentsV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const taxSummaryQuery = useQuery({
    queryKey: activeTaxSummaryKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getActiveTaxSummaryV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const ink2FormQuery = useQuery({
    queryKey: activeInk2FormKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      getActiveInk2FormV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const exportsQuery = useQuery({
    queryKey: exportsKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      listWorkspaceExportsV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const commentsQuery = useQuery({
    queryKey: commentsKeyV1(principal.tenantId, workspaceId),
    queryFn: () =>
      listCommentsV1({ tenantId: principal.tenantId, workspaceId }),
  });
  const tasksQuery = useQuery({
    queryKey: tasksKeyV1(principal.tenantId, workspaceId),
    queryFn: () => listTasksV1({ tenantId: principal.tenantId, workspaceId }),
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
  }, [mappingQuery.data?.mapping.decisions]);

  useEffect(() => {
    const extraction = annualReportQuery.data?.extraction;
    if (!extraction) {
      return;
    }

    setAnnualOverrideDrafts({
      companyName: {
        value: extraction.fields.companyName.value ?? "",
        reason: "",
      },
      organizationNumber: {
        value: extraction.fields.organizationNumber.value ?? "",
        reason: "",
      },
      fiscalYearStart: {
        value: extraction.fields.fiscalYearStart.value ?? "",
        reason: "",
      },
      fiscalYearEnd: {
        value: extraction.fields.fiscalYearEnd.value ?? "",
        reason: "",
      },
      accountingStandard: {
        value: extraction.fields.accountingStandard.value ?? "",
        reason: "",
      },
      profitBeforeTax: {
        value:
          extraction.fields.profitBeforeTax.value !== undefined
            ? String(extraction.fields.profitBeforeTax.value)
            : "",
        reason: "",
      },
    });
  }, [annualReportQuery.data?.extraction]);

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
        queryClient.invalidateQueries({
          queryKey: workspaceListKeyV1(principal.tenantId),
        }),
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

  const applyAnnualOverrideMutation = useMutation({
    mutationFn: async (
      fieldKey: AnnualReportFieldKeyV1,
    ): Promise<ApplyAnnualReportOverridesResponseV1> => {
      const active = annualReportQuery.data?.active;
      if (!active) {
        throw new Error("Active annual report extraction not loaded.");
      }

      const draft = annualOverrideDrafts[fieldKey];
      if (!draft.reason.trim()) {
        throw new Error("Override reason is required.");
      }

      const value =
        fieldKey === "profitBeforeTax"
          ? Number(draft.value)
          : draft.value.trim();
      if (
        (fieldKey !== "profitBeforeTax" && String(value).length === 0) ||
        (fieldKey === "profitBeforeTax" && !Number.isFinite(value as number))
      ) {
        throw new Error("Provide a valid override value.");
      }

      const result = await applyAnnualReportOverridesV1({
        tenantId: principal.tenantId,
        workspaceId,
        expectedActiveExtraction: {
          artifactId: active.artifactId,
          version: active.version,
        },
        overrides: [
          {
            fieldKey,
            reason: draft.reason.trim(),
            value: value as string | number,
          },
        ],
      });

      if (
        fieldKey === "companyName" ||
        fieldKey === "organizationNumber"
      ) {
        const companyId = workspaceQuery.data?.workspace.companyId;
        if (!companyId) {
          throw new Error("Workspace company ID is not available.");
        }

        const legalName =
          result.extraction.fields.companyName.value?.trim() ?? "";
        const organizationNumber =
          result.extraction.fields.organizationNumber.value?.trim() ?? "";
        if (!legalName || !organizationNumber) {
          throw new Error(
            "Updated annual report extraction is missing company identity values.",
          );
        }

        await updateCompanyV1({
          tenantId: principal.tenantId,
          companyId,
          legalName,
          organizationNumber,
        });
      }

      return result;
    },
    onSuccess: async (_, fieldKey) => {
      setAnnualReportFile(null);
      queryClient.removeQueries({
        queryKey: activeAnnualReportKeyV1(principal.tenantId, workspaceId),
      });
      if (
        fieldKey === "companyName" ||
        fieldKey === "organizationNumber"
      ) {
        await queryClient.invalidateQueries({
          queryKey: ["companies", principal.tenantId],
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: activeAnnualReportKeyV1(principal.tenantId, workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: activeTaxSummaryKeyV1(principal.tenantId, workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: activeInk2FormKeyV1(principal.tenantId, workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: exportsKeyV1(principal.tenantId, workspaceId),
        }),
      ]);
    },
  });

  const runTaxAdjustmentsMutation = useMutation({
    mutationFn: async (): Promise<RunTaxAdjustmentsResponseV1> =>
      runTaxAdjustmentsV1({
        tenantId: principal.tenantId,
        workspaceId,
        policyVersion: taxAdjustmentsPolicyVersion,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
      });
    },
  });

  const applyTaxAdjustmentOverrideMutation = useMutation({
    mutationFn: async (): Promise<ApplyTaxAdjustmentsOverridesResponseV1> => {
      const active = taxAdjustmentsQuery.data?.active;
      const firstDecision = taxAdjustmentsQuery.data?.adjustments.decisions[0];
      if (!active || !firstDecision) {
        throw new Error("No active adjustment decision to override.");
      }
      const amount = Number(adjustmentOverrideAmount);
      if (!Number.isFinite(amount) || !adjustmentOverrideReason.trim()) {
        throw new Error("Provide a valid amount and reason.");
      }

      return applyTaxAdjustmentsOverridesV1({
        tenantId: principal.tenantId,
        workspaceId,
        expectedActiveAdjustments: {
          artifactId: active.artifactId,
          version: active.version,
        },
        overrides: [
          {
            decisionId: firstDecision.id,
            amount,
            reason: adjustmentOverrideReason.trim(),
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
      });
      setAdjustmentOverrideAmount("");
      setAdjustmentOverrideReason("");
    },
  });

  const runTaxSummaryMutation = useMutation({
    mutationFn: async (): Promise<RunTaxSummaryResponseV1> =>
      runTaxSummaryV1({
        tenantId: principal.tenantId,
        workspaceId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeTaxSummaryKeyV1(principal.tenantId, workspaceId),
      });
    },
  });

  const runInk2FormMutation = useMutation({
    mutationFn: async (): Promise<RunInk2FormResponseV1> =>
      runInk2FormV1({
        tenantId: principal.tenantId,
        workspaceId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeInk2FormKeyV1(principal.tenantId, workspaceId),
      });
    },
  });

  const applyInk2OverrideMutation = useMutation({
    mutationFn: async (): Promise<ApplyInk2OverridesResponseV1> => {
      const active = ink2FormQuery.data?.active;
      const firstField = ink2FormQuery.data?.form.fields[0];
      if (!active || !firstField) {
        throw new Error("No active INK2 field to override.");
      }
      const amount = Number(ink2OverrideAmount);
      if (!Number.isFinite(amount) || !ink2OverrideReason.trim()) {
        throw new Error("Provide a valid amount and reason.");
      }

      return applyInk2OverridesV1({
        tenantId: principal.tenantId,
        workspaceId,
        expectedActiveForm: {
          artifactId: active.artifactId,
          version: active.version,
        },
        overrides: [
          {
            fieldId: firstField.fieldId,
            amount,
            reason: ink2OverrideReason.trim(),
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activeInk2FormKeyV1(principal.tenantId, workspaceId),
      });
      setInk2OverrideAmount("");
      setInk2OverrideReason("");
    },
  });

  const createPdfExportMutation = useMutation({
    mutationFn: async (): Promise<CreatePdfExportResponseV1> =>
      createPdfExportV1({
        tenantId: principal.tenantId,
        workspaceId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: exportsKeyV1(principal.tenantId, workspaceId),
      });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (): Promise<CreateCommentResponseV1> => {
      if (!newCommentBody.trim()) {
        throw new Error("Comment body is required.");
      }
      return createCommentV1({
        tenantId: principal.tenantId,
        workspaceId,
        body: newCommentBody.trim(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: commentsKeyV1(principal.tenantId, workspaceId),
      });
      setNewCommentBody("");
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (): Promise<CreateTaskResponseV1> => {
      if (!newTaskTitle.trim()) {
        throw new Error("Task title is required.");
      }
      return createTaskV1({
        tenantId: principal.tenantId,
        workspaceId,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: tasksKeyV1(principal.tenantId, workspaceId),
      });
      setNewTaskTitle("");
      setNewTaskDescription("");
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) =>
      completeTaskV1({
        tenantId: principal.tenantId,
        workspaceId,
        taskId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: tasksKeyV1(principal.tenantId, workspaceId),
      });
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
      setSelectedSuggestionIds(
        result.suggestions.suggestions.map((s) => s.decisionId),
      );
    },
  });

  const applySuggestionsMutation = useMutation({
    mutationFn: async () => {
      const active = mappingQuery.data?.active;
      if (!active || !reviewResult)
        throw new Error("Generate suggestions first.");
      const selected = reviewResult.suggestions.suggestions.filter((s) =>
        selectedSuggestionIds.includes(s.decisionId),
      );
      if (selected.length === 0)
        throw new Error("Select at least one suggestion.");
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

  const latestAnnualReportRun = annualReportProcessingRunQuery.data?.run;
  const mappingNotFound =
    mappingQuery.isError &&
    mappingQuery.error instanceof ApiClientError &&
    mappingQuery.error.code === "MAPPING_NOT_FOUND";
  const annualExtractionNotFound =
    annualReportQuery.isError &&
    annualReportQuery.error instanceof ApiClientError &&
    annualReportQuery.error.code === "EXTRACTION_NOT_FOUND";
  const activeAnnualReportData = annualReportQuery.isSuccess
    ? annualReportQuery.data
    : undefined;
  const taxAdjustmentsNotFound =
    taxAdjustmentsQuery.isError &&
    taxAdjustmentsQuery.error instanceof ApiClientError &&
    taxAdjustmentsQuery.error.code === "ADJUSTMENTS_NOT_FOUND";
  const taxSummaryNotFound =
    taxSummaryQuery.isError &&
    taxSummaryQuery.error instanceof ApiClientError &&
    taxSummaryQuery.error.code === "ADJUSTMENTS_NOT_FOUND";
  const ink2FormNotFound =
    ink2FormQuery.isError &&
    ink2FormQuery.error instanceof ApiClientError &&
    ink2FormQuery.error.code === "FORM_NOT_FOUND";
  const annualExtractionConfirmed =
    activeAnnualReportData?.extraction.confirmation.isConfirmed ?? false;
  const {
    annualReportFile,
    annualReportFileTooLarge,
    annualReportMutation,
    annualReportMutationErrorCode,
    annualReportRunIsOpen,
    annualReportRunIsStale,
    annualReportUploadBlockedByRun,
    annualUploadProgressPercent: annualReportUploadProgressPercent,
    clearAnnualReportMutation,
    clearActiveData,
    recoveryActionLabel,
    runRecoveryAction,
    setAnnualReportFile,
    startUpload,
  } = useAnnualReportUploadControllerV1({
    tenantId: principal.tenantId,
    workspaceId,
    policyVersion: annualPolicyVersion,
    latestRun: latestAnnualReportRun,
    hasActiveExtraction: Boolean(activeAnnualReportData?.active),
    onConfirmRequired: requestConfirm,
    uploadPanelId: "annual-report-upload-panel",
    latestRunQueryKey: latestAnnualReportProcessingRunKeyV1(
      principal.tenantId,
      workspaceId,
    ),
    uploadSuccessInvalidateQueryKeys: [
      latestAnnualReportProcessingRunKeyV1(principal.tenantId, workspaceId),
      activeAnnualReportKeyV1(principal.tenantId, workspaceId),
      activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
      activeTaxSummaryKeyV1(principal.tenantId, workspaceId),
      activeInk2FormKeyV1(principal.tenantId, workspaceId),
      exportsKeyV1(principal.tenantId, workspaceId),
    ],
    clearSuccessRemoveQueryKeys: [
      latestAnnualReportProcessingRunKeyV1(principal.tenantId, workspaceId),
      activeAnnualReportKeyV1(principal.tenantId, workspaceId),
    ],
    clearSuccessInvalidateQueryKeys: [
      activeAnnualReportKeyV1(principal.tenantId, workspaceId),
      activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
      activeTaxSummaryKeyV1(principal.tenantId, workspaceId),
      activeInk2FormKeyV1(principal.tenantId, workspaceId),
      exportsKeyV1(principal.tenantId, workspaceId),
    ],
    settledRunInvalidateQueryKeys: [
      activeAnnualReportKeyV1(principal.tenantId, workspaceId),
      activeTaxAdjustmentsKeyV1(principal.tenantId, workspaceId),
      activeTaxSummaryKeyV1(principal.tenantId, workspaceId),
      activeInk2FormKeyV1(principal.tenantId, workspaceId),
      exportsKeyV1(principal.tenantId, workspaceId),
    ],
  });

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
          Upload trial balance files, run AI-first mapping, apply overrides, and
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
            <p className="error-text">
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
        </article>

        <article className="card card--section">
          <h2>Annual report extraction</h2>
          <form
            id="annual-report-upload-panel"
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              startUpload();
            }}
          >
            <label>
              Annual report file
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(event) =>
                  setAnnualReportFile(event.currentTarget.files?.[0] ?? null)
                }
              />
            </label>
            <label>
              Policy version
              <input
                type="text"
                value={annualPolicyVersion}
                onChange={(event) => setAnnualPolicyVersion(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="primary"
              disabled={
                annualReportMutation.isPending ||
                annualReportUploadBlockedByRun ||
                annualReportFile === null ||
                annualReportFileTooLarge
              }
            >
              {annualReportRunIsOpen && !annualReportRunIsStale
                ? "Processing..."
                : annualReportRunIsStale
                  ? "Upload replacement report"
                  : annualReportMutation.isPending
                    ? "Uploading..."
                    : annualReportQuery.isSuccess
                      ? "Upload a new annual report"
                      : "Upload annual report"}
            </button>
            {(latestAnnualReportRun?.status === "failed" ||
              (latestAnnualReportRun?.status === "partial" &&
                !activeAnnualReportData?.extraction)) && (
              <button
                type="button"
                className="secondary"
                disabled={
                  annualReportMutation.isPending ||
                  annualReportUploadBlockedByRun
                }
                onClick={runRecoveryAction}
              >
                {recoveryActionLabel}
              </button>
            )}
            {activeAnnualReportData ? (
              <button
                type="button"
                className="secondary"
                disabled={
                  clearAnnualReportMutation.isPending || annualReportRunIsOpen
                }
                onClick={clearActiveData}
              >
                {clearAnnualReportMutation.isPending
                  ? "Clearing..."
                  : "Clear annual report data"}
              </button>
            ) : null}
          </form>
          {annualReportMutation.isError ? (
            <p className="error-text">
              {toUserFacingErrorMessage(annualReportMutation.error)}
            </p>
          ) : null}
          {annualReportMutationErrorCode === "PROCESSING_RUN_UNAVAILABLE" ? (
            <p className="hint-text">
              Annual-report processing runtime is unavailable. Verify local
              queue and file bindings, then retry.
            </p>
          ) : null}
          {annualReportMutationErrorCode === "RUNTIME_MISMATCH" ? (
            <p className="hint-text">
              Runtime mismatch detected. Restart the local app and retry upload.
            </p>
          ) : null}
          {annualReportFileTooLarge ? (
            <p className="error-text">
              The annual report file is too large. Upload a file smaller than 25
              MB.
            </p>
          ) : null}
          {annualReportProcessingRunQuery.isError ? (
            <p className="error-text">
              {toUserFacingErrorMessage(annualReportProcessingRunQuery.error)}
            </p>
          ) : null}
          {annualReportMutation.isPending &&
          annualReportUploadProgressPercent !== null ? (
            <p className="hint-text">
              Uploading file ({annualReportUploadProgressPercent}%).
            </p>
          ) : null}
          {annualReportRunIsOpen && !annualReportRunIsStale ? (
            <p className="hint-text">
              {latestAnnualReportRun?.hasPreviousActiveResult
                ? "A new annual report is processing. The current extracted result stays visible until the replacement succeeds."
                : latestAnnualReportRun?.statusMessage}
            </p>
          ) : null}
          {annualReportRunIsStale ? (
            <p className="error-text">
              Annual-report processing appears stuck (no update for at least 5
              minutes). Upload a replacement report to continue.
            </p>
          ) : null}
          {!annualReportRunIsOpen &&
          latestAnnualReportRun?.status === "completed" ? (
            <p className="success-text">
              Annual report analysis completed. The latest extraction is active.
            </p>
          ) : null}
          {!annualReportRunIsOpen &&
          (latestAnnualReportRun?.status === "failed" ||
            latestAnnualReportRun?.status === "partial") ? (
            <p
              className={
                latestAnnualReportRun.status === "failed"
                  ? "error-text"
                  : "hint-text"
              }
            >
              {latestAnnualReportRun.error?.userMessage ??
                latestAnnualReportRun.statusMessage}
            </p>
          ) : null}
          {annualReportQuery.isPending ? (
            <p>Loading annual extraction...</p>
          ) : null}
          {annualExtractionNotFound ? (
            <p className="hint-text">
              No annual extraction yet. Upload a PDF or DOCX file to start.
            </p>
          ) : null}
          {annualReportQuery.isError && !annualExtractionNotFound ? (
            <p className="error-text">
              {toUserFacingErrorMessage(annualReportQuery.error)}
            </p>
          ) : null}
          {activeAnnualReportData ? (
            <>
              <p className="hint-text">
                Active extraction v{activeAnnualReportData.active.version} ·{" "}
                {activeAnnualReportData.extraction.confirmation.isConfirmed
                  ? "Extracted and ready for workflow"
                  : "Incomplete extraction"}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Current value</th>
                      <th>Status</th>
                      <th>Override value</th>
                      <th>Reason</th>
                      <th>Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualReportFieldConfigsV1.map((config) => {
                      const field =
                        activeAnnualReportData.extraction.fields[config.key];
                      const draft = annualOverrideDrafts[config.key];
                      return (
                        <tr key={config.key}>
                          <td>{config.label}</td>
                          <td>
                            {field.value !== undefined
                              ? String(field.value)
                              : "-"}
                          </td>
                          <td>{field.status}</td>
                          <td>
                            {config.type === "select" ? (
                              <select
                                aria-label={`${config.label} override value`}
                                value={draft?.value ?? ""}
                                onChange={(event) =>
                                  setAnnualOverrideDrafts((current) => ({
                                    ...current,
                                    [config.key]: {
                                      ...(current[config.key] ?? {
                                        reason: "",
                                        value: "",
                                      }),
                                      value: event.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">Select</option>
                                <option value="K2">K2</option>
                                <option value="K3">K3</option>
                              </select>
                            ) : (
                              <input
                                aria-label={`${config.label} override value`}
                                type={
                                  config.type === "number" ? "number" : "text"
                                }
                                value={draft?.value ?? ""}
                                onChange={(event) =>
                                  setAnnualOverrideDrafts((current) => ({
                                    ...current,
                                    [config.key]: {
                                      ...(current[config.key] ?? {
                                        reason: "",
                                        value: "",
                                      }),
                                      value: event.target.value,
                                    },
                                  }))
                                }
                              />
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`${config.label} override reason`}
                              type="text"
                              value={draft?.reason ?? ""}
                              onChange={(event) =>
                                setAnnualOverrideDrafts((current) => ({
                                  ...current,
                                  [config.key]: {
                                    ...(current[config.key] ?? {
                                      reason: "",
                                      value: "",
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
                              disabled={applyAnnualOverrideMutation.isPending}
                              onClick={() =>
                                applyAnnualOverrideMutation.mutate(config.key)
                              }
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
            </>
          ) : null}
          {applyAnnualOverrideMutation.isError ? (
            <p className="error-text">
              {toUserFacingErrorMessage(applyAnnualOverrideMutation.error)}
            </p>
          ) : null}
          {clearAnnualReportMutation.isError ? (
            <p className="error-text">
              {toUserFacingErrorMessage(clearAnnualReportMutation.error)}
            </p>
          ) : null}
          {clearAnnualReportMutation.isSuccess ? (
            <p className="success-text">Active annual-report data cleared.</p>
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
                onChange={(event) =>
                  setUploadFile(event.currentTarget.files?.[0] ?? null)
                }
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
            <p className="error-text">
              {toUserFacingErrorMessage(runPipelineMutation.error)}
            </p>
          ) : null}
          {runPipelineMutation.isSuccess ? (
            <p className="success-text">
              Mapping v
              {runPipelineMutation.data.pipeline.artifacts.mapping.version} is
              now active.
            </p>
          ) : null}
        </article>
      </div>

      {!annualExtractionConfirmed ? (
        <article className="card card--section">
          <h2>Tax-core gate</h2>
          <p className="hint-text">
            Upload a complete annual report before running tax-core steps
            (adjustments, tax summary, INK2 draft, and PDF export).
          </p>
        </article>
      ) : null}

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
          <p className="hint-text">
            No mapping yet. Run the trial balance pipeline first.
          </p>
        ) : null}
        {mappingQuery.isError && !mappingNotFound ? (
          <p className="error-text">
            {toUserFacingErrorMessage(mappingQuery.error)}
          </p>
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
                  <th>Closing balance</th>
                  <th>Reason</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {mappingQuery.data.mapping.decisions.map((decision) => {
                  const draft = drafts[decision.id];
                  const allowedCategories = categoriesV1.filter(
                    (category) =>
                      category.statementType ===
                      decision.proposedCategory.statementType,
                  );

                  return (
                    <tr key={decision.id}>
                      <td>
                        <div className="cell-title">
                          {decision.sourceAccountNumber}
                        </div>
                        <div className="cell-subtle">
                          {decision.accountName}
                        </div>
                        <div className="cell-subtle">
                          {Math.round(decision.confidence * 100)}% ·{" "}
                          {decision.status}
                        </div>
                      </td>
                      <td>
                        <div className="cell-title">
                          {decision.selectedCategory.code}
                        </div>
                        <div className="cell-subtle">
                          {decision.selectedCategory.name}
                        </div>
                      </td>
                      <td>
                        <select
                          value={draft?.scope ?? "return"}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [decision.id]: {
                                ...(current[decision.id] ?? {
                                  selectedCategoryCode:
                                    decision.selectedCategory.code,
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
                          value={
                            draft?.selectedCategoryCode ??
                            decision.selectedCategory.code
                          }
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [decision.id]: {
                                ...(current[decision.id] ?? {
                                  scope: "return",
                                  reason: "",
                                  selectedCategoryCode:
                                    decision.selectedCategory.code,
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
                      <td>{formatBalanceValueV1(decision.closingBalance)}</td>
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
                                  selectedCategoryCode:
                                    decision.selectedCategory.code,
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
                          onClick={() =>
                            applyOverrideMutation.mutate(decision.id)
                          }
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
          <p className="error-text">
            {toUserFacingErrorMessage(applyOverrideMutation.error)}
          </p>
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
              onChange={(event) =>
                setReviewScope(event.target.value as "return" | "user")
              }
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
              onChange={(event) =>
                setReviewMax(Number(event.target.value) || 30)
              }
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={reviewMutation.isPending || !mappingQuery.isSuccess}
          >
            {reviewMutation.isPending
              ? "Generating..."
              : "Generate suggestions"}
          </button>
        </form>
        {reviewMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(reviewMutation.error)}
          </p>
        ) : null}
        {reviewResult ? (
          <>
            <p className="hint-text">
              {reviewResult.suggestions.summary.suggestedOverrides} suggestions
              generated.
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
                    const isChecked = selectedSuggestionIds.includes(
                      suggestion.decisionId,
                    );
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
                                  : current.filter(
                                      (id) => id !== suggestion.decisionId,
                                    ),
                              );
                            }}
                          />
                        </td>
                        <td>
                          {decision?.sourceAccountNumber ??
                            suggestion.decisionId}
                        </td>
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
                applySuggestionsMutation.isPending ||
                selectedSuggestionIds.length === 0
              }
              onClick={() => applySuggestionsMutation.mutate()}
            >
              {applySuggestionsMutation.isPending
                ? "Applying suggestions..."
                : "Apply selected suggestions"}
            </button>
          </>
        ) : (
          <p className="hint-text">
            Generate suggestions to review advisory overrides.
          </p>
        )}
        {applySuggestionsMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(applySuggestionsMutation.error)}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>Tax adjustments</h2>
        <form
          className="form-grid form-grid--inline"
          onSubmit={(event) => {
            event.preventDefault();
            runTaxAdjustmentsMutation.mutate();
          }}
        >
          <label>
            Policy version
            <input
              type="text"
              value={taxAdjustmentsPolicyVersion}
              onChange={(event) =>
                setTaxAdjustmentsPolicyVersion(event.target.value)
              }
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={
              runTaxAdjustmentsMutation.isPending || !annualExtractionConfirmed
            }
          >
            {runTaxAdjustmentsMutation.isPending
              ? "Running..."
              : "Run adjustments"}
          </button>
        </form>
        {taxAdjustmentsQuery.isSuccess ? (
          <p className="hint-text">
            Active v{taxAdjustmentsQuery.data.active.version} · decisions:{" "}
            {taxAdjustmentsQuery.data.adjustments.summary.totalDecisions} · net:{" "}
            {taxAdjustmentsQuery.data.adjustments.summary.totalNetAdjustments}
          </p>
        ) : null}
        {taxAdjustmentsNotFound ? (
          <p className="hint-text">
            No active adjustments yet. Upload a complete annual report and run
            trial balance mapping first.
          </p>
        ) : null}
        {taxAdjustmentsQuery.isError && !taxAdjustmentsNotFound ? (
          <p className="error-text">
            {toUserFacingErrorMessage(taxAdjustmentsQuery.error)}
          </p>
        ) : null}
        <div className="form-grid form-grid--inline">
          <label>
            Override first decision amount
            <input
              type="number"
              value={adjustmentOverrideAmount}
              onChange={(event) =>
                setAdjustmentOverrideAmount(event.target.value)
              }
            />
          </label>
          <label>
            Reason
            <input
              type="text"
              value={adjustmentOverrideReason}
              onChange={(event) =>
                setAdjustmentOverrideReason(event.target.value)
              }
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={applyTaxAdjustmentOverrideMutation.isPending}
            onClick={() => applyTaxAdjustmentOverrideMutation.mutate()}
          >
            Apply adjustment override
          </button>
        </div>
        {runTaxAdjustmentsMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(runTaxAdjustmentsMutation.error)}
          </p>
        ) : null}
        {applyTaxAdjustmentOverrideMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(applyTaxAdjustmentOverrideMutation.error)}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>Tax summary</h2>
        <button
          type="button"
          className="primary"
          disabled={
            runTaxSummaryMutation.isPending || !annualExtractionConfirmed
          }
          onClick={() => runTaxSummaryMutation.mutate()}
        >
          {runTaxSummaryMutation.isPending ? "Running..." : "Run tax summary"}
        </button>
        {taxSummaryQuery.isSuccess ? (
          <dl className="workspace-meta-grid">
            <div>
              <dt>Taxable income</dt>
              <dd>{taxSummaryQuery.data.summary.taxableIncome}</dd>
            </div>
            <div>
              <dt>Corporate tax</dt>
              <dd>{taxSummaryQuery.data.summary.corporateTax}</dd>
            </div>
          </dl>
        ) : null}
        {taxSummaryNotFound ? (
          <p className="hint-text">
            No tax summary yet. Run tax adjustments first.
          </p>
        ) : null}
        {taxSummaryQuery.isError && !taxSummaryNotFound ? (
          <p className="error-text">
            {toUserFacingErrorMessage(taxSummaryQuery.error)}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>INK2 draft</h2>
        <button
          type="button"
          className="primary"
          disabled={runInk2FormMutation.isPending || !annualExtractionConfirmed}
          onClick={() => runInk2FormMutation.mutate()}
        >
          {runInk2FormMutation.isPending ? "Running..." : "Run INK2 draft"}
        </button>
        {ink2FormQuery.isSuccess ? (
          <>
            <p className="hint-text">
              Active v{ink2FormQuery.data.active.version} · validation:{" "}
              {ink2FormQuery.data.form.validation.status}
            </p>
            <div className="form-grid form-grid--inline">
              <label>
                Override first field amount
                <input
                  type="number"
                  value={ink2OverrideAmount}
                  onChange={(event) =>
                    setInk2OverrideAmount(event.target.value)
                  }
                />
              </label>
              <label>
                Reason
                <input
                  type="text"
                  value={ink2OverrideReason}
                  onChange={(event) =>
                    setInk2OverrideReason(event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={applyInk2OverrideMutation.isPending}
                onClick={() => applyInk2OverrideMutation.mutate()}
              >
                Apply INK2 override
              </button>
            </div>
          </>
        ) : null}
        {ink2FormNotFound ? (
          <p className="hint-text">
            No INK2 form yet. Run tax adjustments and tax summary first.
          </p>
        ) : null}
        {ink2FormQuery.isError && !ink2FormNotFound ? (
          <p className="error-text">
            {toUserFacingErrorMessage(ink2FormQuery.error)}
          </p>
        ) : null}
        {applyInk2OverrideMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(applyInk2OverrideMutation.error)}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>PDF export</h2>
        <button
          type="button"
          className="primary"
          disabled={createPdfExportMutation.isPending}
          onClick={() => createPdfExportMutation.mutate()}
        >
          {createPdfExportMutation.isPending
            ? "Generating..."
            : "Generate PDF export"}
        </button>
        {createPdfExportMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(createPdfExportMutation.error)}
          </p>
        ) : null}
        {exportsQuery.isSuccess ? (
          <p className="hint-text">
            Exports: {exportsQuery.data.exports.length}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>Comments</h2>
        <form
          className="form-grid form-grid--inline"
          onSubmit={(event) => {
            event.preventDefault();
            createCommentMutation.mutate();
          }}
        >
          <label>
            New comment
            <input
              type="text"
              value={newCommentBody}
              onChange={(event) => setNewCommentBody(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={createCommentMutation.isPending}
          >
            Add comment
          </button>
        </form>
        {commentsQuery.isSuccess ? (
          <ul>
            {commentsQuery.data.comments.map((comment) => (
              <li key={comment.id}>{comment.body}</li>
            ))}
          </ul>
        ) : null}
        {createCommentMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(createCommentMutation.error)}
          </p>
        ) : null}
      </article>

      <article className="card card--section">
        <h2>Tasks</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            createTaskMutation.mutate();
          }}
        >
          <label>
            Title
            <input
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
            />
          </label>
          <label>
            Description
            <input
              type="text"
              value={newTaskDescription}
              onChange={(event) => setNewTaskDescription(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={createTaskMutation.isPending}
          >
            Add task
          </button>
        </form>
        {tasksQuery.isSuccess ? (
          <ul>
            {tasksQuery.data.tasks.map((task) => (
              <li key={task.id}>
                {task.title} ({task.status}){" "}
                {task.status === "open" ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => completeTaskMutation.mutate(task.id)}
                    disabled={completeTaskMutation.isPending}
                  >
                    Complete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {createTaskMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(createTaskMutation.error)}
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
              rows={2}
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Optional reason"
            />
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={
              statusMutation.isPending ||
              (requiresReason && !statusReason.trim())
            }
          >
            {statusMutation.isPending ? "Applying..." : "Apply transition"}
          </button>
        </form>
        {requiresReason ? (
          <p className="hint-text">
            Reopening from filed to draft requires a reason.
          </p>
        ) : null}
        {statusMutation.isError ? (
          <p className="error-text">
            {toUserFacingErrorMessage(statusMutation.error)}
          </p>
        ) : null}
        {statusMutation.isSuccess ? (
          <p className="success-text">Workspace status updated successfully.</p>
        ) : null}
      </article>

      <ConfirmModalV1
        isOpen={confirmModal !== null}
        title="Confirm action"
        message={confirmModal?.message ?? ""}
        confirmLabel={confirmModal?.confirmLabel ?? "Confirm"}
        onConfirm={() => {
          confirmModal?.onConfirm();
          setConfirmModal(null);
        }}
        onCancel={() => setConfirmModal(null)}
      />
    </section>
  );
}
