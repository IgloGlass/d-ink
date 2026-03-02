import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import type { AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import type {
  MappingPreferenceFindApplicableResultV1,
  MappingPreferenceRepositoryV1,
  MappingPreferenceUpsertBatchResultV1,
  MappingPreferenceUpsertEntryV1,
} from "../../../src/db/repositories/mapping-preference.repository.v1";
import type {
  TbPipelineArtifactRepositoryV1,
  TbPipelineArtifactVersionRecordV1,
} from "../../../src/db/repositories/tb-pipeline-artifact.repository.v1";
import { executeTrialBalancePipelineRunV1 } from "../../../src/server/workflow/trial-balance-pipeline-run.v1";
import type { AuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";

type PersistedByTypeV1 = {
  mapping: TbPipelineArtifactVersionRecordV1<"mapping">[];
  reconciliation: TbPipelineArtifactVersionRecordV1<"reconciliation">[];
  trial_balance: TbPipelineArtifactVersionRecordV1<"trial_balance">[];
};

class InMemoryTbPipelineArtifactRepositoryV1
  implements TbPipelineArtifactRepositoryV1
{
  private readonly persisted: PersistedByTypeV1 = {
    trial_balance: [],
    reconciliation: [],
    mapping: [],
  };

  private readonly active = {
    trial_balance:
      null as TbPipelineArtifactVersionRecordV1<"trial_balance"> | null,
    reconciliation:
      null as TbPipelineArtifactVersionRecordV1<"reconciliation"> | null,
    mapping: null as TbPipelineArtifactVersionRecordV1<"mapping"> | null,
  };

  constructor(
    private readonly workspaces: Set<string>,
    private readonly tenantId: string,
  ) {}

  private getWorkspaceKey(workspaceId: string): string {
    return `${this.tenantId}:${workspaceId}`;
  }

  private nextVersion<TType extends keyof PersistedByTypeV1>(
    artifactType: TType,
  ): number {
    return this.persisted[artifactType].length + 1;
  }

  async appendTrialBalanceAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    tenantId: string;
    trialBalance: TbPipelineArtifactVersionRecordV1<"trial_balance">["payload"];
    workspaceId: string;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const version = this.nextVersion("trial_balance");
    const artifact: TbPipelineArtifactVersionRecordV1<"trial_balance"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "trial_balance",
      version,
      schemaVersion: input.trialBalance.schemaVersion,
      payload: input.trialBalance,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };

    this.persisted.trial_balance.push(artifact);
    this.active.trial_balance = artifact;
    return { ok: true as const, artifact };
  }

  async appendReconciliationAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    reconciliation: TbPipelineArtifactVersionRecordV1<"reconciliation">["payload"];
    tenantId: string;
    workspaceId: string;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const version = this.nextVersion("reconciliation");
    const artifact: TbPipelineArtifactVersionRecordV1<"reconciliation"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "reconciliation",
      version,
      schemaVersion: input.reconciliation.schemaVersion,
      payload: input.reconciliation,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };

    this.persisted.reconciliation.push(artifact);
    this.active.reconciliation = artifact;
    return { ok: true as const, artifact };
  }

  async appendMappingAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    mapping: TbPipelineArtifactVersionRecordV1<"mapping">["payload"];
    tenantId: string;
    workspaceId: string;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const version = this.nextVersion("mapping");
    const artifact: TbPipelineArtifactVersionRecordV1<"mapping"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "mapping",
      version,
      schemaVersion: input.mapping.schemaVersion,
      payload: input.mapping,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };

    this.persisted.mapping.push(artifact);
    this.active.mapping = artifact;
    return { ok: true as const, artifact };
  }

  async getActiveTrialBalance(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return this.active.trial_balance;
  }

  async getActiveReconciliation(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return this.active.reconciliation;
  }

  async getActiveMapping(input: { tenantId: string; workspaceId: string }) {
    void input;
    return this.active.mapping;
  }

  async listTrialBalanceVersions(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return [...this.persisted.trial_balance].sort(
      (left, right) => right.version - left.version,
    );
  }

  async listReconciliationVersions(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return [...this.persisted.reconciliation].sort(
      (left, right) => right.version - left.version,
    );
  }

  async listMappingVersions(input: { tenantId: string; workspaceId: string }) {
    void input;
    return [...this.persisted.mapping].sort(
      (left, right) => right.version - left.version,
    );
  }
}

