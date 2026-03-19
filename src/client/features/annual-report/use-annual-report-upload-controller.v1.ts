import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1 } from "../../../shared/contracts/annual-report-upload-session.v1";
import type {
  AnnualReportProcessingRunStatusV1,
  AnnualReportProcessingRunV1,
} from "../../../shared/contracts/annual-report-processing-run.v1";
import {
  ApiClientError,
} from "../../lib/http/api-client";
import {
  clearAnnualReportDataV1,
  uploadAnnualReportAndStartProcessingV1,
  type ClearAnnualReportDataResponseV1,
  type CreateAnnualReportProcessingRunResponseV1,
} from "../../lib/http/workspace-api";

const ANNUAL_REPORT_OPEN_RUN_STATUSES_V1 = new Set<
  AnnualReportProcessingRunStatusV1
>([
  "queued",
  "uploading_source",
  "locating_sections",
  "extracting_core_facts",
  "extracting_statements",
  "extracting_tax_notes",
  "running_tax_analysis",
]);
// Keep the stale warning aligned with the UI copy: a run is only "stale"
// after several minutes without progress, not after a short AI pause.
const ANNUAL_REPORT_STALE_RUN_THRESHOLD_MS_V1 = 5 * 60 * 1_000;

const REPLACE_ANNUAL_REPORT_CONFIRMATION_V1 =
  "Upload a new annual report? This will replace the active annual-report dataset and dependent tax outputs for this workspace. Previous versions will still be kept in history.";
const CLEAR_ANNUAL_REPORT_CONFIRMATION_V1 =
  "Clear the current annual-report data? This will remove the active annual-report extraction and dependent tax outputs from this workspace. Historical versions will still be kept.";


function scrollUploadPanelIntoViewV1(uploadPanelId: string): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const uploadPanel = document.getElementById(uploadPanelId);
  if (uploadPanel && typeof uploadPanel.scrollIntoView === "function") {
    uploadPanel.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
  return uploadPanel;
}

export function isAnnualReportProcessingOpenStatusV1(
  status: AnnualReportProcessingRunStatusV1 | undefined,
): boolean {
  return status ? ANNUAL_REPORT_OPEN_RUN_STATUSES_V1.has(status) : false;
}

export function isAnnualReportOpenRunStaleV1(
  run: AnnualReportProcessingRunV1 | undefined,
): boolean {
  if (!run || !isAnnualReportProcessingOpenStatusV1(run.status)) {
    return false;
  }

  const updatedAtMs = Date.parse(run.updatedAt);
  if (Number.isNaN(updatedAtMs)) {
    return false;
  }

  return Date.now() - updatedAtMs >= ANNUAL_REPORT_STALE_RUN_THRESHOLD_MS_V1;
}

