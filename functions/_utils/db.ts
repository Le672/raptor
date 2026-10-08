/** The subset of the D1 API used by portal content and its SQLite regression fixture. */
export interface PortalStatement {
  bind(...values: unknown[]): PortalStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta: { last_row_id?: number; changes: number } }>;
}
export interface PortalDatabase { prepare(sql: string): PortalStatement }
