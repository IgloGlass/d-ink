import { z } from "zod";

import { UuidV4Schema } from "../../shared/contracts/common.v1";
import { WorkspaceStatusV1Schema } from "../../shared/contracts/workspace.v1";
import type { Env } from "../../shared/types/env";
import { applyWorkspaceTransitionV1 } from "../workflow/workspace-lifecycle.v1";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import {
  createTenantMismatchResponseV1,
  requireSessionPrincipalV1,
} from "./session-guard.v1";
import {
  createWorkspaceLifecycleDepsV1,
  mapWorkspaceLifecycleFailureToResponseV1,
  readJsonBodyV1,
} from "./workspace-http-helpers.v1";

const WorkspaceTransitionHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    toStatus: WorkspaceStatusV1Schema,
    reason: z.string().optional(),
  })
  .strict();

export async function handleWorkspaceTransitionV1(input: {
  env: Env;
  request: Request;
  workspaceId: string;
}): Promise<Response> {
  const sessionResult = await requireSessionPrincipalV1({
    env: input.env,
    operation: "workspace.findActiveSessionPrincipalByTokenV1",
    request: input.request,
  });
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const parsedBody = WorkspaceTransitionHttpRequestBodyV1Schema.safeParse(
    await readJsonBodyV1(input.request),
  );
  if (!parsedBody.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace transition request body is invalid.",
    });
  }

  const tenantMismatchResponse = createTenantMismatchResponseV1({
    requestTenantId: parsedBody.data.tenantId,
    sessionTenantId: sessionResult.principal.tenantId,
    userMessage:
      "You can only access workspace resources in the active tenant.",
  });
  if (tenantMismatchResponse) {
    return tenantMismatchResponse;
  }

  const result = await applyWorkspaceTransitionV1(
    {
      tenantId: parsedBody.data.tenantId,
      workspaceId: input.workspaceId,
      toStatus: parsedBody.data.toStatus,
      reason: parsedBody.data.reason,
      actor: {
        actorType: "user",
        actorRole: sessionResult.principal.role,
        actorUserId: sessionResult.principal.userId,
      },
    },
    createWorkspaceLifecycleDepsV1(input.env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
