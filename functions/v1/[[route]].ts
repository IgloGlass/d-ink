import worker from "../../src/worker";
import type { Env } from "../../src/shared/types/env";

type WorkerExecutionContextV1 = {
  waitUntil(promise: Promise<unknown>): void;
};

/** Extended env that includes the Service Binding when deployed via Pages. */
interface PagesEnv extends Env {
  /** Service Binding to the standalone d-ink-demo-api Worker.
   *  Present in production (bound in wrangler.pages.toml).
   *  Absent in local dev (falls back to direct Worker import). */
  API_WORKER?: { fetch(request: Request): Promise<Response> };
}

/**
 * Pages Functions adapter:
 * In production, delegates to the standalone d-ink-demo-api Worker via a
 * Service Binding so that Queue consumers run with their own longer
 * wall-clock budget (not the Pages 30-second limit).
 * In local dev (no binding), falls back to calling the Worker handler directly.
 */
export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  if (context.env.API_WORKER) {
    // Production path: proxy to the standalone Worker via Service Binding.
    // The Worker has R2 + Queue bindings; its Queue consumer processes
    // annual reports asynchronously with up to 15 min of CPU time.
    return context.env.API_WORKER.fetch(context.request);
  }

  // Local dev fallback: call the Worker handler directly (same process).
  return worker.fetch(context.request, context.env, {
    waitUntil: (promise) => context.waitUntil(promise),
  } satisfies WorkerExecutionContextV1);
};
