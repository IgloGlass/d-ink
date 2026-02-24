import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1AuthRepositoryV1 } from "../../../src/db/repositories/auth.repository.v1";
import { parseAuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";
import {
  AuthInviteV1Schema,
  AuthMagicLinkTokenV1Schema,
  type AuthRoleV1,
} from "../../../src/shared/contracts/auth-magic-link.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const TENANT_ID_B = "10000000-0000-4000-8000-000000000010";
const ACTOR_USER_ID = "10000000-0000-4000-8000-000000000002";
const EMAIL = "invitee@example.com";

function buildInvite(input: {
  emailNormalized?: string;
  expiresAt?: string;
  id: string;
  invitedByUserId?: string;
  role?: AuthRoleV1;
}): ReturnType<typeof AuthInviteV1Schema.parse> {
  return AuthInviteV1Schema.parse({
    id: input.id,
    tenantId: TENANT_ID,
    emailNormalized: input.emailNormalized ?? EMAIL,
    role: input.role ?? "Editor",
    status: "pending",
    invitedByUserId: input.invitedByUserId ?? ACTOR_USER_ID,
    createdAt: "2026-02-24T10:00:00.000Z",
    expiresAt: input.expiresAt ?? "2026-03-03T10:00:00.000Z",
  });
}

function buildToken(input: {
  emailNormalized?: string;
  expiresAt?: string;
  hash: string;
  id: string;
  inviteId: string;
}): ReturnType<typeof AuthMagicLinkTokenV1Schema.parse> {
  return AuthMagicLinkTokenV1Schema.parse({
    id: input.id,
    tenantId: TENANT_ID,
    inviteId: input.inviteId,
    emailNormalized: input.emailNormalized ?? EMAIL,
    tokenHash: input.hash,
    status: "active",
    issuedAt: "2026-02-24T10:00:00.000Z",
    expiresAt: input.expiresAt ?? "2026-02-24T10:15:00.000Z",
  });
}

function buildAuditEvent(input: {
  actorUserId?: string;
  eventType: string;
  id: string;
  targetId: string;
  targetType: string;
}): ReturnType<typeof parseAuditEventV2> {
  return parseAuditEventV2({
    id: input.id,
    tenantId: TENANT_ID,
    workspaceId: TENANT_ID,
    actorType: "user",
    actorUserId: input.actorUserId ?? ACTOR_USER_ID,
    eventType: input.eventType,
    targetType: input.targetType,
    targetId: input.targetId,
    timestamp: "2026-02-24T10:00:01.000Z",
    context: {
      source: "repository-test",
    },
  });
}

async function countById(table: string, id: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM ${table} WHERE id = ?1`,
  )
    .bind(id)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function seedUserMembershipAndSession(input: {
  createdAt: string;
  emailNormalized: string;
  expiresAt: string;
  membershipId: string;
  role: "Admin" | "Editor";
  sessionId: string;
  tenantId: string;
  tokenHash: string;
  userId: string;
}): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3)
    `,
  )
    .bind(input.userId, input.emailNormalized, input.createdAt)
    .run();

  await env.DB.prepare(
    `
      INSERT INTO tenant_memberships (
        id,
        tenant_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `,
  )
    .bind(
      input.membershipId,
      input.tenantId,
      input.userId,
      input.role,
      input.createdAt,
      input.createdAt,
    )
    .run();

  await env.DB.prepare(
    `
      INSERT INTO auth_sessions (
        id,
        tenant_id,
        user_id,
        token_hash,
        created_at,
        expires_at,
        revoked_at,
        last_seen_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?5)
    `,
  )
    .bind(
      input.sessionId,
      input.tenantId,
      input.userId,
      input.tokenHash,
      input.createdAt,
      input.expiresAt,
    )
    .run();
}

