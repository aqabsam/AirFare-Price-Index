declare module 'pg' {
  export type QueryResult<Row extends object = Record<string, unknown>> = {
    rows: Row[]
  }

  export type PoolConfig = {
    connectionString?: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
  }

  export class PoolClient {
    query<Row extends object = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
    release(): void
  }

  export class Pool {
    constructor(config?: PoolConfig)
    query<Row extends object = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
    connect(): Promise<PoolClient>
  }
}
