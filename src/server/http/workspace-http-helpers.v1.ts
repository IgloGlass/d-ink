import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import type { Env } from "../../shared/types/env";
import { createJsonErrorResponseV1 } from "./http-error.v1";

export const WORKSPACES_ROUTE_BASE_PATH_V1 = "/v1/workspaces";

export async function readJsonBodyV1(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function createWorkspaceLifecycleDepsV1(env: Env) {
  return {
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

export function mapWorkspaceLifecycleFailureToResponseV1(input: {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
}): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createJsonErrorResponseV1({
      status: 400,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "DUPLICATE_WORKSPACE") {
    return createJsonErrorResponseV1({
      status: 409,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "WORKSPACE_NOT_FOUND") {
    return createJsonErrorResponseV1({
      status: 404,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "STATE_CONFLICT") {
    return createJsonErrorResponseV1({
      status: 409,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "TRANSITION_REJECTED") {
    const transitionError = input.error.context.transitionError;
    const transitionErrorCode =
      typeof transitionError === "object" &&
      transitionError !== null &&
      "code" in transitionError
        ? (transitionError as { code: unknown }).code
        : null;

    return createJsonErrorResponseV1({
      status: transitionErrorCode === "ROLE_FORBIDDEN" ? 403 : 409,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "PERSISTENCE_ERROR") {
    return createJsonErrorResponseV1({
      status: 500,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  return createJsonErrorResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    message: input.error.message,
    userMessage: input.error.user_message,
    context: input.error.context,
  });
}
