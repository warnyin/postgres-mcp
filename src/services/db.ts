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
 * Single-pass tokenizer that blanks out every non-executable region — string
 * literals ('…' with '' doubling), quoted identifiers ("…" with "" doubling),
 * dollar-quoted strings ($tag$…$tag$), line comments (--…) and nested block
 * comments — so the keyword scan below only ever reads executable text.
 * Comments and quotes MUST be tokenized together: a quote-unaware comment
 * strip lets two literals spelling '/*' and '*​/' delete real statements
 * between them. Returns null on any unterminated region: caller fails closed.
 */
function stripNonExecutable(sql: string): string | null {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      const nl = sql.indexOf("\n", i + 2);
      out += " ";
      if (nl === -1) break;
      i = nl + 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql[j] === "/" && sql[j + 1] === "*") { depth++; j += 2; continue; }
        if (sql[j] === "*" && sql[j + 1] === "/") { depth--; j += 2; continue; }
        j++;
      }
      if (depth > 0) return null; // unterminated block comment — fail closed
      out += " ";
      i = j;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === ch) {
          if (sql[i + 1] === ch) {
            i += 2; // doubled quote escape stays inside the region
            continue;
          }
          closed = true;
          i++;
          break;
        }
        i++;
      }
      if (!closed) return null;
      out += " ";
      continue;
    }
    if (ch === "$") {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end === -1) return null;
        i = end + tag.length;
        out += " ";
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Blank out comments and quoted regions in ONE pass, then test the first
 * keyword and scan the rest for write keywords. Used to enforce read-only
 * mode in the `query` and `explain(analyze)` tools. Fail-closed: any
 * ambiguity (empty, unterminated region) classifies as NOT read-only. The
 * engine-level READ ONLY transaction remains the hard guarantee.
 */
export function isReadOnlySql(sql: string): boolean {
  const scannable = stripNonExecutable(sql);
  if (scannable === null) return false;
  const text = scannable.trim();
  if (!text) return false;
  const firstToken = text.split(/\s|;|\(/)[0].toUpperCase();
  if (WRITE_KEYWORDS.includes(firstToken)) return false;
  // Block payloads that smuggle writes after the first token — including
  // multi-statement (`;DROP`), CTE (`(DELETE`), and other non-word prefixes.
  const remainder = text.slice(firstToken.length);
  for (const kw of WRITE_KEYWORDS) {
    const re = new RegExp(`(^|[^A-Za-z0-9_])${kw}\\b`, "i");
    if (re.test(remainder)) return false;
  }
  return ["SELECT", "WITH", "SHOW", "EXPLAIN", "VALUES", "TABLE"].includes(firstToken);
}
