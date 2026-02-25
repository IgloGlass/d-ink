import { z } from "zod";

import { IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

/**
 * Canonical V1 auth roles applied to tenant memberships.
 */
export const AuthRoleV1Schema = z.enum(["Admin", "Editor"]);

/**
 * Inferred TypeScript type for V1 auth role values.
 */
export type AuthRoleV1 = z.infer<typeof AuthRoleV1Schema>;

/**
 * Canonical V1 invite states used for invite lifecycle persistence.
 */
export const AuthInviteStatusV1Schema = z.enum([
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

/**
 * Inferred TypeScript type for V1 invite status values.
 */
export type AuthInviteStatusV1 = z.infer<typeof AuthInviteStatusV1Schema>;

/**
 * Canonical V1 magic-link token states used for one-time token lifecycle.
 */
export const MagicLinkTokenStatusV1Schema = z.enum([
  "active",
  "consumed",
  "revoked",
  "expired",
]);

/**
 * Inferred TypeScript type for V1 magic-link token status values.
 */
export type MagicLinkTokenStatusV1 = z.infer<
  typeof MagicLinkTokenStatusV1Schema
>;

/**
 * Stable error codes returned by V1 auth workflow operations.
 */
export const AuthErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "ROLE_FORBIDDEN",
  "MEMBERSHIP_NOT_FOUND",
  "TOKEN_INVALID_OR_EXPIRED",
  "INVITE_NOT_ACTIVE",
  "SESSION_INVALID_OR_EXPIRED",
  "PERSISTENCE_ERROR",
]);

/**
 * Inferred TypeScript type for V1 auth error codes.
 */
export type AuthErrorCodeV1 = z.infer<typeof AuthErrorCodeV1Schema>;

/**
 * Normalizes email values for all V1 auth lookups and persistence keys.
 */
export function normalizeEmailV1(email: string): string {
  return email.trim().toLowerCase();
}

const EmailAddressSchema = z.string().trim().email();

const NormalizedEmailSchema = z
  .string()
  .email()
  .refine((value) => value === normalizeEmailV1(value), {
    message: "Expected normalized email (trimmed lowercase).",
  });

const MAX_AUTH_TOKEN_LENGTH_V1 = 512;

const AuthOpaqueTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_AUTH_TOKEN_LENGTH_V1, "Token exceeds maximum allowed length.");

/**
 * Persisted V1 user entity contract.
 */
