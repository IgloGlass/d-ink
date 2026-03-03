import { describe, expect, it } from "vitest";

import {
  type ActiveSessionLookupRow,
  type ActiveTokenLookupRow,
  type MembershipRow,
  mapActiveSessionRow,
  mapMembershipRow,
  mapTokenLookupRow,
} from "../../../src/db/repositories/auth.repository.mappers.v1";

describe("auth.repository.mappers.v1", () => {
  it("maps membership rows into TenantMembershipV1", () => {
    const row: MembershipRow = {
      id: "10000000-0000-4000-8000-000000000011",
      tenant_id: "10000000-0000-4000-8000-000000000001",
      user_id: "10000000-0000-4000-8000-000000000002",
      role: "Editor",
      created_at: "2026-02-24T10:00:00.000Z",
      updated_at: "2026-02-24T10:00:00.000Z",
    };

    expect(mapMembershipRow(row)).toEqual({
      id: "10000000-0000-4000-8000-000000000011",
      tenantId: "10000000-0000-4000-8000-000000000001",
      userId: "10000000-0000-4000-8000-000000000002",
      role: "Editor",
      createdAt: "2026-02-24T10:00:00.000Z",
      updatedAt: "2026-02-24T10:00:00.000Z",
    });
  });

  it("maps token lookup rows with optional user and membership", () => {
    const row: ActiveTokenLookupRow = {
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
      invite_role: "Admin",
      invite_status: "pending",
      invite_invited_by_user_id: "10000000-0000-4000-8000-000000000003",
      invite_created_at: "2026-02-24T10:00:00.000Z",
      invite_expires_at: "2026-03-03T10:00:00.000Z",
      invite_accepted_at: null,
      invite_accepted_by_user_id: null,
      invite_revoked_at: null,
      user_id: "10000000-0000-4000-8000-000000000002",
      user_email_normalized: "invitee@example.com",
      user_created_at: "2026-02-24T10:02:00.000Z",
      membership_id: "10000000-0000-4000-8000-000000000011",
      membership_role: "Admin",
      membership_created_at: "2026-02-24T10:03:00.000Z",
      membership_updated_at: "2026-02-24T10:03:00.000Z",
    };

    const result = mapTokenLookupRow(row);

    expect(result.token.id).toBe("10000000-0000-4000-8000-000000000021");
    expect(result.invite.id).toBe("10000000-0000-4000-8000-000000000022");
    expect(result.user?.id).toBe("10000000-0000-4000-8000-000000000002");
    expect(result.membership?.id).toBe("10000000-0000-4000-8000-000000000011");
  });

  it("maps token lookup rows to null user/membership when identity context is absent", () => {
    const row: ActiveTokenLookupRow = {
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
      invite_role: "Admin",
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
    };

    const result = mapTokenLookupRow(row);

    expect(result.user).toBeNull();
    expect(result.membership).toBeNull();
  });

  it("maps active session rows into principal + session contracts", () => {
    const row: ActiveSessionLookupRow = {
      session_id: "10000000-0000-4000-8000-000000000023",
      session_created_at: "2026-02-24T10:00:00.000Z",
      session_expires_at: "2026-02-24T11:00:00.000Z",
      session_revoked_at: null,
      session_last_seen_at: "2026-02-24T10:30:00.000Z",
      tenant_id: "10000000-0000-4000-8000-000000000001",
      user_id: "10000000-0000-4000-8000-000000000002",
      user_email_normalized: "invitee@example.com",
      membership_role: "Editor",
    };

    const result = mapActiveSessionRow(row);

    expect(result.principal).toEqual({
      tenantId: "10000000-0000-4000-8000-000000000001",
      userId: "10000000-0000-4000-8000-000000000002",
      emailNormalized: "invitee@example.com",
      role: "Editor",
    });
    expect(result.session.id).toBe("10000000-0000-4000-8000-000000000023");
  });
});
