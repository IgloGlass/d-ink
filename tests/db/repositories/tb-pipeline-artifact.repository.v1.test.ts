import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1TbPipelineArtifactRepositoryV1 } from "../../../src/db/repositories/tb-pipeline-artifact.repository.v1";
import { MappingDecisionSetPayloadV1Schema } from "../../../src/shared/contracts/mapping.v1";
import { parseReconciliationResultPayloadV1 } from "../../../src/shared/contracts/reconciliation.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

const TENANT_ID = "83000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "83000000-0000-4000-8000-000000000002";
const COMPANY_ID = "83000000-0000-4000-8000-000000000003";

async function seedWorkspace(): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO workspaces (
        id,
        tenant_id,
        company_id,
        fiscal_year_start,
        fiscal_year_end,
        status,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `,
  )
    .bind(
      WORKSPACE_ID,
      TENANT_ID,
      COMPANY_ID,
      "2025-01-01",
      "2025-12-31",
      "draft",
      "2026-03-02T10:00:00.000Z",
      "2026-03-02T10:00:00.000Z",
    )
    .run();
}

function buildTrialBalancePayload(input?: {
  accountName?: string;
  accountNumber?: string;
  closingBalance?: number;
}): ReturnType<typeof parseTrialBalanceNormalizedV1> {
  const accountName = input?.accountName ?? "Cash";
  const accountNumber = input?.accountNumber ?? "1000";
  const closingBalance = input?.closingBalance ?? 1200;

  return parseTrialBalanceNormalizedV1({
    schemaVersion: "trial_balance_normalized_v1",
    fileType: "xlsx",
    selectedSheetName: "Trial Balance",
    headerRowNumber: 1,
    columnMappings: [
      {
        key: "account_name",
        required: true,
        sourceHeader: "Account Name",
        normalizedSourceHeader: "account name",
        sourceColumnIndex: 0,
        sourceColumnLetter: "A",
        matchType: "exact_synonym",
      },
      {
        key: "account_number",
        required: true,
        sourceHeader: "Account Number",
        normalizedSourceHeader: "account number",
        sourceColumnIndex: 1,
        sourceColumnLetter: "B",
        matchType: "exact_synonym",
      },
      {
        key: "opening_balance",
        required: true,
        sourceHeader: "Opening Balance",
        normalizedSourceHeader: "opening balance",
        sourceColumnIndex: 2,
        sourceColumnLetter: "C",
        matchType: "exact_synonym",
      },
      {
        key: "closing_balance",
        required: true,
        sourceHeader: "Closing Balance",
        normalizedSourceHeader: "closing balance",
        sourceColumnIndex: 3,
        sourceColumnLetter: "D",
        matchType: "exact_synonym",
      },
    ],
    rows: [
      {
        accountName,
        accountNumber,
        sourceAccountNumber: accountNumber,
        openingBalance: 1000,
        closingBalance,
        source: {
          sheetName: "Trial Balance",
          rowNumber: 2,
        },
        rawValues: {
          account_name: accountName,
          account_number: accountNumber,
          opening_balance: "1000",
          closing_balance: String(closingBalance),
        },
      },
    ],
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "Trial Balance",
        headerRowNumber: 1,
        requiredColumnsMatched: 4,
        candidateDataRows: 1,
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: 2,
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 1000,
      closingBalanceTotal: closingBalance,
      checks: [
        {
          code: "required_columns_present",
          status: "pass",
          message: "ok",
          context: {},
        },
      ],
    },
  });
}

function buildReconciliationPayload() {
  return parseReconciliationResultPayloadV1({
    schemaVersion: "reconciliation_result_v1",
    status: "pass",
    canProceedToMapping: true,
    blockingReasonCodes: [],
    summary: {
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      materialRejectedRows: 0,
      nonMaterialRejectedRows: 0,
      openingBalanceTotal: 1000,
      closingBalanceTotal: 1200,
    },
    checks: [
      {
        code: "candidate_rows_present",
        status: "pass",
        blocking: false,
        message: "ok",
        context: {},
      },
    ],
  });
}

function buildMappingPayload() {
  return MappingDecisionSetPayloadV1Schema.parse({
    schemaVersion: "mapping_decisions_v1",
    policyVersion: "deterministic-bas.v1",
    summary: {
      totalRows: 1,
      deterministicDecisions: 1,
      manualReviewRequired: 0,
      fallbackDecisions: 0,
      matchedByAccountNumber: 1,
      matchedByAccountName: 0,
      unmatchedRows: 0,
    },
    decisions: [
      {
        id: "row-1",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        accountName: "Representation external ej avdragsgill",
        proposedCategory: {
          code: "607200",
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement",
        },
        selectedCategory: {
          code: "607200",
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement",
        },
        confidence: 0.9,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:2",
          },
        ],
        policyRuleReference: "map.is.entertainment.non-deductible.v1",
        reviewFlag: false,
        status: "proposed",
        source: "deterministic",
      },
    ],
  });
}

describe("D1 TB pipeline artifact repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("appends immutable trial-balance versions and advances active pointer", async () => {
    await seedWorkspace();
    const repository = createD1TbPipelineArtifactRepositoryV1(env.DB);

    const firstWrite = await repository.appendTrialBalanceAndSetActive({
      artifactId: "84000000-0000-4000-8000-000000000001",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:10:00.000Z",
      trialBalance: buildTrialBalancePayload({
        accountName: "Cash",
        accountNumber: "1000",
        closingBalance: 1200,
      }),
    });
    expect(firstWrite.ok).toBe(true);
    if (!firstWrite.ok) {
      return;
    }
    expect(firstWrite.artifact.version).toBe(1);

    const secondWrite = await repository.appendTrialBalanceAndSetActive({
      artifactId: "84000000-0000-4000-8000-000000000002",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:20:00.000Z",
      trialBalance: buildTrialBalancePayload({
        accountName: "Accounts receivable",
        accountNumber: "1510",
        closingBalance: 900,
      }),
    });
    expect(secondWrite.ok).toBe(true);
    if (!secondWrite.ok) {
      return;
    }
    expect(secondWrite.artifact.version).toBe(2);

    const activeArtifact = await repository.getActiveTrialBalance({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(activeArtifact?.id).toBe("84000000-0000-4000-8000-000000000002");
    expect(activeArtifact?.version).toBe(2);
    expect(activeArtifact?.payload.rows[0]?.accountNumber).toBe("1510");

    const listed = await repository.listTrialBalanceVersions({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(listed).toHaveLength(2);
    expect(listed[0]?.version).toBe(2);
    expect(listed[1]?.version).toBe(1);
  });

  it("returns WORKSPACE_NOT_FOUND when appending artifacts to unknown workspace", async () => {
    const repository = createD1TbPipelineArtifactRepositoryV1(env.DB);

    const writeResult = await repository.appendTrialBalanceAndSetActive({
      artifactId: "84000000-0000-4000-8000-000000000011",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:30:00.000Z",
      trialBalance: buildTrialBalancePayload(),
    });

    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) {
      expect(writeResult.code).toBe("WORKSPACE_NOT_FOUND");
    }
  });

  it("maintains independent version sequences per artifact type", async () => {
    await seedWorkspace();
    const repository = createD1TbPipelineArtifactRepositoryV1(env.DB);

    const trialBalanceWrite = await repository.appendTrialBalanceAndSetActive({
      artifactId: "84000000-0000-4000-8000-000000000021",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:40:00.000Z",
      trialBalance: buildTrialBalancePayload(),
    });
    expect(trialBalanceWrite.ok).toBe(true);
    if (!trialBalanceWrite.ok) {
      return;
    }
    expect(trialBalanceWrite.artifact.version).toBe(1);

    const reconciliationWrite =
      await repository.appendReconciliationAndSetActive({
        artifactId: "84000000-0000-4000-8000-000000000022",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        createdAt: "2026-03-02T10:41:00.000Z",
        reconciliation: buildReconciliationPayload(),
      });
    expect(reconciliationWrite.ok).toBe(true);
    if (!reconciliationWrite.ok) {
      return;
    }
    expect(reconciliationWrite.artifact.version).toBe(1);

    const mappingWrite = await repository.appendMappingAndSetActive({
      artifactId: "84000000-0000-4000-8000-000000000023",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:42:00.000Z",
      mapping: buildMappingPayload(),
    });
    expect(mappingWrite.ok).toBe(true);
    if (!mappingWrite.ok) {
      return;
    }
    expect(mappingWrite.artifact.version).toBe(1);

    const secondReconciliationWrite =
      await repository.appendReconciliationAndSetActive({
        artifactId: "84000000-0000-4000-8000-000000000024",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        createdAt: "2026-03-02T10:43:00.000Z",
        reconciliation: buildReconciliationPayload(),
      });
    expect(secondReconciliationWrite.ok).toBe(true);
    if (!secondReconciliationWrite.ok) {
      return;
    }
    expect(secondReconciliationWrite.artifact.version).toBe(2);

    const activeTrialBalance = await repository.getActiveTrialBalance({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    const activeReconciliation = await repository.getActiveReconciliation({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    const activeMapping = await repository.getActiveMapping({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(activeTrialBalance?.version).toBe(1);
    expect(activeReconciliation?.version).toBe(2);
    expect(activeMapping?.version).toBe(1);
  });

  it("keeps active pointer unchanged when append fails", async () => {
    await seedWorkspace();
    const repository = createD1TbPipelineArtifactRepositoryV1(env.DB);
    const duplicateArtifactId = "84000000-0000-4000-8000-000000000031";

    const firstWrite = await repository.appendTrialBalanceAndSetActive({
      artifactId: duplicateArtifactId,
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:50:00.000Z",
      trialBalance: buildTrialBalancePayload({
        accountName: "Cash",
        accountNumber: "1000",
        closingBalance: 1200,
      }),
    });
    expect(firstWrite.ok).toBe(true);

    const secondWrite = await repository.appendTrialBalanceAndSetActive({
      artifactId: duplicateArtifactId,
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-02T10:51:00.000Z",
      trialBalance: buildTrialBalancePayload({
        accountName: "Inventory",
        accountNumber: "1400",
        closingBalance: 500,
      }),
    });

    expect(secondWrite.ok).toBe(false);
    if (!secondWrite.ok) {
      expect(secondWrite.code).toBe("PERSISTENCE_ERROR");
    }

    const activeArtifact = await repository.getActiveTrialBalance({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(activeArtifact?.id).toBe(duplicateArtifactId);
    expect(activeArtifact?.version).toBe(1);
    expect(activeArtifact?.payload.rows[0]?.accountNumber).toBe("1000");

    const countRow = await env.DB.prepare(
      `
        SELECT COUNT(*) AS count
        FROM tb_pipeline_artifact_versions
        WHERE tenant_id = ?1
          AND workspace_id = ?2
          AND artifact_type = 'trial_balance'
      `,
    )
      .bind(TENANT_ID, WORKSPACE_ID)
      .first<{ count: number }>();
    expect(countRow?.count).toBe(1);
  });

  it("throws if persisted payload is corrupted and fails contract parsing", async () => {
    await seedWorkspace();
    const repository = createD1TbPipelineArtifactRepositoryV1(env.DB);

    await env.DB.prepare(
      `
        INSERT INTO tb_pipeline_artifact_versions (
          id,
          tenant_id,
          workspace_id,
          artifact_type,
          version,
          schema_version,
          payload_json,
          created_at,
          created_by_user_id
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL)
      `,
    )
      .bind(
        "84000000-0000-4000-8000-000000000041",
        TENANT_ID,
        WORKSPACE_ID,
        "trial_balance",
        1,
        "trial_balance_normalized_v1",
        "{invalid_json",
        "2026-03-02T11:00:00.000Z",
      )
      .run();

    await env.DB.prepare(
      `
        INSERT INTO tb_pipeline_active_artifacts (
          tenant_id,
          workspace_id,
          artifact_type,
          active_artifact_id,
          active_version,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `,
    )
      .bind(
        TENANT_ID,
        WORKSPACE_ID,
        "trial_balance",
        "84000000-0000-4000-8000-000000000041",
        1,
        "2026-03-02T11:00:00.000Z",
      )
      .run();

    await expect(
      repository.getActiveTrialBalance({
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toThrow();
  });
});
