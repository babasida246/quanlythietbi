import type { QueryResult, QueryResultRow } from 'pg'

/**
 * Common interface for database query execution
 * Compatible with both PgClient and PoolClient
 */
export interface Queryable {
    query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>
}
