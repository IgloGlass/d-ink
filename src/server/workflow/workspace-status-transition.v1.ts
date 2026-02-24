import {
  type WorkspaceRoleV1,
  WorkspaceRoleV1Schema,
  type WorkspaceTransitionErrorCodeV1,
  type WorkspaceTransitionRequestV1,
  WorkspaceTransitionRequestV1Schema,
  type WorkspaceTransitionResultV1,
} from "../../shared/contracts/workspace-status-transition.v1";
import {
  type WorkspaceStatusV1,
  WorkspaceStatusV1Schema,
} from "../../shared/contracts/workspace.v1";

type TransitionRule = {
  toStatus: WorkspaceStatusV1;
  roles: WorkspaceRoleV1[];
  requiresReason: boolean;
};

const WORKSPACE_TRANSITION_RULES: Record<WorkspaceStatusV1, TransitionRule[]> =
  {
    draft: [
      {
        toStatus: "in_review",
        roles: ["Admin", "Editor"],
        requiresReason: false,
      },
    ],
    in_review: [
      {
        toStatus: "changes_requested",
        roles: ["Admin", "Editor"],
        requiresReason: false,
      },
      {
        toStatus: "ready_for_approval",
        roles: ["Admin", "Editor"],
        requiresReason: false,
      },
    ],
    changes_requested: [
      { toStatus: "draft", roles: ["Admin", "Editor"], requiresReason: false },
    ],
    ready_for_approval: [
      {
        toStatus: "approved_for_export",
        roles: ["Admin", "Editor"],
        requiresReason: false,
      },
    ],
    approved_for_export: [
      {
        toStatus: "exported",
        roles: ["Admin", "Editor"],
        requiresReason: false,
      },
      { toStatus: "draft", roles: ["Admin", "Editor"], requiresReason: false },
    ],
    exported: [
      {
        toStatus: "client_accepted",
        roles: ["Admin", "Editor"],
        requiresReason: false,
      },
      { toStatus: "draft", roles: ["Admin", "Editor"], requiresReason: false },
    ],
    client_accepted: [
      { toStatus: "filed", roles: ["Admin", "Editor"], requiresReason: false },
      { toStatus: "draft", roles: ["Admin", "Editor"], requiresReason: false },
    ],
    filed: [{ toStatus: "draft", roles: ["Admin"], requiresReason: true }],
  };

function buildFailure(
  input: WorkspaceTransitionRequestV1,
  code: WorkspaceTransitionErrorCodeV1,
  message: string,
  userMessage: string,
): WorkspaceTransitionResultV1 {
  return {
    ok: false,
    error: {
      code,
      message,
      user_message: userMessage,
      context: {
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorRole: input.actorRole,
        allowedNextStatuses: getAllowedNextWorkspaceStatusesV1({
          fromStatus: input.fromStatus,
          actorRole: input.actorRole,
        }),
      },
    },
  };
}

function deriveContextFromUnknownInput(
  input: unknown,
): Pick<WorkspaceTransitionRequestV1, "fromStatus" | "toStatus" | "actorRole"> {
  if (typeof input !== "object" || input === null) {
    return { fromStatus: "draft", toStatus: "draft", actorRole: "Editor" };
  }

  const candidate = input as Record<string, unknown>;

  const fromStatusResult = WorkspaceStatusV1Schema.safeParse(
    candidate.fromStatus,
  );
  const actorRoleResult = WorkspaceRoleV1Schema.safeParse(candidate.actorRole);

  const fromStatus = fromStatusResult.success ? fromStatusResult.data : "draft";
  const actorRole = actorRoleResult.success ? actorRoleResult.data : "Editor";

  const toStatusResult = WorkspaceStatusV1Schema.safeParse(candidate.toStatus);
  const toStatus = toStatusResult.success ? toStatusResult.data : fromStatus;

  return { fromStatus, toStatus, actorRole };
}

/**
 * Returns actor-specific allowed next statuses for a given current status.
 */
export function getAllowedNextWorkspaceStatusesV1(input: {
  fromStatus: WorkspaceStatusV1;
  actorRole: WorkspaceRoleV1;
}): WorkspaceStatusV1[] {
  const rules = WORKSPACE_TRANSITION_RULES[input.fromStatus];

  return rules
    .filter((rule) => rule.roles.includes(input.actorRole))
    .map((rule) => rule.toStatus);
}

/**
 * Evaluates whether a workspace status transition request is valid for V1.
 */
export function evaluateWorkspaceStatusTransitionV1(
  input: unknown,
): WorkspaceTransitionResultV1 {
  const parsedRequest = WorkspaceTransitionRequestV1Schema.safeParse(input);

  if (!parsedRequest.success) {
    const context = deriveContextFromUnknownInput(input);
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "Transition request payload is invalid and could not be evaluated.",
        user_message:
          "The status change request is invalid. Please refresh and try again.",
        context: {
          ...context,
          allowedNextStatuses: getAllowedNextWorkspaceStatusesV1({
            fromStatus: context.fromStatus,
            actorRole: context.actorRole,
          }),
        },
      },
    };
  }

  const parsed = parsedRequest.data;

  if (parsed.fromStatus === parsed.toStatus) {
    return buildFailure(
      parsed,
      "NO_OP_TRANSITION",
      `No-op transition is not allowed (${parsed.fromStatus} -> ${parsed.toStatus}).`,
      "The selected status is already set. Choose a different status.",
    );
  }

  const rules = WORKSPACE_TRANSITION_RULES[parsed.fromStatus];
  const matchingRule = rules.find((rule) => rule.toStatus === parsed.toStatus);

  if (!matchingRule) {
    return buildFailure(
      parsed,
      "INVALID_TRANSITION",
      `Transition is not allowed (${parsed.fromStatus} -> ${parsed.toStatus}).`,
      "This status change is not allowed from the current status.",
    );
  }

  if (!matchingRule.roles.includes(parsed.actorRole)) {
    return buildFailure(
      parsed,
      "ROLE_FORBIDDEN",
      `Role ${parsed.actorRole} cannot execute transition (${parsed.fromStatus} -> ${parsed.toStatus}).`,
      "You do not have permission to perform this status change.",
    );
  }

  if (
    matchingRule.requiresReason &&
    (!parsed.reason || parsed.reason.trim().length === 0)
  ) {
    return buildFailure(
      parsed,
      "REASON_REQUIRED",
      `Transition (${parsed.fromStatus} -> ${parsed.toStatus}) requires a non-empty reason.`,
      "A reason is required for this status change.",
    );
  }

  return {
    ok: true,
    fromStatus: parsed.fromStatus,
    toStatus: parsed.toStatus,
  };
}
