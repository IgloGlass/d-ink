import { z } from "zod";

import { EventTypeSchema, IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

const AuditEnvelopeDataSchema = z.record(z.string(), z.unknown());

/**
 * V1 actor categories for audit events.
 */
export const AuditActorTypeV1Schema = z.enum(["user", "system"]);

/**
 * Inferred TypeScript type for V1 audit actor categories.
 */
export type AuditActorTypeV1 = z.infer<typeof AuditActorTypeV1Schema>;

/**
 * V1 audit event contract.
 *
 * Invariants:
 * - strict top-level payload
 * - user actor requires `actorUserId`
 * - system actor forbids `actorUserId`
 * - `targetId` remains UUIDv4 in V1
 */
export const AuditEventV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    actorType: AuditActorTypeV1Schema,
    actorUserId: UuidV4Schema.optional(),
    eventType: EventTypeSchema,
    targetType: z.string().min(1, "targetType cannot be empty."),
    targetId: UuidV4Schema,
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
 * Inferred TypeScript type for validated V1 audit events.
 */
export type AuditEventV1 = z.infer<typeof AuditEventV1Schema>;

/**
 * Parses and validates unknown input into an `AuditEventV1`.
 */
export function parseAuditEventV1(input: unknown): AuditEventV1 {
  return AuditEventV1Schema.parse(input);
}

/**
 * Safely validates unknown input into an `AuditEventV1`.
 */
export function safeParseAuditEventV1(
  input: unknown,
): z.SafeParseReturnType<unknown, AuditEventV1> {
  return AuditEventV1Schema.safeParse(input);
}