type InMemoryPreferenceRecordV1 = MappingPreferenceUpsertEntryV1;

class InMemoryMappingPreferenceRepositoryV1
  implements MappingPreferenceRepositoryV1
{
  private readonly preferences: InMemoryPreferenceRecordV1[] = [];

  async upsertBatch(
    input: Parameters<MappingPreferenceRepositoryV1["upsertBatch"]>[0],
  ): Promise<MappingPreferenceUpsertBatchResultV1> {
    for (const entry of input.entries) {
      const existingIndex = this.preferences.findIndex((existing) => {
        if (
          existing.scope !== entry.scope ||
          existing.sourceAccountNumber !== entry.sourceAccountNumber ||
          existing.statementType !== entry.statementType
        ) {
          return false;
        }

        if (entry.scope === "return") {
          return (
            existing.scope === "return" &&
            existing.workspaceId === entry.workspaceId
          );
        }

        return existing.scope === "user" && existing.userId === entry.userId;
      });

      if (existingIndex >= 0) {
        this.preferences[existingIndex] = entry;
      } else {
        this.preferences.push(entry);
      }
    }

    return {
      ok: true,
      savedCount: input.entries.length,
    };
  }

  async findApplicableForRows(
    input: Parameters<
      MappingPreferenceRepositoryV1["findApplicableForRows"]
    >[0],
  ): Promise<MappingPreferenceFindApplicableResultV1> {
    const requestedKeys = new Set(
      input.rows.map(
        (row) => `${row.sourceAccountNumber.trim()}|${row.statementType}`,
      ),
    );

    const matched = this.preferences.filter((preference) => {
      const key = `${preference.sourceAccountNumber.trim()}|${preference.statementType}`;
      if (!requestedKeys.has(key)) {
        return false;
      }

      if (preference.scope === "return") {
        return preference.workspaceId === input.workspaceId;
      }

      return input.userId ? preference.userId === input.userId : false;
    });

    const selectedByKey = new Map<string, InMemoryPreferenceRecordV1>();
    for (const preference of matched) {
      const key = `${preference.sourceAccountNumber.trim()}|${preference.statementType}`;
      const existing = selectedByKey.get(key);
      if (!existing) {
        selectedByKey.set(key, preference);
        continue;
      }

      if (preference.scope === "return" && existing.scope === "user") {
        selectedByKey.set(key, preference);
      }
    }

    return {
      ok: true,
      preferences: [...selectedByKey.values()].map((preference, index) => ({
        id: `pref-${index + 1}`,
        tenantId: input.tenantId,
        scope: preference.scope,
        workspaceId:
          preference.scope === "return" ? preference.workspaceId : undefined,
        userId: preference.scope === "user" ? preference.userId : undefined,
        sourceAccountNumber: preference.sourceAccountNumber,
        statementType: preference.statementType,
        selectedCategoryCode: preference.selectedCategoryCode,
        reason: preference.reason,
        createdAt: "2026-03-02T12:00:00.000Z",
        updatedAt: "2026-03-02T12:00:00.000Z",
        createdByUserId: input.userId ?? "system",
        updatedByUserId: input.userId ?? "system",
      })),
    };
  }
}

class InMemoryAuditRepositoryV1 implements AuditRepositoryV1 {
  constructor(private readonly failAppend = false) {}

  public readonly events: AuditEventV2[] = [];

  async append(event: AuditEventV2) {
    if (this.failAppend) {
      return {
        ok: false as const,
        code: "PERSISTENCE_ERROR" as const,
        message: "Simulated audit persistence failure.",
      };
    }

    this.events.push(event);
    return {
      ok: true as const,
      event,
    };
  }
}

