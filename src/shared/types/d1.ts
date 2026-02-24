/**
 * Minimal D1 metadata surface used by repository contracts.
 */
export interface D1ResultMeta {
  changes?: number;
  duration?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
}

/**
 * Minimal D1 query result surface used by repository contracts.
 */
export interface D1Result<T = unknown> {
  error?: string;
  meta: D1ResultMeta;
  results?: T[];
  success: boolean;
}

/**
 * Minimal D1 prepared statement contract used by repository implementations.
 */
export interface D1PreparedStatement {
  all<T = Record<string, unknown>>(): Promise<
    D1Result<T> & {
      results: T[];
    }
  >;
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

/**
 * Minimal D1 database binding contract used by V1 repositories.
 */
export interface D1Database {
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
  prepare(query: string): D1PreparedStatement;
}
