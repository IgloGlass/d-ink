import type { D1Database } from "./d1";

export interface AnnualReportSourceObjectV1 {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface AnnualReportSourceStoreV1 {
  delete(key: string): Promise<void>;
  get(key: string): Promise<AnnualReportSourceObjectV1 | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    },
  ): Promise<unknown>;
}

export interface AnnualReportProcessingQueueV1 {
  send(message: unknown): Promise<void>;
}

export interface Env {
  AUTH_TOKEN_HMAC_SECRET: string;
  /** Which AI provider to use. Defaults to "qwen" if not set. */
  AI_PROVIDER?: string;
  AI_PROVIDER_API_KEY?: string;
  ANNUAL_REPORT_AI_OVERDRIVE_ENABLED?: string;
  ANNUAL_REPORT_FILES?: AnnualReportSourceStoreV1;
  ANNUAL_REPORT_QUEUE?: AnnualReportProcessingQueueV1;
  APP_BASE_URL: string;
  DB: D1Database;
  DEV_AUTH_BYPASS_ENABLED?: string;
  DEV_AUTH_DEFAULT_EMAIL?: string;
  DEV_AUTH_DEFAULT_ROLE?: string;
  DEV_AUTH_DEFAULT_TENANT_ID?: string;
  QWEN_API_KEY?: string;
  QWEN_BASE_URL?: string;
  QWEN_FAST_MODEL?: string;
  QWEN_THINKING_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_FAST_MODEL?: string;
  OPENAI_THINKING_MODEL?: string;
}
