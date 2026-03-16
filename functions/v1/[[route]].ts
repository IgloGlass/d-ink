import worker from "../../src/worker";
import type { Env } from "../../src/shared/types/env";

type WorkerExecutionContextV1 = {
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Pages Functions adapter:
 * Keep API traffic on the same origin by delegating /v1/* requests to the
 * existing Worker route handlers.
 */
export const onRequest: PagesFunction<Env> = async (context) =>
  worker.fetch(context.request, context.env, {
    waitUntil: (promise) => context.waitUntil(promise),
  } satisfies WorkerExecutionContextV1);
