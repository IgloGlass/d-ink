import type { D1Database } from "./d1";

export interface Env {
  AUTH_TOKEN_HMAC_SECRET: string;
  AI_PROVIDER_API_KEY?: string;
  APP_BASE_URL: string;
  DB: D1Database;
}
