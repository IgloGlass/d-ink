import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import {
  type AuthRepositoryV1,
  createD1AuthRepositoryV1,
} from "../../../src/db/repositories/auth.repository.v1";
import {
  type AuthMagicLinkDepsV1,
  authenticateSessionV1,
  consumeMagicLinkTokenV1,
  createMagicLinkInviteV1,
  hashTokenWithHmacV1,
  logoutSessionV1,
} from "../../../src/server/workflow/auth-magic-link.v1";
import { applyWorkspaceAuditSchemaForTests } from "../../db/test-schema";

const TENANT_ID = "30000000-0000-4000-8000-000000000001";
const ADMIN_USER_ID = "30000000-0000-4000-8000-000000000002";
const EDITOR_USER_ID = "30000000-0000-4000-8000-000000000003";
const INVITEE_EMAIL = "invitee@example.com";
const HMAC_SECRET = "test-auth-token-secret";
const AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1 = TENANT_ID;

function buildDepsForTest(input: {
  authRepository?: AuthRepositoryV1;
  ids: string[];
  timestamps: string[];
  tokens: string[];
}): AuthMagicLinkDepsV1 {
  let idIndex = 0;
  let tokenIndex = 0;
  let timestampIndex = 0;

  return {
    authRepository: input.authRepository ?? createD1AuthRepositoryV1(env.DB),
    generateId: () => {
      const value = input.ids[idIndex];
      idIndex += 1;
      if (!value) {
        throw new Error("No remaining deterministic IDs for test.");
      }

      return value;
    },
    generateToken: () => {
      const value = input.tokens[tokenIndex];
      tokenIndex += 1;
      if (!value) {
        throw new Error("No remaining deterministic tokens for test.");
      }

      return value;
    },
    nowIsoUtc: () => {
      const value = input.timestamps[timestampIndex];
      timestampIndex += 1;
      if (!value) {
        throw new Error("No remaining deterministic timestamps for test.");
      }

      return value;
    },
    hmacSecret: HMAC_SECRET,
  };
}

