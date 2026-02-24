import type { Env } from "../src/shared/types/env";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