describe("D1 auth repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates invite + token + audit events atomically", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const invite = buildInvite({
      id: "20000000-0000-4000-8000-000000000001",
    });
    const token = buildToken({
      id: "20000000-0000-4000-8000-000000000002",
      inviteId: invite.id,
      hash: "hash-token-1",
    });
    const inviteCreatedAudit = buildAuditEvent({
      id: "20000000-0000-4000-8000-000000000003",
      eventType: "auth.invite_created",
      targetType: "invite",
      targetId: invite.id,
    });
    const magicLinkIssuedAudit = buildAuditEvent({
      id: "20000000-0000-4000-8000-000000000004",
      eventType: "auth.magic_link_issued",
      targetType: "magic_link_token",
      targetId: token.id,
    });

    const result = await repository.createInviteAndIssueTokenWithAuditAtomic({
      invite,
      token,
      inviteCreatedAuditEvent: inviteCreatedAudit,
      magicLinkIssuedAuditEvent: magicLinkIssuedAudit,
      revokedAt: "2026-02-24T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(await countById("auth_invites", invite.id)).toBe(1);
    expect(await countById("auth_magic_link_tokens", token.id)).toBe(1);
    expect(await countById("audit_events", inviteCreatedAudit.id)).toBe(1);
    expect(await countById("audit_events", magicLinkIssuedAudit.id)).toBe(1);
  });

  it("revokes prior active token when issuing a new token for same tenant+email", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);

    const firstInvite = buildInvite({
      id: "20000000-0000-4000-8000-000000000011",
    });
    const firstToken = buildToken({
      id: "20000000-0000-4000-8000-000000000012",
      inviteId: firstInvite.id,
      hash: "hash-token-11",
    });

    await repository.createInviteAndIssueTokenWithAuditAtomic({
      invite: firstInvite,
      token: firstToken,
      inviteCreatedAuditEvent: buildAuditEvent({
        id: "20000000-0000-4000-8000-000000000013",
        eventType: "auth.invite_created",
        targetType: "invite",
        targetId: firstInvite.id,
      }),
      magicLinkIssuedAuditEvent: buildAuditEvent({
        id: "20000000-0000-4000-8000-000000000014",
        eventType: "auth.magic_link_issued",
        targetType: "magic_link_token",
        targetId: firstToken.id,
      }),
      revokedAt: "2026-02-24T10:01:00.000Z",
    });

    const secondInvite = buildInvite({
      id: "20000000-0000-4000-8000-000000000015",
    });
    const secondToken = buildToken({
      id: "20000000-0000-4000-8000-000000000016",
      inviteId: secondInvite.id,
      hash: "hash-token-12",
    });

    const secondResult =
      await repository.createInviteAndIssueTokenWithAuditAtomic({
        invite: secondInvite,
        token: secondToken,
        inviteCreatedAuditEvent: buildAuditEvent({
          id: "20000000-0000-4000-8000-000000000017",
          eventType: "auth.invite_created",
          targetType: "invite",
          targetId: secondInvite.id,
        }),
        magicLinkIssuedAuditEvent: buildAuditEvent({
          id: "20000000-0000-4000-8000-000000000018",
          eventType: "auth.magic_link_issued",
          targetType: "magic_link_token",
          targetId: secondToken.id,
        }),
        revokedAt: "2026-02-24T10:02:00.000Z",
      });

    expect(secondResult.ok).toBe(true);

    const revokedRow = await env.DB.prepare(
      `
        SELECT status, revoked_at
        FROM auth_magic_link_tokens
        WHERE id = ?1
      `,
    )
      .bind(firstToken.id)
      .first<{ revoked_at: string | null; status: string }>();

    const activeRow = await env.DB.prepare(
      `
        SELECT status
        FROM auth_magic_link_tokens
        WHERE id = ?1
      `,
    )
      .bind(secondToken.id)
      .first<{ status: string }>();

    expect(revokedRow?.status).toBe("revoked");
    expect(revokedRow?.revoked_at).toBe("2026-02-24T10:02:00.000Z");
    expect(activeRow?.status).toBe("active");
  });

  it("rolls back invite+token issuance when later audit insert fails", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const duplicateAuditId = "20000000-0000-4000-8000-000000000031";

    await env.DB.prepare(
      `
        INSERT INTO audit_events (
          id,
          tenant_id,
          workspace_id,
          actor_type,
          actor_user_id,
          event_type,
          target_type,
          target_id,
          timestamp,
          context_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `,
    )
      .bind(
        duplicateAuditId,
        TENANT_ID,
        TENANT_ID,
        "user",
        ACTOR_USER_ID,
        "auth.invite_created",
        "invite",
        "placeholder-target",
        "2026-02-24T10:03:00.000Z",
        JSON.stringify({ seed: true }),
      )
      .run();

    const invite = buildInvite({
      id: "20000000-0000-4000-8000-000000000032",
    });
    const token = buildToken({
      id: "20000000-0000-4000-8000-000000000033",
      inviteId: invite.id,
      hash: "hash-token-rollback",
    });

    const result = await repository.createInviteAndIssueTokenWithAuditAtomic({
      invite,
      token,
      inviteCreatedAuditEvent: buildAuditEvent({
        id: duplicateAuditId,
        eventType: "auth.invite_created",
        targetType: "invite",
        targetId: invite.id,
      }),
      magicLinkIssuedAuditEvent: buildAuditEvent({
        id: "20000000-0000-4000-8000-000000000034",
        eventType: "auth.magic_link_issued",
        targetType: "magic_link_token",
        targetId: token.id,
      }),
      revokedAt: "2026-02-24T10:03:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSISTENCE_ERROR");
    }

    expect(await countById("auth_invites", invite.id)).toBe(0);
    expect(await countById("auth_magic_link_tokens", token.id)).toBe(0);
  });

  it("consumes token atomically with user/membership upsert, session creation, and audits", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const invite = buildInvite({
      id: "20000000-0000-4000-8000-000000000041",
      role: "Admin",
    });
    const token = buildToken({
      id: "20000000-0000-4000-8000-000000000042",
      inviteId: invite.id,
      hash: "hash-token-consume",
      expiresAt: "2026-02-24T12:00:00.000Z",
    });

    await repository.createInviteAndIssueTokenWithAuditAtomic({
      invite,
      token,
      inviteCreatedAuditEvent: buildAuditEvent({
        id: "20000000-0000-4000-8000-000000000043",
        eventType: "auth.invite_created",
        targetType: "invite",
        targetId: invite.id,
      }),
      magicLinkIssuedAuditEvent: buildAuditEvent({
        id: "20000000-0000-4000-8000-000000000044",
        eventType: "auth.magic_link_issued",
        targetType: "magic_link_token",
        targetId: token.id,
      }),
      revokedAt: "2026-02-24T10:04:00.000Z",
    });

    const consumeResult =
      await repository.consumeTokenAndCreateSessionWithAuditAtomic({
        consumedAt: "2026-02-24T10:05:00.000Z",
        tenantId: TENANT_ID,
        tokenId: token.id,
        inviteId: invite.id,
        emailNormalized: EMAIL,
        invitedRole: "Admin",
        userId: "20000000-0000-4000-8000-000000000045",
        membershipId: "20000000-0000-4000-8000-000000000046",
        session: {
          id: "20000000-0000-4000-8000-000000000047",
          tokenHash: "hash-session-consume",
          createdAt: "2026-02-24T10:05:00.000Z",
          expiresAt: "2026-02-25T10:05:00.000Z",
        },
        consumeAuditEvent: buildAuditEvent({
          id: "20000000-0000-4000-8000-000000000048",
          eventType: "auth.magic_link_consumed",
          targetType: "magic_link_token",
          targetId: token.id,
          actorUserId: "20000000-0000-4000-8000-000000000045",
        }),
        sessionCreatedAuditEvent: buildAuditEvent({
          id: "20000000-0000-4000-8000-000000000049",
          eventType: "auth.session_created",
          targetType: "session",
          targetId: "20000000-0000-4000-8000-000000000047",
          actorUserId: "20000000-0000-4000-8000-000000000045",
        }),
      });

    expect(consumeResult.ok).toBe(true);
    if (!consumeResult.ok) {
      return;
    }

    expect(consumeResult.principal.role).toBe("Admin");
    expect(consumeResult.session.id).toBe(
      "20000000-0000-4000-8000-000000000047",
    );

    const tokenRow = await env.DB.prepare(
      `
        SELECT status, consumed_at
        FROM auth_magic_link_tokens
        WHERE id = ?1
      `,
    )
      .bind(token.id)
      .first<{ consumed_at: string | null; status: string }>();
    const inviteRow = await env.DB.prepare(
      `
        SELECT status, accepted_at
        FROM auth_invites
        WHERE id = ?1
      `,
    )
      .bind(invite.id)
      .first<{ accepted_at: string | null; status: string }>();

    expect(tokenRow?.status).toBe("consumed");
    expect(tokenRow?.consumed_at).toBe("2026-02-24T10:05:00.000Z");
    expect(inviteRow?.status).toBe("accepted");
    expect(inviteRow?.accepted_at).toBe("2026-02-24T10:05:00.000Z");
    expect(
      await countById("auth_sessions", "20000000-0000-4000-8000-000000000047"),
    ).toBe(1);
    expect(
      await countById("audit_events", "20000000-0000-4000-8000-000000000048"),
    ).toBe(1);
    expect(
      await countById("audit_events", "20000000-0000-4000-8000-000000000049"),
    ).toBe(1);
  });

  it("does not create session or membership on stale/invalid token consume", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);

    const consumeResult =
      await repository.consumeTokenAndCreateSessionWithAuditAtomic({
        consumedAt: "2026-02-24T10:06:00.000Z",
        tenantId: TENANT_ID,
        tokenId: "20000000-0000-4000-8000-000000000061",
        inviteId: "20000000-0000-4000-8000-000000000062",
        emailNormalized: EMAIL,
        invitedRole: "Editor",
        userId: "20000000-0000-4000-8000-000000000063",
        membershipId: "20000000-0000-4000-8000-000000000064",
        session: {
          id: "20000000-0000-4000-8000-000000000065",
          tokenHash: "hash-session-stale",
          createdAt: "2026-02-24T10:06:00.000Z",
          expiresAt: "2026-02-25T10:06:00.000Z",
        },
        consumeAuditEvent: buildAuditEvent({
          id: "20000000-0000-4000-8000-000000000066",
          eventType: "auth.magic_link_consumed",
          targetType: "magic_link_token",
          targetId: "20000000-0000-4000-8000-000000000061",
          actorUserId: "20000000-0000-4000-8000-000000000063",
        }),
        sessionCreatedAuditEvent: buildAuditEvent({
          id: "20000000-0000-4000-8000-000000000067",
          eventType: "auth.session_created",
          targetType: "session",
          targetId: "20000000-0000-4000-8000-000000000065",
          actorUserId: "20000000-0000-4000-8000-000000000063",
        }),
      });

    expect(consumeResult.ok).toBe(false);
    if (!consumeResult.ok) {
      expect(consumeResult.code).toBe("TOKEN_NOT_ACTIVE");
    }

    const sessionCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM auth_sessions",
    ).first<{ count: number }>();
    const membershipCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM tenant_memberships",
    ).first<{ count: number }>();
    const userCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users",
    ).first<{ count: number }>();

    expect(sessionCount?.count).toBe(0);
    expect(membershipCount?.count).toBe(0);
    expect(userCount?.count).toBe(0);
  });

  it("finds only active non-expired and non-revoked sessions by hash", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const userId = "20000000-0000-4000-8000-000000000071";

    await env.DB.prepare(
      `
        INSERT INTO users (id, email_normalized, created_at)
        VALUES (?1, ?2, ?3)
      `,
    )
      .bind(userId, EMAIL, "2026-02-24T10:07:00.000Z")
      .run();
    await env.DB.prepare(
      `
        INSERT INTO tenant_memberships (
          id,
          tenant_id,
          user_id,
          role,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `,
    )
      .bind(
        "20000000-0000-4000-8000-000000000072",
        TENANT_ID,
        userId,
        "Editor",
        "2026-02-24T10:07:00.000Z",
        "2026-02-24T10:07:00.000Z",
      )
      .run();
    await env.DB.prepare(
      `
        INSERT INTO auth_sessions (
          id,
          tenant_id,
          user_id,
          token_hash,
          created_at,
          expires_at,
          revoked_at,
          last_seen_at
        )
        VALUES
          (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?5),
          (?7, ?2, ?3, ?8, ?5, ?9, NULL, ?5),
          (?10, ?2, ?3, ?11, ?5, ?6, ?12, ?5)
      `,
    )
      .bind(
        "20000000-0000-4000-8000-000000000073",
        TENANT_ID,
        userId,
        "hash-active-session",
        "2026-02-24T10:07:00.000Z",
        "2026-02-25T10:07:00.000Z",
        "20000000-0000-4000-8000-000000000074",
        "hash-expired-session",
        "2026-02-24T10:06:59.000Z",
        "20000000-0000-4000-8000-000000000075",
        "hash-revoked-session",
        "2026-02-24T10:07:30.000Z",
      )
      .run();

    const activeResult = await repository.findActiveSessionByHash({
      tenantId: TENANT_ID,
      tokenHash: "hash-active-session",
      nowIsoUtc: "2026-02-24T10:07:00.000Z",
    });
    const expiredResult = await repository.findActiveSessionByHash({
      tenantId: TENANT_ID,
      tokenHash: "hash-expired-session",
      nowIsoUtc: "2026-02-24T10:07:00.000Z",
    });
    const revokedResult = await repository.findActiveSessionByHash({
      tenantId: TENANT_ID,
      tokenHash: "hash-revoked-session",
      nowIsoUtc: "2026-02-24T10:07:00.000Z",
    });

    expect(activeResult.ok).toBe(true);
    if (activeResult.ok) {
      expect(activeResult.sessionLookup?.principal.emailNormalized).toBe(EMAIL);
    }

    expect(expiredResult.ok).toBe(true);
    if (expiredResult.ok) {
      expect(expiredResult.sessionLookup).toBeNull();
    }

    expect(revokedResult.ok).toBe(true);
    if (revokedResult.ok) {
      expect(revokedResult.sessionLookup).toBeNull();
    }
  });

  it("finds active session by hash across tenants", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);

    await seedUserMembershipAndSession({
      tenantId: TENANT_ID,
      userId: "20000000-0000-4000-8000-000000000091",
      emailNormalized: "tenant-a-user@example.com",
      role: "Editor",
      membershipId: "20000000-0000-4000-8000-000000000092",
      sessionId: "20000000-0000-4000-8000-000000000093",
      tokenHash: "hash-tenant-a",
      createdAt: "2026-02-24T10:09:00.000Z",
      expiresAt: "2026-02-25T10:09:00.000Z",
    });

    await seedUserMembershipAndSession({
      tenantId: TENANT_ID_B,
      userId: "20000000-0000-4000-8000-000000000094",
      emailNormalized: "tenant-b-user@example.com",
      role: "Admin",
      membershipId: "20000000-0000-4000-8000-000000000095",
      sessionId: "20000000-0000-4000-8000-000000000096",
      tokenHash: "hash-tenant-b",
      createdAt: "2026-02-24T10:09:10.000Z",
      expiresAt: "2026-02-25T10:09:10.000Z",
    });

    const tenantBResult = await repository.findActiveSessionByHashAnyTenant({
      tokenHash: "hash-tenant-b",
      nowIsoUtc: "2026-02-24T10:09:30.000Z",
    });

    expect(tenantBResult.ok).toBe(true);
    if (tenantBResult.ok) {
      expect(tenantBResult.sessionLookup?.principal.tenantId).toBe(TENANT_ID_B);
      expect(tenantBResult.sessionLookup?.principal.role).toBe("Admin");
      expect(tenantBResult.sessionLookup?.session.id).toBe(
        "20000000-0000-4000-8000-000000000096",
      );
    }
  });

  it("revokeSessionWithAuditAtomic revokes active session and appends auth.session_revoked", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const sessionId = "20000000-0000-4000-8000-000000000101";

    await seedUserMembershipAndSession({
      tenantId: TENANT_ID,
      userId: "20000000-0000-4000-8000-000000000102",
      emailNormalized: "logout-user@example.com",
      role: "Editor",
      membershipId: "20000000-0000-4000-8000-000000000103",
      sessionId,
      tokenHash: "hash-revoke-success",
      createdAt: "2026-02-24T10:10:00.000Z",
      expiresAt: "2026-02-25T10:10:00.000Z",
    });

    const auditEvent = buildAuditEvent({
      id: "20000000-0000-4000-8000-000000000104",
      actorUserId: "20000000-0000-4000-8000-000000000102",
      eventType: "auth.session_revoked",
      targetType: "session",
      targetId: sessionId,
    });

    const revokeResult = await repository.revokeSessionWithAuditAtomic({
      tenantId: TENANT_ID,
      sessionId,
      revokedAt: "2026-02-24T10:11:00.000Z",
      auditEvent,
    });

    expect(revokeResult.ok).toBe(true);
    if (!revokeResult.ok) {
      return;
    }

    expect(revokeResult.revoked).toBe(true);

    const sessionRow = await env.DB.prepare(
      `
        SELECT revoked_at
        FROM auth_sessions
        WHERE id = ?1
      `,
    )
      .bind(sessionId)
      .first<{ revoked_at: string | null }>();

    expect(sessionRow?.revoked_at).toBe("2026-02-24T10:11:00.000Z");
    expect(await countById("audit_events", auditEvent.id)).toBe(1);
  });

  it("revokeSessionWithAuditAtomic is idempotent for non-active sessions", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const sessionId = "20000000-0000-4000-8000-000000000111";

    await seedUserMembershipAndSession({
      tenantId: TENANT_ID,
      userId: "20000000-0000-4000-8000-000000000112",
      emailNormalized: "expired-session-user@example.com",
      role: "Editor",
      membershipId: "20000000-0000-4000-8000-000000000113",
      sessionId,
      tokenHash: "hash-revoke-noop",
      createdAt: "2026-02-24T10:12:00.000Z",
      expiresAt: "2026-02-24T10:12:30.000Z",
    });

    const auditEvent = buildAuditEvent({
      id: "20000000-0000-4000-8000-000000000114",
      actorUserId: "20000000-0000-4000-8000-000000000112",
      eventType: "auth.session_revoked",
      targetType: "session",
      targetId: sessionId,
    });

    const revokeResult = await repository.revokeSessionWithAuditAtomic({
      tenantId: TENANT_ID,
      sessionId,
      revokedAt: "2026-02-24T10:13:00.000Z",
      auditEvent,
    });

    expect(revokeResult.ok).toBe(true);
    if (!revokeResult.ok) {
      return;
    }

    expect(revokeResult.revoked).toBe(false);
    expect(await countById("audit_events", auditEvent.id)).toBe(0);
  });

  it("revokeSessionWithAuditAtomic returns structured failure for invalid audit payload", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const sessionId = "20000000-0000-4000-8000-000000000116";

    await seedUserMembershipAndSession({
      tenantId: TENANT_ID,
      userId: "20000000-0000-4000-8000-000000000117",
      emailNormalized: "invalid-audit-user@example.com",
      role: "Editor",
      membershipId: "20000000-0000-4000-8000-000000000118",
      sessionId,
      tokenHash: "hash-invalid-audit",
      createdAt: "2026-02-24T10:13:30.000Z",
      expiresAt: "2026-02-25T10:13:30.000Z",
    });

    const result = await repository.revokeSessionWithAuditAtomic({
      tenantId: TENANT_ID,
      sessionId,
      revokedAt: "2026-02-24T10:14:00.000Z",
      auditEvent: {
        id: "not-a-uuid",
      } as unknown as ReturnType<typeof parseAuditEventV2>,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSISTENCE_ERROR");
    }
  });

  it("rolls back session revoke when conditional audit insert fails", async () => {
    const repository = createD1AuthRepositoryV1(env.DB);
    const sessionId = "20000000-0000-4000-8000-000000000121";
    const duplicateAuditId = "20000000-0000-4000-8000-000000000122";

    await seedUserMembershipAndSession({
      tenantId: TENANT_ID,
      userId: "20000000-0000-4000-8000-000000000123",
      emailNormalized: "rollback-logout-user@example.com",
      role: "Admin",
      membershipId: "20000000-0000-4000-8000-000000000124",
      sessionId,
      tokenHash: "hash-revoke-rollback",
      createdAt: "2026-02-24T10:14:00.000Z",
      expiresAt: "2026-02-25T10:14:00.000Z",
    });

    await env.DB.prepare(
      `
        INSERT INTO audit_events (
          id,
          tenant_id,
          workspace_id,
          actor_type,
          actor_user_id,
          event_type,
          target_type,
          target_id,
          timestamp,
          context_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `,
    )
      .bind(
        duplicateAuditId,
        TENANT_ID,
        TENANT_ID,
        "user",
        "20000000-0000-4000-8000-000000000123",
        "auth.seed",
        "session",
        sessionId,
        "2026-02-24T10:14:30.000Z",
        JSON.stringify({ seed: true }),
      )
      .run();

    const revokeResult = await repository.revokeSessionWithAuditAtomic({
      tenantId: TENANT_ID,
      sessionId,
      revokedAt: "2026-02-24T10:15:00.000Z",
      auditEvent: buildAuditEvent({
        id: duplicateAuditId,
        actorUserId: "20000000-0000-4000-8000-000000000123",
        eventType: "auth.session_revoked",
        targetType: "session",
        targetId: sessionId,
      }),
    });

    expect(revokeResult.ok).toBe(false);
    if (!revokeResult.ok) {
      expect(revokeResult.code).toBe("PERSISTENCE_ERROR");
    }

    const sessionRow = await env.DB.prepare(
      `
        SELECT revoked_at
        FROM auth_sessions
        WHERE id = ?1
      `,
    )
      .bind(sessionId)
      .first<{ revoked_at: string | null }>();

    expect(sessionRow?.revoked_at).toBeNull();
  });

  it("enforces relational integrity for invite tokens and sessions", async () => {
    await expect(
      env.DB.prepare(
        `
          INSERT INTO auth_magic_link_tokens (
            id,
            tenant_id,
            invite_id,
            email_normalized,
            token_hash,
            status,
            issued_at,
            expires_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7)
        `,
      )
        .bind(
          "20000000-0000-4000-8000-000000000081",
          TENANT_ID,
          "20000000-0000-4000-8000-000000000082",
          EMAIL,
          "hash-missing-invite",
          "2026-02-24T10:08:00.000Z",
          "2026-02-24T10:23:00.000Z",
        )
        .run(),
    ).rejects.toBeDefined();

    await expect(
      env.DB.prepare(
        `
          INSERT INTO auth_sessions (
            id,
            tenant_id,
            user_id,
            token_hash,
            created_at,
            expires_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        `,
      )
        .bind(
          "20000000-0000-4000-8000-000000000083",
          TENANT_ID,
          "20000000-0000-4000-8000-000000000084",
          "hash-missing-user",
          "2026-02-24T10:08:00.000Z",
          "2026-02-25T10:08:00.000Z",
        )
        .run(),
    ).rejects.toBeDefined();
  });
});
