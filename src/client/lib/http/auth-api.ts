import { apiRequest } from "./api-client";

export type SessionPrincipalV1 = {
  emailNormalized: string;
  role: "Admin" | "Editor";
  tenantId: string;
  userId: string;
};

export type CurrentSessionResponseV1 = {
  ok: true;
  principal: SessionPrincipalV1;
};

export type CreateInviteInputV1 = {
  inviteeEmail: string;
  inviteeRole: "Admin" | "Editor";
  tenantId: string;
};

export type CreateInviteResponseV1 = {
  invite: {
    acceptedAt: string | null;
    acceptedByUserId: string | null;
    createdAt: string;
    emailNormalized: string;
    expiresAt: string;
    id: string;
    invitedByUserId: string;
    revokedAt: string | null;
    role: "Admin" | "Editor";
    status: "accepted" | "expired" | "pending" | "revoked";
    tenantId: string;
  };
  magicLinkExpiresAt: string;
  magicLinkUrl: string;
  ok: true;
};

export type LogoutResponseV1 = {
  ok: true;
};

export const currentSessionQueryKeyV1 = ["auth", "session", "current"];

export async function fetchCurrentSessionV1(): Promise<CurrentSessionResponseV1> {
  return apiRequest<CurrentSessionResponseV1>({
    path: "/v1/auth/session/current",
    method: "GET",
  });
}

export async function createMagicLinkInviteV1(
  input: CreateInviteInputV1,
): Promise<CreateInviteResponseV1> {
  return apiRequest<CreateInviteResponseV1>({
    path: "/v1/auth/magic-link/invites",
    method: "POST",
    body: input,
  });
}

export async function logoutSessionV1(): Promise<LogoutResponseV1> {
  return apiRequest<LogoutResponseV1>({
    path: "/v1/auth/session/logout",
    method: "POST",
    body: {},
  });
}
