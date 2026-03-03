import { z } from "zod";

import {
  AuthSessionV1Schema,
  AuthInviteV1Schema,
  type AuthPrincipalV1,
  AuthPrincipalV1Schema,
  parseLogoutSessionResultV1,
} from "../../../shared/contracts/auth-magic-link.v1";
import { IsoDateTimeSchema } from "../../../shared/contracts/common.v1";
import { ApiClientError, apiRequest } from "./api-client";

export type SessionPrincipalV1 = AuthPrincipalV1;

const CurrentSessionResponseV1Schema = z
  .object({
    ok: z.literal(true),
    principal: AuthPrincipalV1Schema,
  })
  .strict();

const HttpInviteSchemaV1 = AuthInviteV1Schema.extend({
  acceptedAt: IsoDateTimeSchema.nullable().optional(),
  acceptedByUserId: z.string().nullable().optional(),
  revokedAt: IsoDateTimeSchema.nullable().optional(),
});

const CreateInviteResponseV1Schema = z
  .object({
    invite: HttpInviteSchemaV1,
    magicLinkExpiresAt: IsoDateTimeSchema,
    magicLinkUrl: z.string().url(),
    ok: z.literal(true),
  })
  .strict();

const DevSessionResponseV1Schema = z
  .object({
    ok: z.literal(true),
    principal: AuthPrincipalV1Schema,
    session: AuthSessionV1Schema,
  })
  .strict();

export type CurrentSessionResponseV1 = z.infer<
  typeof CurrentSessionResponseV1Schema
>;

export type CreateInviteInputV1 = {
  inviteeEmail: string;
  inviteeRole: "Admin" | "Editor";
  tenantId: string;
};

export type CreateInviteResponseV1 = z.infer<
  typeof CreateInviteResponseV1Schema
>;
export type CreateDevSessionInputV1 = {
  email?: string;
  role?: "Admin" | "Editor";
  tenantId?: string;
};

export type DevSessionResponseV1 = z.infer<typeof DevSessionResponseV1Schema>;

export type LogoutResponseV1 = {
  ok: true;
};

export const currentSessionQueryKeyV1 = ["auth", "session", "current"];

function parseCurrentSessionResponseV1(
  payload: unknown,
): CurrentSessionResponseV1 {
  return CurrentSessionResponseV1Schema.parse(payload);
}

function parseCreateInviteResponseV1(payload: unknown): CreateInviteResponseV1 {
  return CreateInviteResponseV1Schema.parse(payload);
}

function parseLogoutResponseV1(payload: unknown): LogoutResponseV1 {
  const result = parseLogoutSessionResultV1(payload);
  if (!result.ok) {
    throw new ApiClientError({
      status: 200,
      code: result.error.code,
      message: result.error.message,
      userMessage: result.error.user_message,
      context: result.error.context,
    });
  }

  return result;
}

function parseDevSessionResponseV1(payload: unknown): DevSessionResponseV1 {
  return DevSessionResponseV1Schema.parse(payload);
}

export async function fetchCurrentSessionV1(): Promise<CurrentSessionResponseV1> {
  return apiRequest<CurrentSessionResponseV1>({
    path: "/v1/auth/session/current",
    method: "GET",
    parseResponse: parseCurrentSessionResponseV1,
  });
}

export async function createMagicLinkInviteV1(
  input: CreateInviteInputV1,
): Promise<CreateInviteResponseV1> {
  return apiRequest<CreateInviteResponseV1>({
    path: "/v1/auth/magic-link/invites",
    method: "POST",
    body: input,
    parseResponse: parseCreateInviteResponseV1,
  });
}

export async function logoutSessionV1(): Promise<LogoutResponseV1> {
  return apiRequest<LogoutResponseV1>({
    path: "/v1/auth/session/logout",
    method: "POST",
    body: {},
    parseResponse: parseLogoutResponseV1,
  });
}

export async function startDevSessionV1(
  input: CreateDevSessionInputV1 = {},
): Promise<DevSessionResponseV1> {
  return apiRequest<DevSessionResponseV1>({
    path: "/v1/auth/dev-login",
    method: "POST",
    body: input,
    parseResponse: parseDevSessionResponseV1,
  });
}
