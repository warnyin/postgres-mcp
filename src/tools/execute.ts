import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runQuery } from "../services/db.js";
import { errorResponse, formatQueryResult, handlePgError } from "../services/format.js";
import { ResponseFormatSchema, SqlParamsSchema } from "../schemas/common.js";
import { DEFAULT_STATEMENT_TIMEOUT_MS } from "../constants.js";

const ExecuteInputSchema = z
  .object({
    sql: z
      .string()
      .min(1, "sql must not be empty")
      .max(50_000, "sql must not exceed 50,000 characters")
      .describe(
        "A write or DDL SQL statement (INSERT/UPDATE/DELETE/MERGE/CREATE/ALTER/DROP/TRUNCATE/etc).",
      ),
    params: SqlParamsSchema,
    statement_timeout_ms: z
      .number()
      .int()
      .min(100)
      .max(600_000)
      .default(DEFAULT_STATEMENT_TIMEOUT_MS)
      .describe("Per-statement timeout in milliseconds (default 30s)."),
    confirm: z
      .boolean()
      .default(false)
      .describe(
        "Set to true to acknowledge that this statement will modify the database. Required for any write/DDL execution.",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type ExecuteInput = z.infer<typeof ExecuteInputSchema>;

export function registerExecuteTool(server: McpServer): void {
  server.registerTool(
    "postgres_execute",
    {
      title: "Execute a write or DDL PostgreSQL statement",
      description: `Execute a mutating SQL statement (INSERT/UPDATE/DELETE/MERGE/CREATE/ALTER/DROP/TRUNCATE/COPY/etc).

This tool BYPASSES the read-only guard used by postgres_query. To prevent accidental destruction,
the caller must explicitly set "confirm": true. Statements run in autocommit mode with a configurable
statement_timeout.

Args:
  - sql (string): The SQL statement. Use $1, $2, ... placeholders for parameters.
  - params (array): Positional parameter values (string | number | boolean | null).
  - statement_timeout_ms (number): Per-statement timeout, 100..600000 (default 30000).
  - confirm (boolean): MUST be true. Acknowledges that the statement modifies the database.
  - response_format ('markdown' | 'json'): Output format (default 'markdown').

Returns:
  {
    "command": string,         // e.g. "INSERT", "UPDATE", "CREATE TABLE"
    "row_count": number | null,
    "duration_ms": number,
    "fields": [...],
    "rows": [...]              // populated when RETURNING is used
  }

Examples:
  - Insert with RETURNING -> sql: "INSERT INTO users(email) VALUES($1) RETURNING id", params: ["a@b.co"], confirm: true
  - Schema change -> sql: "ALTER TABLE orders ADD COLUMN note text", confirm: true
  - Bulk update -> sql: "UPDATE orders SET status='shipped' WHERE id = ANY($1::int[])", params: ["{1,2,3}"], confirm: true

Safety:
  - Returns an error if confirm is not true.
  - Returns the PostgreSQL error code/hint on failure (transaction is rolled back by the driver).`,
      inputSchema: ExecuteInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (rawParams) => {
      const parsed = ExecuteInputSchema.safeParse(rawParams);
      if (!parsed.success) {
        return errorResponse(
          `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
      const params = parsed.data;
      if (!params.confirm) {
        return errorResponse(
          'postgres_execute requires "confirm": true to run a write/DDL statement. Re-issue with confirm=true once you are sure.',
        );
      }
      try {
        const result = await runQuery(params.sql, params.params, {
          statementTimeoutMs: params.statement_timeout_ms,
        });
        return formatQueryResult(result, params.response_format);
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );
}