export function formatAnnualReportRunElapsedLabelV1(
  run: AnnualReportProcessingRunV1 | undefined,
): string | null {
  if (!run?.startedAt) {
    return null;
  }

  const startedAtMs = Date.parse(run.startedAt);
  if (Number.isNaN(startedAtMs)) {
    return null;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - startedAtMs) / 1_000),
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s elapsed` : `${seconds}s elapsed`;
}

export function selectAnnualReportProgressDetailsV1(
  run: AnnualReportProcessingRunV1 | undefined,
): string[] {
  if (!run) {
    return [];
  }

  return run.technicalDetails
    .filter((detail) => detail.startsWith("progress.") || detail.startsWith("routing."))
    .slice(-4);
}

export type AnnualReportUploadControllerOptionsV1 = {
  clearSuccessInvalidateQueryKeys: QueryKey[];
  clearSuccessRemoveQueryKeys?: QueryKey[];
  hasActiveExtraction: boolean;
  latestRun: AnnualReportProcessingRunV1 | undefined;
  latestRunQueryKey: QueryKey;
  onConfirmRequired: (message: string, confirmLabel: string, onConfirm: () => void) => void;
  policyVersion: string;
  settledRunInvalidateQueryKeys: QueryKey[];
  tenantId: string;
  uploadPanelId: string;
  uploadSuccessInvalidateQueryKeys: QueryKey[];
  workspaceId: string;
};

export function useAnnualReportUploadControllerV1(
  options: AnnualReportUploadControllerOptionsV1,
) {
  const queryClient = useQueryClient();
  const [annualReportFile, setAnnualReportFile] = useState<File | null>(null);
  const [annualReportUploadProgress, setAnnualReportUploadProgress] = useState<{
    loadedBytes: number;
    totalBytes: number;
  } | null>(null);
  const [lastSettledAnnualReportRunKey, setLastSettledAnnualReportRunKey] =
    useState("");

  const annualReportMutation = useMutation({
    mutationFn: async (): Promise<CreateAnnualReportProcessingRunResponseV1> => {
      if (!annualReportFile) {
        throw new Error("Select an annual report file first.");
      }

      return uploadAnnualReportAndStartProcessingV1({
        tenantId: options.tenantId,
        workspaceId: options.workspaceId,
        file: annualReportFile,
        policyVersion: options.policyVersion,
        onUploadProgress: (progress) => {
          setAnnualReportUploadProgress(progress);
        },
      });
    },
    onSuccess: async (result) => {
      setAnnualReportUploadProgress(null);
      queryClient.setQueryData(options.latestRunQueryKey, result);
      await Promise.all(
        options.uploadSuccessInvalidateQueryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      setAnnualReportFile(null);
    },
    onError: () => {
      setAnnualReportUploadProgress(null);
    },
  });

  const clearAnnualReportMutation = useMutation({
    mutationFn: async (): Promise<ClearAnnualReportDataResponseV1> =>
      clearAnnualReportDataV1({
        tenantId: options.tenantId,
        workspaceId: options.workspaceId,
      }),
    onSuccess: async () => {
      setAnnualReportFile(null);
      setAnnualReportUploadProgress(null);
      setLastSettledAnnualReportRunKey("");

      for (const queryKey of options.clearSuccessRemoveQueryKeys ?? []) {
        queryClient.removeQueries({ queryKey });
      }

      await Promise.all(
        options.clearSuccessInvalidateQueryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });

  const annualReportRunIsOpen = isAnnualReportProcessingOpenStatusV1(
    options.latestRun?.status,
  );
  const annualReportRunIsStale = isAnnualReportOpenRunStaleV1(options.latestRun);
  const annualReportUploadBlockedByRun =
    annualReportRunIsOpen && !annualReportRunIsStale;
  const annualReportFileTooLarge = Boolean(
    annualReportFile &&
      annualReportFile.size > MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1,
  );
  const annualReportMutationErrorCode =
    annualReportMutation.error instanceof ApiClientError
      ? annualReportMutation.error.code
      : null;

  useEffect(() => {
    if (!options.latestRun) {
      return;
    }

    if (isAnnualReportProcessingOpenStatusV1(options.latestRun.status)) {
      return;
    }

    const settledKey = `${options.latestRun.runId}:${options.latestRun.status}`;
    if (settledKey === lastSettledAnnualReportRunKey) {
      return;
    }

    setLastSettledAnnualReportRunKey(settledKey);
    void Promise.all(
      options.settledRunInvalidateQueryKeys.map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  }, [
    lastSettledAnnualReportRunKey,
    options.latestRun,
    options.settledRunInvalidateQueryKeys,
    queryClient,
  ]);

  const annualUploadProgressPercent =
    annualReportUploadProgress && annualReportUploadProgress.totalBytes > 0
      ? Math.min(
          100,
          Math.round(
            (annualReportUploadProgress.loadedBytes /
              annualReportUploadProgress.totalBytes) *
              100,
          ),
        )
      : null;

  const canSubmitSelectedFile =
    annualReportFile !== null &&
    !annualReportFileTooLarge &&
    !annualReportMutation.isPending &&
    !annualReportUploadBlockedByRun;

  const openFilePicker = () => {
    if (annualReportMutation.isPending || annualReportUploadBlockedByRun) {
      return;
    }

    const uploadPanel = scrollUploadPanelIntoViewV1(options.uploadPanelId);
    const input = uploadPanel?.querySelector(
      'input[type="file"]:not([disabled])',
    ) as HTMLInputElement | null;
    input?.click();
  };

  const startUpload = () => {
    if (!canSubmitSelectedFile) {
      return false;
    }

    if (options.hasActiveExtraction) {
      options.onConfirmRequired(
        REPLACE_ANNUAL_REPORT_CONFIRMATION_V1,
        "Replace report",
        () => annualReportMutation.mutate(),
      );
      return false;
    }

    annualReportMutation.mutate();
    return true;
  };

  const clearActiveData = () => {
    options.onConfirmRequired(
      CLEAR_ANNUAL_REPORT_CONFIRMATION_V1,
      "Clear data",
      () => clearAnnualReportMutation.mutate(),
    );
    return false;
  };

  const runRecoveryAction = () => {
    if (canSubmitSelectedFile) {
      return startUpload();
    }

    openFilePicker();
    return false;
  };

  const recoveryActionLabel = useMemo(() => {
    if (canSubmitSelectedFile) {
      return "Retry analysis";
    }

    if (annualReportFileTooLarge || options.hasActiveExtraction) {
      return "Choose another file";
    }

    if (
      options.latestRun?.status === "failed" ||
      options.latestRun?.status === "partial"
    ) {
      return "Choose replacement file";
    }

    return "Choose annual report";
  }, [
    annualReportFileTooLarge,
    canSubmitSelectedFile,
    options.latestRun?.status,
    options.hasActiveExtraction,
  ]);

  return {
    annualReportFile,
    annualReportFileTooLarge,
    annualReportMutation,
    annualReportMutationErrorCode,
    annualReportRunIsOpen,
    annualReportRunIsStale,
    annualReportUploadBlockedByRun,
    annualUploadProgressPercent,
    clearAnnualReportMutation,
    clearActiveData,
    openFilePicker,
    recoveryActionLabel,
    runRecoveryAction,
    setAnnualReportFile,
    startUpload,
  };
}
