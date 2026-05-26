import pg from "pg";
import { DEFAULT_STATEMENT_TIMEOUT_MS } from "../constants.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function readConnectionConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (connectionString) {
    const ssl = parseSsl(process.env.PGSSLMODE ?? process.env.PGSSL);
    return {
      connectionString,
      ...(ssl ? { ssl } : {}),
      statement_timeout: DEFAULT_STATEMENT_TIMEOUT_MS,
      max: parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    };
  }

  const host = process.env.PGHOST;
  if (!host) {
    throw new Error(
      "PostgreSQL connection not configured. Set DATABASE_URL (e.g. postgres://user:pass@host:5432/db) " +
        "or PGHOST/PGUSER/PGPASSWORD/PGDATABASE environment variables.",
    );
  }

  const ssl = parseSsl(process.env.PGSSLMODE ?? process.env.PGSSL);
  return {
    host,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ...(ssl ? { ssl } : {}),
    statement_timeout: DEFAULT_STATEMENT_TIMEOUT_MS,
    max: parseInt(process.env.PG_POOL_MAX ?? "10", 10),
  };
}

function parseSsl(value: string | undefined): pg.PoolConfig["ssl"] {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (["disable", "false", "off", "0"].includes(normalized)) return false;
  if (["require", "true", "on", "1", "prefer"].includes(normalized)) {
    return { rejectUnauthorized: false };
  }
  if (["verify-ca", "verify-full"].includes(normalized)) {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(readConnectionConfig());
    pool.on("error", (err) => {
      // Errors on idle clients shouldn't crash the server.
      console.error(`[postgres-mcp] idle pool client error: ${err.message}`);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export interface QueryRunOptions {
  readOnly?: boolean;
  statementTimeoutMs?: number;
}

export interface QueryRunResult<T extends pg.QueryResultRow = pg.QueryResultRow> {
  command: string;
  rowCount: number | null;
  rows: T[];
  fields: { name: string; dataTypeID: number }[];
  durationMs: number;
}

export async function runQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  options: QueryRunOptions = {},
): Promise<QueryRunResult<T>> {
  const client = await getPool().connect();
  const started = Date.now();
  try {
    if (options.statementTimeoutMs && options.statementTimeoutMs > 0) {
      await client.query(`SET LOCAL statement_timeout = ${options.statementTimeoutMs}`);
    }
    if (options.readOnly) {
      await client.query("BEGIN READ ONLY");
      try {
        const result = await client.query<T>(sql, params);
        await client.query("COMMIT");
        return formatResult(result, started);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
    }
    const result = await client.query<T>(sql, params);
    return formatResult(result, started);
  } finally {
    client.release();
  }
}

function formatResult<T extends pg.QueryResultRow>(
  result: pg.QueryResult<T>,
  started: number,
): QueryRunResult<T> {
  return {
    command: result.command,
    rowCount: result.rowCount,
    rows: result.rows,
    fields: (result.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    durationMs: Date.now() - started,
  };
}

const WRITE_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "TRUNCATE",
  "DROP",
  "CREATE",
  "ALTER",
  "GRANT",
  "REVOKE",
  "COMMENT",
  "VACUUM",
  "ANALYZE",
  "REINDEX",
  "CLUSTER",
  "COPY",
  "CALL",
  "DO",
  "REFRESH",
];

/**
 * Strip leading SQL comments and whitespace, then test the first keyword.
 * Used to enforce read-only mode in the `query` tool.
 */
export function isReadOnlySql(sql: string): boolean {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();
  if (!stripped) return false;
  const firstToken = stripped.split(/\s|;|\(/)[0].toUpperCase();
  if (WRITE_KEYWORDS.includes(firstToken)) return false;
  // Block multi-statement payloads that smuggle writes after a SELECT.
  const remainder = stripped.slice(firstToken.length);
  for (const kw of WRITE_KEYWORDS) {
    const re = new RegExp(`(^|[\\s;])${kw}\\b`, "i");
    if (re.test(remainder)) return false;
  }
  return ["SELECT", "WITH", "SHOW", "EXPLAIN", "VALUES", "TABLE"].includes(firstToken);
}
