import {
  type AuthInviteV1,
  AuthInviteV1Schema,
  type AuthMagicLinkTokenV1,
  AuthMagicLinkTokenV1Schema,
  type AuthPrincipalV1,
  AuthPrincipalV1Schema,
  type AuthSessionV1,
  AuthSessionV1Schema,
  type AuthUserV1,
  AuthUserV1Schema,
  type TenantMembershipV1,
  TenantMembershipV1Schema,
} from "../../shared/contracts/auth-magic-link.v1";

export type MembershipRow = {
  created_at: string;
  id: string;
  role: "Admin" | "Editor";
  tenant_id: string;
  updated_at: string;
  user_id: string;
};

export type ActiveTokenLookupRow = {
  invite_accepted_at: string | null;
  invite_accepted_by_user_id: string | null;
  invite_created_at: string;
  invite_email_normalized: string;
  invite_expires_at: string;
  invite_id: string;
  invite_invited_by_user_id: string;
  invite_revoked_at: string | null;
  invite_role: "Admin" | "Editor";
  invite_status: "pending" | "accepted" | "revoked" | "expired";
  membership_created_at: string | null;
  membership_id: string | null;
  membership_role: "Admin" | "Editor" | null;
  membership_updated_at: string | null;
  token_consumed_at: string | null;
  token_consumed_by_user_id: string | null;
  token_email_normalized: string;
  token_expires_at: string;
  token_id: string;
  token_invite_id: string;
  token_issued_at: string;
  token_revoked_at: string | null;
  token_status: "active" | "consumed" | "revoked" | "expired";
  token_token_hash: string;
  token_tenant_id: string;
  user_created_at: string | null;
  user_email_normalized: string | null;
  user_id: string | null;
};

export type ActiveSessionLookupRow = {
  membership_role: "Admin" | "Editor";
  session_created_at: string;
  session_expires_at: string;
  session_id: string;
  session_last_seen_at: string | null;
  session_revoked_at: string | null;
  tenant_id: string;
  user_email_normalized: string;
  user_id: string;
};

export type ActiveTokenLookupMappedV1 = {
  invite: AuthInviteV1;
  membership: TenantMembershipV1 | null;
  token: AuthMagicLinkTokenV1;
  user: AuthUserV1 | null;
};

export type ActiveSessionLookupMappedV1 = {
  principal: AuthPrincipalV1;
  session: AuthSessionV1;
};

export function mapMembershipRow(row: MembershipRow): TenantMembershipV1 {
  return TenantMembershipV1Schema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapTokenLookupRow(
  row: ActiveTokenLookupRow,
): ActiveTokenLookupMappedV1 {
  const token = AuthMagicLinkTokenV1Schema.parse({
    id: row.token_id,
    tenantId: row.token_tenant_id,
    inviteId: row.token_invite_id,
    emailNormalized: row.token_email_normalized,
    tokenHash: row.token_token_hash,
    status: row.token_status,
    issuedAt: row.token_issued_at,
    expiresAt: row.token_expires_at,
    consumedAt: row.token_consumed_at ?? undefined,
    consumedByUserId: row.token_consumed_by_user_id ?? undefined,
    revokedAt: row.token_revoked_at ?? undefined,
  });

  const invite = AuthInviteV1Schema.parse({
    id: row.invite_id,
    tenantId: token.tenantId,
    emailNormalized: row.invite_email_normalized,
    role: row.invite_role,
    status: row.invite_status,
    invitedByUserId: row.invite_invited_by_user_id,
    createdAt: row.invite_created_at,
    expiresAt: row.invite_expires_at,
    acceptedAt: row.invite_accepted_at ?? undefined,
    acceptedByUserId: row.invite_accepted_by_user_id ?? undefined,
    revokedAt: row.invite_revoked_at ?? undefined,
  });

  const user =
    row.user_id && row.user_email_normalized && row.user_created_at
      ? AuthUserV1Schema.parse({
          id: row.user_id,
          emailNormalized: row.user_email_normalized,
          createdAt: row.user_created_at,
        })
      : null;

  const membership =
    row.membership_id &&
    row.membership_role &&
    row.membership_created_at &&
    row.membership_updated_at &&
    user
      ? TenantMembershipV1Schema.parse({
          id: row.membership_id,
          tenantId: token.tenantId,
          userId: user.id,
          role: row.membership_role,
          createdAt: row.membership_created_at,
          updatedAt: row.membership_updated_at,
        })
      : null;

  return {
    token,
    invite,
    user,
    membership,
  };
}

export function mapActiveSessionRow(
  row: ActiveSessionLookupRow,
): ActiveSessionLookupMappedV1 {
  const session = AuthSessionV1Schema.parse({
    id: row.session_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    createdAt: row.session_created_at,
    expiresAt: row.session_expires_at,
    revokedAt: row.session_revoked_at ?? undefined,
    lastSeenAt: row.session_last_seen_at ?? undefined,
  });

  const principal = AuthPrincipalV1Schema.parse({
    tenantId: row.tenant_id,
    userId: row.user_id,
    emailNormalized: row.user_email_normalized,
    role: row.membership_role,
  });

  return { principal, session };
}
