import type {
  AuthPrincipalV1,
  AuthRoleV1,
  CreateMagicLinkInviteHttpResponseV1,
  CurrentSessionResponseV1,
  LogoutSessionSuccessV1,
} from "../../../shared/contracts";
import {
  LogoutSessionSuccessV1Schema,
  safeParseCreateMagicLinkInviteHttpResponseV1,
  safeParseCurrentSessionResponseV1,
} from "../../../shared/contracts";

import { apiRequest } from "./api-client";

export type SessionPrincipalV1 = AuthPrincipalV1;
export type CreateInviteResponseV1 = CreateMagicLinkInviteHttpResponseV1;

export type CreateInviteInputV1 = {
  inviteeEmail: string;
  inviteeRole: AuthRoleV1;
  tenantId: string;
};

export const currentSessionQueryKeyV1 = ["auth", "session", "current"];

export async function fetchCurrentSessionV1(): Promise<CurrentSessionResponseV1> {
  return apiRequest<CurrentSessionResponseV1>({
    path: "/v1/auth/session/current",
    method: "GET",
    safeParseResponse: safeParseCurrentSessionResponseV1,
  });
}

export async function createMagicLinkInviteV1(
  input: CreateInviteInputV1,
): Promise<CreateInviteResponseV1> {
  return apiRequest<CreateInviteResponseV1>({
    path: "/v1/auth/magic-link/invites",
    method: "POST",
    body: input,
    safeParseResponse: safeParseCreateMagicLinkInviteHttpResponseV1,
  });
}

export async function logoutSessionV1(): Promise<LogoutSessionSuccessV1> {
  return apiRequest<LogoutSessionSuccessV1>({
    path: "/v1/auth/session/logout",
    method: "POST",
    body: {},
    safeParseResponse: (payload) =>
      LogoutSessionSuccessV1Schema.safeParse(payload),
  });
}
