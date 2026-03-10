import { handleAuthMagicLinkRoutesV1 } from "./server/http/auth-magic-link-routes.v1";
import { handleCompanyRoutesV1 } from "./server/http/company-routes.v1";
import { handleWorkspaceRoutesV1 } from "./server/http/workspace-routes.v1";
import { redactSensitiveLogFieldsV1 } from "./server/security/redaction.v1";
import { processAnnualReportProcessingRunV1 } from "./server/workflow/annual-report-processing.v1";
import { createAnnualReportProcessingDepsV1 } from "./server/workflow/workflow-deps.v1";
import type { Env } from "./shared/types/env";

const SCAFFOLD_MARKER = "dink_scaffold_ready";

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx?: unknown,
  ): Promise<Response> {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname.startsWith("/v1/auth/")) {
        return handleAuthMagicLinkRoutesV1(request, env);
      }
      if (requestUrl.pathname.startsWith("/v1/companies")) {
        return handleCompanyRoutesV1(request, env);
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
    } catch (error) {
      const safeLogPayload = redactSensitiveLogFieldsV1({
        method: request.method,
        url: request.url,
        headers: {
          cookie: request.headers.get("Cookie"),
          authorization: request.headers.get("Authorization"),
        },
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : {
                message: String(error),
              },
      });

      console.error(
        "[worker.fetch] Unhandled route error",
        JSON.stringify(safeLogPayload),
      );

      return Response.json(
        {
          ok: false,
          error: {
            code: "PERSISTENCE_ERROR",
            message: "Internal server error.",
            user_message: "Internal server error.",
            context: {},
          },
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  },

  async queue(
    batch: {
      messages: Array<{
        ack?: () => void;
        body: unknown;
        retry?: () => void;
      }>;
    },
    env: Env,
    _ctx?: unknown,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processAnnualReportProcessingRunV1(
          message.body as never,
          createAnnualReportProcessingDepsV1(env),
        );
        message.ack?.();
      } catch (error) {
        console.error(
          "[worker.queue] Annual report processing failed",
          JSON.stringify(
            redactSensitiveLogFieldsV1({
              error:
                error instanceof Error
                  ? {
                      message: error.message,
                      stack: error.stack,
                    }
                  : {
                      message: String(error),
                    },
            }),
          ),
        );
        message.retry?.();
      }
    }
  },
};
