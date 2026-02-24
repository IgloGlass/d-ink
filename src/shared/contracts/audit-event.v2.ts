import { z } from "zod";

import { EventTypeSchema, IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

const AuditEnvelopeDataSchema = z.record(z.string(), z.unknown());

/**
 * V2 actor categories for audit events.
 */
export const AuditActorTypeV2Schema = z.enum(["user", "system"]);

/**
 * Inferred TypeScript type for V2 audit actor categories.
 */
export type AuditActorTypeV2 = z.infer<typeof AuditActorTypeV2Schema>;

/**
 * V2 target identifier contract.
 *
 * Unlike V1, target IDs are opaque non-empty strings so contracts can handle
 * non-UUID entities (for example field-level identifiers).
 */
export const AuditTargetIdV2Schema = z.string().trim().min(1);

/**
 * V2 audit event contract.
 *
 * Invariants:
 * - strict top-level payload
 * - user actor requires `actorUserId`
 * - system actor forbids `actorUserId`
 * - `targetId` accepts any non-empty identifier string
 */
export const AuditEventV2Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    actorType: AuditActorTypeV2Schema,
    actorUserId: UuidV4Schema.optional(),
    eventType: EventTypeSchema,
    targetType: z.string().min(1, "targetType cannot be empty."),
    targetId: AuditTargetIdV2Schema,
    before: AuditEnvelopeDataSchema.optional(),
    after: AuditEnvelopeDataSchema.optional(),
    policyRunId: UuidV4Schema.optional(),
    modelRunId: UuidV4Schema.optional(),
    timestamp: IsoDateTimeSchema,
    context: AuditEnvelopeDataSchema,
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.actorType === "user" && !event.actorUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actorUserId is required when actorType is 'user'.",
        path: ["actorUserId"],
      });
    }

    if (event.actorType === "system" && event.actorUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actorUserId must be omitted when actorType is 'system'.",
        path: ["actorUserId"],
      });
    }
  });

/**
 * Inferred TypeScript type for validated V2 audit events.
 */
export type AuditEventV2 = z.infer<typeof AuditEventV2Schema>;

/**
 * Parses and validates unknown input into an `AuditEventV2`.
 */
export function parseAuditEventV2(input: unknown): AuditEventV2 {
  return AuditEventV2Schema.parse(input);
}

/**
 * Safely validates unknown input into an `AuditEventV2`.
 */
export function safeParseAuditEventV2(
  input: unknown,
): z.SafeParseReturnType<unknown, AuditEventV2> {
  return AuditEventV2Schema.safeParse(input);
}
