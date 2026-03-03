import { describe, expect, it } from "vitest";

import { createAuthRepositoryWritesV1 } from "../../../src/db/repositories/auth.repository.writes.v1";
import { parseAuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";
import {
  AuthInviteV1Schema,
  AuthMagicLinkTokenV1Schema,
} from "../../../src/shared/contracts/auth-magic-link.v1";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "../../../src/shared/types/d1";

function createStatement(): D1PreparedStatement {
  const statement: D1PreparedStatement = {
    all: async () => ({ success: true, meta: {}, results: [] }),
    bind: () => statement,
    first: async () => null,
    run: async () => ({ success: true, meta: {} }),
  };

  return statement;
}

function createDbWithBatch(results: D1Result[]): D1Database {
  return {
    batch: async <T = unknown>() => results as D1Result<T>[],
    exec: async () => ({ success: true, meta: {} }),
    prepare: () => createStatement(),
  };
}

const tenantId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";

function auditEvent(input: {
  id: string;
  targetId: string;
  targetType: string;
  eventType: string;
}) {
  return parseAuditEventV2({
    id: input.id,
    tenantId,
    workspaceId: tenantId,
    actorType: "user",
    actorUserId: userId,
    eventType: input.eventType,
    targetType: input.targetType,
    targetId: input.targetId,
    timestamp: "2026-02-24T10:00:00.000Z",
    context: { source: "unit-test" },
  });
}

describe("auth.repository.writes.v1", () => {
  it("creates invite/token/audit in one atomic batch", async () => {
    const writes = createAuthRepositoryWritesV1({
      db: createDbWithBatch([
        { success: true, meta: {} },
        { success: true, meta: {} },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ]),
      findActiveSessionByHash: async () => ({ ok: true, sessionLookup: null }),
    });

    const invite = AuthInviteV1Schema.parse({
      id: "10000000-0000-4000-8000-000000000022",
      tenantId,
      emailNormalized: "invitee@example.com",
      role: "Editor",
      status: "pending",
      invitedByUserId: userId,
      createdAt: "2026-02-24T10:00:00.000Z",
      expiresAt: "2026-03-03T10:00:00.000Z",
    });
    const token = AuthMagicLinkTokenV1Schema.parse({
      id: "10000000-0000-4000-8000-000000000021",
      tenantId,
      inviteId: "10000000-0000-4000-8000-000000000022",
      emailNormalized: "invitee@example.com",
      tokenHash: "hash-token-1",
      status: "active",
      issuedAt: "2026-02-24T10:00:00.000Z",
      expiresAt: "2026-02-24T10:15:00.000Z",
    });

    const result = await writes.createInviteAndIssueTokenWithAuditAtomic({
      invite,
      token,
      inviteCreatedAuditEvent: auditEvent({
        id: "10000000-0000-4000-8000-000000000031",
        targetId: "10000000-0000-4000-8000-000000000022",
        targetType: "invite",
        eventType: "auth.invite_created",
      }),
      magicLinkIssuedAuditEvent: auditEvent({
        id: "10000000-0000-4000-8000-000000000032",
        targetId: "10000000-0000-4000-8000-000000000021",
        targetType: "magic_link_token",
        eventType: "auth.magic_link_issued",
      }),
      revokedAt: "2026-02-24T10:00:00.000Z",
    });

    expect(result).toEqual({ ok: true, invite, token });
  });

  it("returns token-not-active when consume update set is not applied", async () => {
    const writes = createAuthRepositoryWritesV1({
      db: createDbWithBatch([
        { success: true, meta: {} },
        { success: true, meta: {} },
        { success: true, meta: {} },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: 0 } },
        { success: true, meta: { changes: 0 } },
      ]),
      findActiveSessionByHash: async () => ({ ok: true, sessionLookup: null }),
    });

    const result = await writes.consumeTokenAndCreateSessionWithAuditAtomic({
      consumedAt: "2026-02-24T10:00:00.000Z",
      consumeAuditEvent: auditEvent({
        id: "10000000-0000-4000-8000-000000000033",
        targetId: "10000000-0000-4000-8000-000000000021",
        targetType: "magic_link_token",
        eventType: "auth.magic_link_consumed",
      }),
      emailNormalized: "invitee@example.com",
      inviteId: "10000000-0000-4000-8000-000000000022",
      invitedRole: "Editor",
      membershipId: "10000000-0000-4000-8000-000000000011",
      session: {
        id: "10000000-0000-4000-8000-000000000023",
        tokenHash: "session-hash-token-1",
        createdAt: "2026-02-24T10:00:00.000Z",
        expiresAt: "2026-02-24T11:00:00.000Z",
      },
      sessionCreatedAuditEvent: auditEvent({
        id: "10000000-0000-4000-8000-000000000034",
        targetId: "10000000-0000-4000-8000-000000000023",
        targetType: "session",
        eventType: "auth.session_created",
      }),
      tenantId,
      tokenId: "10000000-0000-4000-8000-000000000021",
      userId: "10000000-0000-4000-8000-000000000002",
    });

    expect(result).toEqual({
      ok: false,
      code: "TOKEN_NOT_ACTIVE",
      message:
        "Magic-link token is not active, is expired, or invite is no longer redeemable.",
    });
  });

  it("revoke session write returns revoked=true when update and audit both apply", async () => {
    const writes = createAuthRepositoryWritesV1({
      db: createDbWithBatch([
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ]),
      findActiveSessionByHash: async () => ({ ok: true, sessionLookup: null }),
    });

    const result = await writes.revokeSessionWithAuditAtomic({
      revokedAt: "2026-02-24T10:00:00.000Z",
      sessionId: "10000000-0000-4000-8000-000000000023",
      tenantId,
      auditEvent: auditEvent({
        id: "10000000-0000-4000-8000-000000000035",
        targetId: "10000000-0000-4000-8000-000000000023",
        targetType: "session",
        eventType: "auth.session_revoked",
      }),
    });

    expect(result).toEqual({ ok: true, revoked: true });
  });
});