async function seedUserMembership(input: {
  emailNormalized: string;
  role: "Admin" | "Editor";
  tenantId: string;
  userId: string;
}): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3)
    `,
  )
    .bind(input.userId, input.emailNormalized, "2026-02-24T09:00:00.000Z")
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
      crypto.randomUUID(),
      input.tenantId,
      input.userId,
      input.role,
      "2026-02-24T09:00:00.000Z",
      "2026-02-24T09:00:00.000Z",
    )
    .run();
}

async function seedSessionForToken(input: {
  emailNormalized: string;
  expiresAt: string;
  role: "Admin" | "Editor";
  sessionId: string;
  sessionToken: string;
  tenantId: string;
  userId: string;
}): Promise<void> {
  await seedUserMembership({
    tenantId: input.tenantId,
    userId: input.userId,
    emailNormalized: input.emailNormalized,
    role: input.role,
  });

  const tokenHash = await hashTokenWithHmacV1(HMAC_SECRET, input.sessionToken);
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
      tokenHash,
      "2026-02-24T10:30:00.000Z",
      input.expiresAt,
    )
    .run();
}

function createFailingRepositoryV1(message: string): AuthRepositoryV1 {
  return {
    async getMembershipByTenantAndUser() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
    async createInviteAndIssueTokenWithAuditAtomic() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
    async findActiveTokenByHash() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
    async consumeTokenAndCreateSessionWithAuditAtomic() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
    async findActiveSessionByHash() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
    async findActiveSessionByHashAnyTenant() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
    async revokeSessionWithAuditAtomic() {
      return { ok: false, code: "PERSISTENCE_ERROR", message } as const;
    },
  };
}

describe("auth magic-link workflow service", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("allows Admin to create invite and blocks Editor with ROLE_FORBIDDEN", async () => {
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
    });
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: EDITOR_USER_ID,
      emailNormalized: "editor@example.com",
      role: "Editor",
    });

    const adminDeps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000011",
        "30000000-0000-4000-8000-000000000012",
        "30000000-0000-4000-8000-000000000013",
        "30000000-0000-4000-8000-000000000014",
      ],
      tokens: ["magic-token-admin"],
      timestamps: [
        "2026-02-24T10:00:00.000Z",
        "2026-02-24T10:00:01.000Z",
        "2026-02-24T10:00:02.000Z",
      ],
    });

    const adminResult = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Editor",
        actorUserId: ADMIN_USER_ID,
      },
      adminDeps,
    );

    expect(adminResult.ok).toBe(true);

    const editorDeps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000021",
        "30000000-0000-4000-8000-000000000022",
        "30000000-0000-4000-8000-000000000023",
        "30000000-0000-4000-8000-000000000024",
      ],
      tokens: ["magic-token-editor"],
      timestamps: [
        "2026-02-24T10:01:00.000Z",
        "2026-02-24T10:01:01.000Z",
        "2026-02-24T10:01:02.000Z",
      ],
    });

    const editorResult = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Editor",
        actorUserId: EDITOR_USER_ID,
      },
      editorDeps,
    );

    expect(editorResult.ok).toBe(false);
    if (!editorResult.ok) {
      expect(editorResult.error.code).toBe("ROLE_FORBIDDEN");
    }
  });

  it("returns raw invite token once and stores only hashed token in DB", async () => {
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
    });

    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000031",
        "30000000-0000-4000-8000-000000000032",
        "30000000-0000-4000-8000-000000000033",
        "30000000-0000-4000-8000-000000000034",
      ],
      tokens: ["magic-token-raw-value"],
      timestamps: [
        "2026-02-24T10:02:00.000Z",
        "2026-02-24T10:02:01.000Z",
        "2026-02-24T10:02:02.000Z",
      ],
    });

    const result = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Editor",
        actorUserId: ADMIN_USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.magicLinkToken).toBe("magic-token-raw-value");

    const tokenRow = await env.DB.prepare(
      `
        SELECT token_hash
        FROM auth_magic_link_tokens
        WHERE invite_id = ?1
      `,
    )
      .bind(result.invite.id)
      .first<{ token_hash: string }>();
    const expectedHash = await hashTokenWithHmacV1(
      HMAC_SECRET,
      result.magicLinkToken,
    );
    const auditRow = await env.DB.prepare(
      `
        SELECT workspace_id
        FROM audit_events
        WHERE event_type = 'auth.invite_created'
          AND target_id = ?1
      `,
    )
      .bind(result.invite.id)
      .first<{ workspace_id: string }>();

    expect(tokenRow?.token_hash).toBe(expectedHash);
    expect(tokenRow?.token_hash).not.toBe(result.magicLinkToken);
    expect(auditRow?.workspace_id).toBe(AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1);
  });

  it("consumes valid token, updates role on redemption, and blocks token reuse", async () => {
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
    });
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: "30000000-0000-4000-8000-000000000041",
      emailNormalized: INVITEE_EMAIL,
      role: "Editor",
    });

    const createDeps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000042",
        "30000000-0000-4000-8000-000000000043",
        "30000000-0000-4000-8000-000000000044",
        "30000000-0000-4000-8000-000000000045",
      ],
      tokens: ["magic-token-consume"],
      timestamps: [
        "2026-02-24T10:03:00.000Z",
        "2026-02-24T10:03:01.000Z",
        "2026-02-24T10:03:02.000Z",
      ],
    });

    const createResult = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Admin",
        actorUserId: ADMIN_USER_ID,
      },
      createDeps,
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const consumeDeps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000046",
        "30000000-0000-4000-8000-000000000047",
        "30000000-0000-4000-8000-000000000048",
      ],
      tokens: ["session-token-consume"],
      timestamps: [
        "2026-02-24T10:05:00.000Z",
        "2026-02-24T10:05:01.000Z",
        "2026-02-24T10:05:02.000Z",
        "2026-02-24T10:05:03.000Z",
      ],
    });

    const consumeResult = await consumeMagicLinkTokenV1(
      {
        tenantId: TENANT_ID,
        magicLinkToken: createResult.magicLinkToken,
      },
      consumeDeps,
    );

    expect(consumeResult.ok).toBe(true);
    if (!consumeResult.ok) {
      return;
    }

    expect(consumeResult.principal.role).toBe("Admin");
    expect(consumeResult.sessionToken).toBe("session-token-consume");

    const membershipRow = await env.DB.prepare(
      `
        SELECT role
        FROM tenant_memberships
        WHERE tenant_id = ?1
          AND user_id = ?2
      `,
    )
      .bind(TENANT_ID, "30000000-0000-4000-8000-000000000041")
      .first<{ role: string }>();

    expect(membershipRow?.role).toBe("Admin");

    const reuseResult = await consumeMagicLinkTokenV1(
      {
        tenantId: TENANT_ID,
        magicLinkToken: createResult.magicLinkToken,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:06:00.000Z"],
      }),
    );

    expect(reuseResult.ok).toBe(false);
    if (!reuseResult.ok) {
      expect(reuseResult.error.code).toBe("TOKEN_INVALID_OR_EXPIRED");
    }
  });

  it("fails consume when token is expired", async () => {
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
    });

    const createDeps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000051",
        "30000000-0000-4000-8000-000000000052",
        "30000000-0000-4000-8000-000000000053",
        "30000000-0000-4000-8000-000000000054",
      ],
      tokens: ["magic-token-expired"],
      timestamps: [
        "2026-02-24T10:00:00.000Z",
        "2026-02-24T10:00:01.000Z",
        "2026-02-24T10:00:02.000Z",
      ],
    });

    const createResult = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Editor",
        actorUserId: ADMIN_USER_ID,
      },
      createDeps,
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const consumeResult = await consumeMagicLinkTokenV1(
      {
        tenantId: TENANT_ID,
        magicLinkToken: createResult.magicLinkToken,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:20:00.000Z"],
      }),
    );

    expect(consumeResult.ok).toBe(false);
    if (!consumeResult.ok) {
      expect(consumeResult.error.code).toBe("TOKEN_INVALID_OR_EXPIRED");
    }
  });

  it("authenticates valid session and rejects expired/revoked/invalid sessions", async () => {
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
    });

    const createResult = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Editor",
        actorUserId: ADMIN_USER_ID,
      },
      buildDepsForTest({
        ids: [
          "30000000-0000-4000-8000-000000000061",
          "30000000-0000-4000-8000-000000000062",
          "30000000-0000-4000-8000-000000000063",
          "30000000-0000-4000-8000-000000000064",
        ],
        tokens: ["magic-token-auth"],
        timestamps: [
          "2026-02-24T10:10:00.000Z",
          "2026-02-24T10:10:01.000Z",
          "2026-02-24T10:10:02.000Z",
        ],
      }),
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const consumeResult = await consumeMagicLinkTokenV1(
      {
        tenantId: TENANT_ID,
        magicLinkToken: createResult.magicLinkToken,
      },
      buildDepsForTest({
        ids: [
          "30000000-0000-4000-8000-000000000065",
          "30000000-0000-4000-8000-000000000066",
          "30000000-0000-4000-8000-000000000067",
          "30000000-0000-4000-8000-000000000068",
          "30000000-0000-4000-8000-000000000069",
        ],
        tokens: ["session-token-auth"],
        timestamps: [
          "2026-02-24T10:11:00.000Z",
          "2026-02-24T10:11:01.000Z",
          "2026-02-24T10:11:02.000Z",
          "2026-02-24T10:11:03.000Z",
        ],
      }),
    );
    expect(consumeResult.ok).toBe(true);
    if (!consumeResult.ok) {
      return;
    }

    const authResult = await authenticateSessionV1(
      {
        tenantId: TENANT_ID,
        sessionToken: consumeResult.sessionToken,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:11:30.000Z"],
      }),
    );

    expect(authResult.ok).toBe(true);
    if (authResult.ok) {
      expect(authResult.principal.tenantId).toBe(TENANT_ID);
    }

    await env.DB.prepare(
      `
        UPDATE auth_sessions
        SET expires_at = ?1
        WHERE id = ?2
      `,
    )
      .bind("2026-02-24T10:11:00.000Z", consumeResult.session.id)
      .run();

    const expiredResult = await authenticateSessionV1(
      {
        tenantId: TENANT_ID,
        sessionToken: consumeResult.sessionToken,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:11:31.000Z"],
      }),
    );

    expect(expiredResult.ok).toBe(false);
    if (!expiredResult.ok) {
      expect(expiredResult.error.code).toBe("SESSION_INVALID_OR_EXPIRED");
    }

    await env.DB.prepare(
      `
        UPDATE auth_sessions
        SET expires_at = ?1, revoked_at = ?2
        WHERE id = ?3
      `,
    )
      .bind(
        "2026-02-25T10:11:00.000Z",
        "2026-02-24T10:11:32.000Z",
        consumeResult.session.id,
      )
      .run();

    const revokedResult = await authenticateSessionV1(
      {
        tenantId: TENANT_ID,
        sessionToken: consumeResult.sessionToken,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:11:33.000Z"],
      }),
    );

    expect(revokedResult.ok).toBe(false);
    if (!revokedResult.ok) {
      expect(revokedResult.error.code).toBe("SESSION_INVALID_OR_EXPIRED");
    }

    const invalidTokenResult = await authenticateSessionV1(
      {
        tenantId: TENANT_ID,
        sessionToken: "not-a-session-token",
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:11:34.000Z"],
      }),
    );

    expect(invalidTokenResult.ok).toBe(false);
    if (!invalidTokenResult.ok) {
      expect(invalidTokenResult.error.code).toBe("SESSION_INVALID_OR_EXPIRED");
    }
  });

  it("revokes active session token and appends auth.session_revoked audit", async () => {
    const sessionToken = "logout-session-token-1";
    const sessionId = "30000000-0000-4000-8000-000000000081";
    const userId = "30000000-0000-4000-8000-000000000082";

    await seedSessionForToken({
      tenantId: TENANT_ID,
      userId,
      emailNormalized: "logout-1@example.com",
      role: "Admin",
      sessionToken,
      sessionId,
      expiresAt: "2026-02-25T10:30:00.000Z",
    });

    const logoutResult = await logoutSessionV1(
      {
        sessionToken,
      },
      buildDepsForTest({
        ids: ["30000000-0000-4000-8000-000000000083"],
        tokens: [],
        timestamps: ["2026-02-24T10:31:00.000Z"],
      }),
    );

    expect(logoutResult.ok).toBe(true);

    const sessionRow = await env.DB.prepare(
      `
        SELECT revoked_at
        FROM auth_sessions
        WHERE id = ?1
      `,
    )
      .bind(sessionId)
      .first<{ revoked_at: string | null }>();

    const auditCountRow = await env.DB.prepare(
      `
        SELECT COUNT(*) AS count
        FROM audit_events
        WHERE event_type = 'auth.session_revoked'
          AND target_id = ?1
      `,
    )
      .bind(sessionId)
      .first<{ count: number }>();

    expect(sessionRow?.revoked_at).toBe("2026-02-24T10:31:00.000Z");
    expect(auditCountRow?.count).toBe(1);
  });

  it("treats revoked/expired/invalid session tokens as logout no-op success", async () => {
    const sessionToken = "logout-session-token-2";
    const sessionId = "30000000-0000-4000-8000-000000000091";

    await seedSessionForToken({
      tenantId: TENANT_ID,
      userId: "30000000-0000-4000-8000-000000000092",
      emailNormalized: "logout-2@example.com",
      role: "Editor",
      sessionToken,
      sessionId,
      expiresAt: "2026-02-24T10:32:00.000Z",
    });

    const firstLogoutResult = await logoutSessionV1(
      {
        sessionToken,
      },
      buildDepsForTest({
        ids: ["30000000-0000-4000-8000-000000000093"],
        tokens: [],
        timestamps: ["2026-02-24T10:31:30.000Z"],
      }),
    );
    expect(firstLogoutResult.ok).toBe(true);

    const secondLogoutResult = await logoutSessionV1(
      {
        sessionToken,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:31:31.000Z"],
      }),
    );
    expect(secondLogoutResult.ok).toBe(true);

    const expiredLogoutResult = await logoutSessionV1(
      {
        sessionToken: "expired-or-missing-token",
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:33:01.000Z"],
      }),
    );
    expect(expiredLogoutResult.ok).toBe(true);
  });

  it("returns INPUT_INVALID for malformed logout payload", async () => {
    const logoutResult = await logoutSessionV1(
      {
        sessionToken: "   ",
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: [],
      }),
    );

    expect(logoutResult.ok).toBe(false);
    if (!logoutResult.ok) {
      expect(logoutResult.error.code).toBe("INPUT_INVALID");
    }
  });

  it("returns PERSISTENCE_ERROR when logout repository path fails", async () => {
    const failingRepository = createFailingRepositoryV1(
      "forced repository failure",
    );

    const logoutResult = await logoutSessionV1(
      {
        sessionToken: "logout-token-for-failure-test",
      },
      buildDepsForTest({
        authRepository: failingRepository,
        ids: [],
        tokens: [],
        timestamps: ["2026-02-24T10:34:00.000Z"],
      }),
    );

    expect(logoutResult.ok).toBe(false);
    if (!logoutResult.ok) {
      expect(logoutResult.error.code).toBe("PERSISTENCE_ERROR");
      expect(logoutResult.error.message).toContain("forced repository failure");
    }
  });

  it("returns INPUT_INVALID for malformed payloads without throwing", async () => {
    const deps = buildDepsForTest({
      ids: [],
      tokens: [],
      timestamps: ["2026-02-24T10:12:00.000Z"],
    });

    await expect(
      createMagicLinkInviteV1(
        {
          tenantId: "invalid-tenant-id",
        },
        deps,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "INPUT_INVALID",
      },
    });
  });

  it("fails closed when nowIsoUtc dependency returns invalid datetime", async () => {
    await seedUserMembership({
      tenantId: TENANT_ID,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
    });

    const result = await createMagicLinkInviteV1(
      {
        tenantId: TENANT_ID,
        inviteeEmail: INVITEE_EMAIL,
        inviteeRole: "Editor",
        actorUserId: ADMIN_USER_ID,
      },
      buildDepsForTest({
        ids: [],
        tokens: [],
        timestamps: ["not-a-date"],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTENCE_ERROR");
    }
  });
});
