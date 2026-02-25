import { z } from "zod";

import { UuidV4Schema } from "../../shared/contracts/common.v1";
import type { Env } from "../../shared/types/env";
import { listWorkspacesByTenantV1 } from "../workflow/workspace-lifecycle.v1";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import {
  createTenantMismatchResponseV1,
  requireSessionPrincipalV1,
} from "./session-guard.v1";
import {
  createWorkspaceLifecycleDepsV1,
  mapWorkspaceLifecycleFailureToResponseV1,
} from "./workspace-http-helpers.v1";

const WorkspaceListQueryV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

export async function handleWorkspaceListV1(input: {
  env: Env;
  request: Request;
}): Promise<Response> {
  const sessionResult = await requireSessionPrincipalV1({
    env: input.env,
    operation: "workspace.findActiveSessionPrincipalByTokenV1",
    request: input.request,
  });
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const requestUrl = new URL(input.request.url);
  const parsedQuery = WorkspaceListQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace query parameters are invalid.",
    });
  }

  const tenantMismatchResponse = createTenantMismatchResponseV1({
    requestTenantId: parsedQuery.data.tenantId,
    sessionTenantId: sessionResult.principal.tenantId,
    userMessage:
      "You can only access workspace resources in the active tenant.",
  });
  if (tenantMismatchResponse) {
    return tenantMismatchResponse;
  }

  const result = await listWorkspacesByTenantV1(
    {
      tenantId: parsedQuery.data.tenantId,
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
