import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isReadOnlySql, runQuery } from "../services/db.js";
import { errorResponse, formatQueryResult, handlePgError } from "../services/format.js";
import { ResponseFormatSchema, SqlParamsSchema } from "../schemas/common.js";
import { DEFAULT_STATEMENT_TIMEOUT_MS } from "../constants.js";

const QueryInputSchema = z
  .object({
    sql: z
      .string()
      .min(1, "sql must not be empty")
      .max(20_000, "sql must not exceed 20,000 characters")
      .describe(
        "A read-only SQL statement (SELECT / WITH / SHOW / EXPLAIN / VALUES / TABLE). Multi-statement payloads are rejected.",
      ),
    params: SqlParamsSchema,
    statement_timeout_ms: z
      .number()
      .int()
      .min(100)
      .max(300_000)
      .default(DEFAULT_STATEMENT_TIMEOUT_MS)
      .describe("Per-statement timeout in milliseconds (default 30s)."),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type QueryInput = z.infer<typeof QueryInputSchema>;

export function registerQueryTool(server: McpServer): void {
  server.registerTool(
    "postgres_query",
    {
      title: "Run a read-only PostgreSQL query",
      description: `Execute a read-only SQL statement against the configured PostgreSQL database.

Use this tool for any SELECT / WITH / SHOW / EXPLAIN / VALUES / TABLE statement. The query runs
inside a READ ONLY transaction, so writes (INSERT/UPDATE/DELETE/DDL) are rejected by the engine
as well as by a client-side parser that blocks write keywords (and multi-statement smuggling).

Args:
  - sql (string): The SQL statement. Use $1, $2, ... placeholders for parameters.
  - params (array): Positional parameter values (string | number | boolean | null). Strongly
    recommended over string concatenation to avoid SQL injection.
  - statement_timeout_ms (number): Per-statement timeout, 100..300000 (default 30000).
  - response_format ('markdown' | 'json'): Output format (default 'markdown').

Returns structured payload:
  {
    "command": string,         // e.g. "SELECT"
    "row_count": number | null,
    "duration_ms": number,
    "fields": [{ "name": string, "dataTypeID": number }],
    "rows": [ { ...column values... } ]
  }

Examples:
  - "Show the 5 most recent users" -> sql: "SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5"
  - Parameterized lookup -> sql: "SELECT * FROM orders WHERE customer_id = $1", params: ["c-123"]
  - Don't use when: you need to INSERT/UPDATE/DELETE/DROP — use postgres_execute instead.

Error Handling:
  - Returns a clear error if the SQL is not read-only.
  - Returns the PostgreSQL error code and hint (e.g. [42P01] relation "foo" does not exist).`,
      inputSchema: QueryInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (rawParams) => {
      const parsed = QueryInputSchema.safeParse(rawParams);
      if (!parsed.success) {
        return errorResponse(
          `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
      const params = parsed.data;
      if (!isReadOnlySql(params.sql)) {
        return errorResponse(
          "Refusing to execute: postgres_query only allows read-only statements (SELECT/WITH/SHOW/EXPLAIN/VALUES/TABLE). " +
            "Use postgres_execute for write or DDL statements.",
        );
      }
      try {
        const result = await runQuery(params.sql, params.params, {
          readOnly: true,
          statementTimeoutMs: params.statement_timeout_ms,
        });
        return formatQueryResult(result, params.response_format);
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );
}