function createWorkbookBase64V1(input: { rows: unknown[][] }): string {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(input.rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Trial Balance");
  const bytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

describe("trial-balance pipeline run workflow v1", () => {
  const tenantId = "85000000-0000-4000-8000-000000000001";
  const workspaceId = "85000000-0000-4000-8000-000000000002";
  const userId = "85000000-0000-4000-8000-000000000003";

  function createDeps(input: {
    artifactRepository: TbPipelineArtifactRepositoryV1;
    mappingPreferenceRepository: MappingPreferenceRepositoryV1;
    auditRepository: AuditRepositoryV1;
  }) {
    let idCounter = 0;
    let secondCounter = 0;

    return {
      artifactRepository: input.artifactRepository,
      mappingPreferenceRepository: input.mappingPreferenceRepository,
      auditRepository: input.auditRepository,
      generateId: () => {
        idCounter += 1;
        return `85000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
      },
      nowIsoUtc: () => {
        secondCounter += 1;
        return `2026-03-02T12:00:${String(secondCounter).padStart(2, "0")}.000Z`;
      },
    };
  }

  it("returns INPUT_INVALID for malformed payloads", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );

    const result = await executeTrialBalancePipelineRunV1(
      {
        invalid: true,
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
    }
  });

  it("returns PARSE_FAILED for unsupported file format", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.txt",
        fileBytesBase64: "AQID",
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSE_FAILED");
    }
  });

  it("runs parser -> reconciliation -> mapping and persists versioned artifacts", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    const firstRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok) {
      return;
    }

    expect(firstRun.pipeline.artifacts.trialBalance.version).toBe(1);
    expect(firstRun.pipeline.artifacts.reconciliation.version).toBe(1);
    expect(firstRun.pipeline.artifacts.mapping.version).toBe(1);
    expect(firstRun.pipeline.mapping.decisions[0]?.selectedCategory.code).toBe(
      "607200",
    );

    const secondRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) {
      return;
    }

    expect(secondRun.pipeline.artifacts.trialBalance.version).toBe(2);
    expect(secondRun.pipeline.artifacts.reconciliation.version).toBe(2);
    expect(secondRun.pipeline.artifacts.mapping.version).toBe(2);
  });

  it("auto-applies saved preferences on rerun and marks decisions overridden", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    const firstRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );
    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok) {
      return;
    }
    expect(firstRun.pipeline.mapping.decisions[0]?.selectedCategory.code).toBe(
      "607200",
    );
    expect(firstRun.pipeline.mapping.decisions[0]?.status).toBe("proposed");

    await preferenceRepository.upsertBatch({
      tenantId,
      actorUserId: userId,
      nowIsoUtc: "2026-03-02T12:30:00.000Z",
      entries: [
        {
          scope: "user",
          userId,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "Reviewer preference",
        },
      ],
    });

    const secondRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );
    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) {
      return;
    }

    const decision = secondRun.pipeline.mapping.decisions[0];
    expect(decision?.selectedCategory.code).toBe("607100");
    expect(decision?.status).toBe("overridden");
    expect(decision?.source).toBe("manual");
    expect(decision?.reviewFlag).toBe(false);
    expect(secondRun.pipeline.artifacts.mapping.version).toBe(2);

    expect(
      auditRepository.events.some(
        (event) => event.eventType === "mapping.preferences_auto_applied",
      ),
    ).toBe(true);
  });

  it("returns success when auto-apply audit append fails after artifacts are committed", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1(true);
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    await preferenceRepository.upsertBatch({
      tenantId,
      actorUserId: userId,
      nowIsoUtc: "2026-03-02T12:30:00.000Z",
      entries: [
        {
          scope: "user",
          userId,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "Reviewer preference",
        },
      ],
    });

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pipeline.artifacts.mapping.version).toBe(1);
    expect(result.pipeline.mapping.decisions[0]?.status).toBe("overridden");
  });
});
