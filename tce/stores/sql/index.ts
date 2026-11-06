// Public surface of stores/sql: the shared SQL Store and the pieces a backend
// needs to plug into it. Zero platform dependencies (ES2023 only).

export type { SqlDriver, SqlStatement, SqlValue } from './driver.ts';
export { createSqlStore, SILENT_LOGGER } from './store.ts';
export type { PointsSink, SqlStoreOptions, SqlStoreSinks } from './store.ts';
export { STATEMENT_LIMITS, buildInserts, buildKeyedDeletes, packStatements, statementBytes, utf8Length } from './chunk.ts';
export type { StatementLimits, TableSpec } from './chunk.ts';
export { splitSqlStatements } from './split.ts';
