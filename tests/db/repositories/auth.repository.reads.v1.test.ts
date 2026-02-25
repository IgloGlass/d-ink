import { describe, expect, it } from "vitest";

import { createAuthRepositoryReadsV1 } from "../../../src/db/repositories/auth.repository.reads.v1";
import type {
  D1Database,
  D1PreparedStatement,
} from "../../../src/shared/types/d1";

type StatementConfig = {
  error?: Error;
  row?: unknown;
};

function createMockDb(config: StatementConfig): D1Database {
  const statement: D1PreparedStatement = {
    all: async () => {
      throw new Error("not used");
    },
    bind: () => statement,
    first: async <T = Record<string, unknown>>() => {
      if (config.error) {
        throw config.error;
      }
      return ((config.row as T | null) ?? null) as T | null;
    },
    run: async () => ({ success: true, meta: {} }),
  };

  return {
    batch: async () => [],
    exec: async () => ({ success: true, meta: {} }),
    prepare: () => statement,
  };
}

describe("auth.repository.reads.v1", () => {
  it("loads membership by tenant and user", async () => {
    const reads = createAuthRepositoryReadsV1(
      createMockDb({
        row: {
          id: "10000000-0000-4000-8000-000000000011",
          tenant_id: "10000000-0000-4000-8000-000000000001",
          user_id: "10000000-0000-4000-8000-000000000002",
          role: "Admin",
          created_at: "2026-02-24T10:00:00.000Z",
          updated_at: "2026-02-24T10:00:00.000Z",
        },
      }),
    );

    const result = await reads.getMembershipByTenantAndUser({
      tenantId: "10000000-0000-4000-8000-000000000001",
      userId: "10000000-0000-4000-8000-000000000002",
    });

    expect(result).toEqual({
      ok: true,
      membership: {
        id: "10000000-0000-4000-8000-000000000011",
        tenantId: "10000000-0000-4000-8000-000000000001",
        userId: "10000000-0000-4000-8000-000000000002",
        role: "Admin",
        createdAt: "2026-02-24T10:00:00.000Z",
        updatedAt: "2026-02-24T10:00:00.000Z",
      },
    });
  });

  it("loads active token lookup context", async () => {
    const reads = createAuthRepositoryReadsV1(
      createMockDb({
        row: {
          token_id: "10000000-0000-4000-8000-000000000021",
          token_tenant_id: "10000000-0000-4000-8000-000000000001",
          token_invite_id: "10000000-0000-4000-8000-000000000022",
          token_email_normalized: "invitee@example.com",
          token_token_hash: "hash-token-1",
          token_status: "active",
          token_issued_at: "2026-02-24T10:00:00.000Z",
          token_expires_at: "2026-02-24T10:15:00.000Z",
          token_consumed_at: null,
          token_consumed_by_user_id: null,
          token_revoked_at: null,
          invite_id: "10000000-0000-4000-8000-000000000022",
          invite_email_normalized: "invitee@example.com",
          invite_role: "Editor",
          invite_status: "pending",
          invite_invited_by_user_id: "10000000-0000-4000-8000-000000000003",
          invite_created_at: "2026-02-24T10:00:00.000Z",
          invite_expires_at: "2026-03-03T10:00:00.000Z",
          invite_accepted_at: null,
          invite_accepted_by_user_id: null,
          invite_revoked_at: null,
          user_id: null,
          user_email_normalized: null,
          user_created_at: null,
          membership_id: null,
          membership_role: null,
          membership_created_at: null,
          membership_updated_at: null,
        },
      }),
    );

    const result = await reads.findActiveTokenByHash({
      tenantId: "10000000-0000-4000-8000-000000000001",
      tokenHash: "hash-token-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokenLookup?.token.id).toBe(
        "10000000-0000-4000-8000-000000000021",
      );
      expect(result.tokenLookup?.invite.id).toBe(
        "10000000-0000-4000-8000-000000000022",
      );
    }
  });

  it("loads active session by hash", async () => {
    const reads = createAuthRepositoryReadsV1(
      createMockDb({
        row: {
          session_id: "10000000-0000-4000-8000-000000000023",
          session_created_at: "2026-02-24T10:00:00.000Z",
          session_expires_at: "2026-02-24T11:00:00.000Z",
          session_revoked_at: null,
          session_last_seen_at: null,
          tenant_id: "10000000-0000-4000-8000-000000000001",
          user_id: "10000000-0000-4000-8000-000000000002",
          user_email_normalized: "invitee@example.com",
          membership_role: "Editor",
        },
      }),
    );

    const result = await reads.findActiveSessionByHash({
      tenantId: "10000000-0000-4000-8000-000000000001",
      tokenHash: "hash-token-1",
      nowIsoUtc: "2026-02-24T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionLookup?.session.id).toBe(
        "10000000-0000-4000-8000-000000000023",
      );
    }
  });

  it("returns persistence failure when read throws", async () => {
    const reads = createAuthRepositoryReadsV1(
      createMockDb({ error: new Error("boom") }),
    );

    const result = await reads.findActiveSessionByHashAnyTenant({
      tokenHash: "hash-token-1",
      nowIsoUtc: "2026-02-24T10:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Persistence operation failed.",
    });
  });
});
