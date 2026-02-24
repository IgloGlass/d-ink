import { handleAuthMagicLinkRoutesV1 } from "./server/http/auth-magic-link-routes.v1";
import { handleWorkspaceRoutesV1 } from "./server/http/workspace-routes.v1";
import type { Env } from "./shared/types/env";

const SCAFFOLD_MARKER = "dink_scaffold_ready";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname.startsWith("/v1/auth/")) {
      return handleAuthMagicLinkRoutesV1(request, env);
    }
    if (requestUrl.pathname.startsWith("/v1/workspaces")) {
      return handleWorkspaceRoutesV1(request, env);
    }

    return Response.json(
      {
        status: "not_implemented",
        marker: SCAFFOLD_MARKER,
        message: "D.ink foundation scaffold is initialized.",
      },
      { status: 501 },
    );
  },
};