export const AuthUserV1Schema = z
  .object({
    id: UuidV4Schema,
    emailNormalized: NormalizedEmailSchema,
    createdAt: IsoDateTimeSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for persisted V1 users.
 */
export type AuthUserV1 = z.infer<typeof AuthUserV1Schema>;

/**
 * Persisted V1 tenant membership entity contract.
 */
export const TenantMembershipV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    userId: UuidV4Schema,
    role: AuthRoleV1Schema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for persisted V1 tenant memberships.
 */
export type TenantMembershipV1 = z.infer<typeof TenantMembershipV1Schema>;

/**
 * Persisted V1 auth invite entity contract.
 */
export const AuthInviteV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    emailNormalized: NormalizedEmailSchema,
    role: AuthRoleV1Schema,
    status: AuthInviteStatusV1Schema,
    invitedByUserId: UuidV4Schema,
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    acceptedAt: IsoDateTimeSchema.optional(),
    acceptedByUserId: UuidV4Schema.optional(),
    revokedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for persisted V1 auth invites.
 */
export type AuthInviteV1 = z.infer<typeof AuthInviteV1Schema>;

/**
 * Persisted V1 magic-link token entity contract.
 */
export const AuthMagicLinkTokenV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    inviteId: UuidV4Schema,
    emailNormalized: NormalizedEmailSchema,
    tokenHash: z.string().min(1),
    status: MagicLinkTokenStatusV1Schema,
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    consumedAt: IsoDateTimeSchema.optional(),
    consumedByUserId: UuidV4Schema.optional(),
    revokedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for persisted V1 magic-link tokens.
 */
export type AuthMagicLinkTokenV1 = z.infer<typeof AuthMagicLinkTokenV1Schema>;

/**
 * Persisted V1 auth session entity contract.
 */
export const AuthSessionV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    userId: UuidV4Schema,
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.optional(),
    lastSeenAt: IsoDateTimeSchema.optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for persisted V1 auth sessions.
 */
export type AuthSessionV1 = z.infer<typeof AuthSessionV1Schema>;

/**
 * Tenant-scoped principal contract returned after auth.
 */
export const AuthPrincipalV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    userId: UuidV4Schema,
    emailNormalized: NormalizedEmailSchema,
    role: AuthRoleV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for authenticated V1 principal payloads.
 */
export type AuthPrincipalV1 = z.infer<typeof AuthPrincipalV1Schema>;


/**
 * HTTP success contract for reading the current authenticated session principal.
 */
export const CurrentSessionResponseV1Schema = z
  .object({
    ok: z.literal(true),
    principal: AuthPrincipalV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for current-session HTTP response payloads.
 */
export type CurrentSessionResponseV1 = z.infer<
  typeof CurrentSessionResponseV1Schema
>;

/**
 * HTTP invite entity contract for transport payloads.
 *
 * Note: nullable lifecycle timestamps reflect JSON serialization from persistence rows.
 */
export const AuthInviteHttpV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    emailNormalized: NormalizedEmailSchema,
    role: AuthRoleV1Schema,
    status: AuthInviteStatusV1Schema,
    invitedByUserId: UuidV4Schema,
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    acceptedAt: IsoDateTimeSchema.nullable(),
    acceptedByUserId: UuidV4Schema.nullable(),
    revokedAt: IsoDateTimeSchema.nullable(),
  })
  .strict();

/**
 * Inferred TypeScript type for invite transport payloads.
 */
export type AuthInviteHttpV1 = z.infer<typeof AuthInviteHttpV1Schema>;

/**
 * HTTP success contract for invite creation route responses.
 *
 * Note: transport uses `magicLinkUrl` so clients never receive raw token material.
 */
export const CreateMagicLinkInviteHttpResponseV1Schema = z
  .object({
    ok: z.literal(true),
    invite: AuthInviteHttpV1Schema,
    magicLinkExpiresAt: IsoDateTimeSchema,
    magicLinkUrl: z.string().url(),
  })
  .strict();

/**
 * Inferred TypeScript type for create-invite HTTP response payloads.
 */
export type CreateMagicLinkInviteHttpResponseV1 = z.infer<
  typeof CreateMagicLinkInviteHttpResponseV1Schema
>;

/**
 * Flexible context payload for structured auth errors.
 */
export const AuthErrorContextV1Schema = z.record(z.string(), z.unknown());

/**
 * Inferred TypeScript type for structured auth error context payloads.
 */
export type AuthErrorContextV1 = z.infer<typeof AuthErrorContextV1Schema>;

/**
 * Structured auth error payload used by all V1 auth service results.
 */
export const AuthErrorV1Schema = z
  .object({
    code: AuthErrorCodeV1Schema,
    message: z.string().min(1),
    user_message: z.string().min(1),
    context: AuthErrorContextV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for structured auth errors.
 */
export type AuthErrorV1 = z.infer<typeof AuthErrorV1Schema>;

/**
 * Shared failed-result contract for V1 auth workflow calls.
 */
export const AuthFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: AuthErrorV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for failed auth workflow results.
 */
export type AuthFailureV1 = z.infer<typeof AuthFailureV1Schema>;

/**
 * Request contract for creating a tenant invite and issuing a magic-link token.
 */
export const CreateMagicLinkInviteRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    inviteeEmail: EmailAddressSchema,
    inviteeRole: AuthRoleV1Schema,
    actorUserId: UuidV4Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for create-invite request payloads.
 */
export type CreateMagicLinkInviteRequestV1 = z.infer<
  typeof CreateMagicLinkInviteRequestV1Schema
>;

/**
 * Success contract for create-invite workflow calls.
 */
export const CreateMagicLinkInviteSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    invite: AuthInviteHttpV1Schema,
    magicLinkToken: AuthOpaqueTokenSchema,
    magicLinkExpiresAt: IsoDateTimeSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful create-invite results.
 */
export type CreateMagicLinkInviteSuccessV1 = z.infer<
  typeof CreateMagicLinkInviteSuccessV1Schema
>;

/**
 * Discriminated result contract for create-invite workflow calls.
 */
export const CreateMagicLinkInviteResultV1Schema = z.discriminatedUnion("ok", [
  CreateMagicLinkInviteSuccessV1Schema,
  AuthFailureV1Schema,
]);

/**
 * Inferred TypeScript type for create-invite workflow results.
 */
export type CreateMagicLinkInviteResultV1 = z.infer<
  typeof CreateMagicLinkInviteResultV1Schema
>;

/**
 * Request contract for consuming a magic-link token into an authenticated session.
 */
export const ConsumeMagicLinkTokenRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    magicLinkToken: AuthOpaqueTokenSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for consume-token request payloads.
 */
export type ConsumeMagicLinkTokenRequestV1 = z.infer<
  typeof ConsumeMagicLinkTokenRequestV1Schema
>;

/**
 * Success contract for consume-token workflow calls.
 */
export const ConsumeMagicLinkTokenSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    principal: AuthPrincipalV1Schema,
    session: AuthSessionV1Schema,
    sessionToken: AuthOpaqueTokenSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful consume-token results.
 */
export type ConsumeMagicLinkTokenSuccessV1 = z.infer<
  typeof ConsumeMagicLinkTokenSuccessV1Schema
>;

/**
 * Discriminated result contract for consume-token workflow calls.
 */
export const ConsumeMagicLinkTokenResultV1Schema = z.discriminatedUnion("ok", [
  ConsumeMagicLinkTokenSuccessV1Schema,
  AuthFailureV1Schema,
]);

/**
 * Inferred TypeScript type for consume-token workflow results.
 */
export type ConsumeMagicLinkTokenResultV1 = z.infer<
  typeof ConsumeMagicLinkTokenResultV1Schema
>;

/**
 * Request contract for authenticating an existing session token.
 */
export const AuthenticateSessionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    sessionToken: AuthOpaqueTokenSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for authenticate-session request payloads.
 */
export type AuthenticateSessionRequestV1 = z.infer<
  typeof AuthenticateSessionRequestV1Schema
>;

/**
 * Success contract for authenticate-session workflow calls.
 */
export const AuthenticateSessionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    principal: AuthPrincipalV1Schema,
    session: AuthSessionV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful authenticate-session results.
 */
export type AuthenticateSessionSuccessV1 = z.infer<
  typeof AuthenticateSessionSuccessV1Schema
>;

/**
 * Discriminated result contract for authenticate-session workflow calls.
 */
export const AuthenticateSessionResultV1Schema = z.discriminatedUnion("ok", [
  AuthenticateSessionSuccessV1Schema,
  AuthFailureV1Schema,
]);

/**
 * Inferred TypeScript type for authenticate-session workflow results.
 */
export type AuthenticateSessionResultV1 = z.infer<
  typeof AuthenticateSessionResultV1Schema
>;

/**
 * Request contract for revoking the current authenticated session token.
 */
export const LogoutSessionRequestV1Schema = z
  .object({
    sessionToken: AuthOpaqueTokenSchema,
  })
  .strict();

/**
 * Inferred TypeScript type for logout-session request payloads.
 */
export type LogoutSessionRequestV1 = z.infer<
  typeof LogoutSessionRequestV1Schema
>;

/**
 * Success contract for logout-session workflow calls.
 */
export const LogoutSessionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

/**
 * Inferred TypeScript type for successful logout-session results.
 */
export type LogoutSessionSuccessV1 = z.infer<
  typeof LogoutSessionSuccessV1Schema
>;

/**
 * Discriminated result contract for logout-session workflow calls.
 */
export const LogoutSessionResultV1Schema = z.discriminatedUnion("ok", [
  LogoutSessionSuccessV1Schema,
  AuthFailureV1Schema,
]);

/**
 * Inferred TypeScript type for logout-session workflow results.
 */
export type LogoutSessionResultV1 = z.infer<typeof LogoutSessionResultV1Schema>;

/**
 * Parses and validates unknown input into a current-session HTTP response payload.
 */
export function parseCurrentSessionResponseV1(
  input: unknown,
): CurrentSessionResponseV1 {
  return CurrentSessionResponseV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a current-session HTTP response payload.
 */
export function safeParseCurrentSessionResponseV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CurrentSessionResponseV1> {
  return CurrentSessionResponseV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a create-invite HTTP response payload.
 */
export function parseCreateMagicLinkInviteHttpResponseV1(
  input: unknown,
): CreateMagicLinkInviteHttpResponseV1 {
  return CreateMagicLinkInviteHttpResponseV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a create-invite HTTP response payload.
 */
export function safeParseCreateMagicLinkInviteHttpResponseV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateMagicLinkInviteHttpResponseV1> {
  return CreateMagicLinkInviteHttpResponseV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a create-invite request payload.
 */
export function parseCreateMagicLinkInviteRequestV1(
  input: unknown,
): CreateMagicLinkInviteRequestV1 {
  return CreateMagicLinkInviteRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a create-invite request payload.
 */
export function safeParseCreateMagicLinkInviteRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateMagicLinkInviteRequestV1> {
  return CreateMagicLinkInviteRequestV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a create-invite result payload.
 */
export function parseCreateMagicLinkInviteResultV1(
  input: unknown,
): CreateMagicLinkInviteResultV1 {
  return CreateMagicLinkInviteResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a create-invite result payload.
 */
export function safeParseCreateMagicLinkInviteResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateMagicLinkInviteResultV1> {
  return CreateMagicLinkInviteResultV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a consume-token request payload.
 */
export function parseConsumeMagicLinkTokenRequestV1(
  input: unknown,
): ConsumeMagicLinkTokenRequestV1 {
  return ConsumeMagicLinkTokenRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a consume-token request payload.
 */
export function safeParseConsumeMagicLinkTokenRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ConsumeMagicLinkTokenRequestV1> {
  return ConsumeMagicLinkTokenRequestV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a consume-token result payload.
 */
export function parseConsumeMagicLinkTokenResultV1(
  input: unknown,
): ConsumeMagicLinkTokenResultV1 {
  return ConsumeMagicLinkTokenResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a consume-token result payload.
 */
export function safeParseConsumeMagicLinkTokenResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ConsumeMagicLinkTokenResultV1> {
  return ConsumeMagicLinkTokenResultV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into an authenticate-session request payload.
 */
export function parseAuthenticateSessionRequestV1(
  input: unknown,
): AuthenticateSessionRequestV1 {
  return AuthenticateSessionRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input into an authenticate-session request payload.
 */
export function safeParseAuthenticateSessionRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, AuthenticateSessionRequestV1> {
  return AuthenticateSessionRequestV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into an authenticate-session result payload.
 */
export function parseAuthenticateSessionResultV1(
  input: unknown,
): AuthenticateSessionResultV1 {
  return AuthenticateSessionResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input into an authenticate-session result payload.
 */
export function safeParseAuthenticateSessionResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, AuthenticateSessionResultV1> {
  return AuthenticateSessionResultV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a logout-session request payload.
 */
export function parseLogoutSessionRequestV1(
  input: unknown,
): LogoutSessionRequestV1 {
  return LogoutSessionRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a logout-session request payload.
 */
export function safeParseLogoutSessionRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, LogoutSessionRequestV1> {
  return LogoutSessionRequestV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a logout-session result payload.
 */
export function parseLogoutSessionResultV1(
  input: unknown,
): LogoutSessionResultV1 {
  return LogoutSessionResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a logout-session result payload.
 */
export function safeParseLogoutSessionResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, LogoutSessionResultV1> {
  return LogoutSessionResultV1Schema.safeParse(input);
}
