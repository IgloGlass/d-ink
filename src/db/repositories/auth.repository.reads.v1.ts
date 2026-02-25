import type { D1Database } from "../../shared/types/d1";
import {
  type ActiveSessionLookupRow,
  type ActiveTokenLookupRow,
  type MembershipRow,
  mapActiveSessionRow,
  mapMembershipRow,
  mapTokenLookupRow,
} from "./auth.repository.mappers.v1";
import {
  SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_BY_HASH_ANY_TENANT_SQL,
  SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_SQL,
  SELECT_ACTIVE_TOKEN_WITH_INVITE_AND_IDENTITY_CONTEXT_SQL,
  SELECT_MEMBERSHIP_BY_TENANT_AND_USER_SQL,
} from "./auth.repository.queries.v1";
import type {
  AuthRepositoryFailureV1,
  AuthRepositoryMembershipLookupResultV1,
  AuthRepositorySessionLookupResultV1,
  AuthRepositoryTokenLookupResultV1,
} from "./auth.repository.v1";

function toErrorMessage(_error: unknown): string {
  return "Persistence operation failed.";
}

function toFailure(message: string): AuthRepositoryFailureV1 {
  return {
    ok: false,
    code: "PERSISTENCE_ERROR",
    message,
  };
}

export function createAuthRepositoryReadsV1(db: D1Database) {
  async function findActiveSessionByHash(input: {
    nowIsoUtc: string;
    tenantId: string;
    tokenHash: string;
  }): Promise<AuthRepositorySessionLookupResultV1> {
    try {
      const row = await db
        .prepare(SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_SQL)
        .bind(input.tenantId, input.tokenHash, input.nowIsoUtc)
        .first<ActiveSessionLookupRow>();

      return {
        ok: true,
        sessionLookup: row ? mapActiveSessionRow(row) : null,
      };
    } catch (error) {
      return toFailure(toErrorMessage(error));
    }
  }

  async function findActiveSessionByHashAnyTenant(input: {
    nowIsoUtc: string;
    tokenHash: string;
  }): Promise<AuthRepositorySessionLookupResultV1> {
    try {
      const row = await db
        .prepare(
          SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_BY_HASH_ANY_TENANT_SQL,
        )
        .bind(input.tokenHash, input.nowIsoUtc)
        .first<ActiveSessionLookupRow>();

      return {
        ok: true,
        sessionLookup: row ? mapActiveSessionRow(row) : null,
      };
    } catch (error) {
      return toFailure(toErrorMessage(error));
    }
  }

  async function getMembershipByTenantAndUser(input: {
    tenantId: string;
    userId: string;
  }): Promise<AuthRepositoryMembershipLookupResultV1> {
    try {
      const membershipRow = await db
        .prepare(SELECT_MEMBERSHIP_BY_TENANT_AND_USER_SQL)
        .bind(input.tenantId, input.userId)
        .first<MembershipRow>();

      return {
        ok: true,
        membership: membershipRow ? mapMembershipRow(membershipRow) : null,
      };
    } catch (error) {
      return toFailure(toErrorMessage(error));
    }
  }

  async function findActiveTokenByHash(input: {
    tenantId: string;
    tokenHash: string;
  }): Promise<AuthRepositoryTokenLookupResultV1> {
    try {
      const row = await db
        .prepare(SELECT_ACTIVE_TOKEN_WITH_INVITE_AND_IDENTITY_CONTEXT_SQL)
        .bind(input.tenantId, input.tokenHash)
        .first<ActiveTokenLookupRow>();

      return {
        ok: true,
        tokenLookup: row ? mapTokenLookupRow(row) : null,
      };
    } catch (error) {
      return toFailure(toErrorMessage(error));
    }
  }

  return {
    findActiveSessionByHash,
    findActiveSessionByHashAnyTenant,
    getMembershipByTenantAndUser,
    findActiveTokenByHash,
  };
}
