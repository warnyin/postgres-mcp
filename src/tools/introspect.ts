import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runQuery } from "../services/db.js";
import { errorResponse, formatQueryResult, handlePgError } from "../services/format.js";
import { ResponseFormatSchema, SchemaNameSchema, TableNameSchema } from "../schemas/common.js";

const ListSchemasInput = z
  .object({
    include_system: z
      .boolean()
      .default(false)
      .describe("Include system schemas (pg_catalog, information_schema, pg_toast, pg_temp_*)."),
    response_format: ResponseFormatSchema,
  })
  .strict();

const ListTablesInput = z
  .object({
    schema: SchemaNameSchema.default("public").describe("Schema to inspect (default 'public')."),
    include_views: z.boolean().default(true).describe("Include views in the result."),
    response_format: ResponseFormatSchema,
  })
  .strict();

const DescribeTableInput = z
  .object({
    schema: SchemaNameSchema.default("public"),
    table: TableNameSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

const ListIndexesInput = z
  .object({
    schema: SchemaNameSchema.default("public"),
    table: TableNameSchema.optional().describe("Optional: only return indexes for this table."),
    response_format: ResponseFormatSchema,
  })
  .strict();

const ListConnectionsInput = z
  .object({
    response_format: ResponseFormatSchema,
  })
  .strict();

const ExplainInput = z
  .object({
    sql: z.string().min(1).max(20_000).describe("The SQL statement to explain."),
    analyze: z
      .boolean()
      .default(false)
      .describe("If true, runs EXPLAIN ANALYZE (actually executes the query — read-only statements only)."),
    response_format: ResponseFormatSchema,
  })
  .strict();

export function registerIntrospectionTools(server: McpServer): void {
  server.registerTool(
    "postgres_list_schemas",
    {
      title: "List PostgreSQL schemas",
      description: `List all schemas in the connected database, with owner and a flag for whether the schema is a system schema.

Args:
  - include_system (boolean): Include pg_catalog/information_schema/pg_toast/pg_temp_* (default false).
  - response_format ('markdown' | 'json'): Output format (default 'markdown').

Returns rows: { schema_name, owner, is_system }.`,
      inputSchema: ListSchemasInput.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (raw) => {
      const parsed = ListSchemasInput.safeParse(raw);
      if (!parsed.success) return errorResponse(zodMessage(parsed.error));
      const { include_system, response_format } = parsed.data;
      const sql = `
        SELECT
          n.nspname AS schema_name,
          pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
          (n.nspname IN ('pg_catalog','information_schema') OR n.nspname LIKE 'pg_toast%' OR n.nspname LIKE 'pg_temp_%') AS is_system
        FROM pg_catalog.pg_namespace n
        ${include_system ? "" : "WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'"}
        ORDER BY n.nspname
      `;
      try {
        const result = await runQuery(sql, [], { readOnly: true });
        return formatQueryResult(result, response_format);
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );

  server.registerTool(
    "postgres_list_tables",
    {
      title: "List tables in a schema",
      description: `List all tables (and optionally views) in the given schema, with row estimates and total size.

Args:
  - schema (string): Schema name (default 'public').
  - include_views (boolean): Include views (default true).
  - response_format ('markdown' | 'json'): Output format.

Returns rows: { schema, name, type, row_estimate, total_size, total_size_bytes, description }.`,
      inputSchema: ListTablesInput.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (raw) => {
      const parsed = ListTablesInput.safeParse(raw);
      if (!parsed.success) return errorResponse(zodMessage(parsed.error));
      const { schema, include_views, response_format } = parsed.data;
      const kinds = include_views ? ["r", "p", "v", "m", "f"] : ["r", "p", "f"];
      const sql = `
        SELECT
          n.nspname AS schema,
          c.relname AS name,
          CASE c.relkind
            WHEN 'r' THEN 'table'
            WHEN 'p' THEN 'partitioned table'
            WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized view'
            WHEN 'f' THEN 'foreign table'
            ELSE c.relkind::text
          END AS type,
          c.reltuples::bigint AS row_estimate,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
          pg_total_relation_size(c.oid) AS total_size_bytes,
          obj_description(c.oid, 'pg_class') AS description
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = ANY($2::char[])
        ORDER BY c.relname
      `;
      try {
        const result = await runQuery(sql, [schema, kinds], { readOnly: true });
        return formatQueryResult(result, response_format);
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );

  server.registerTool(
    "postgres_describe_table",
    {
      title: "Describe a table — columns, constraints, foreign keys",
      description: `Return columns, primary key, foreign keys, and check constraints for a table or view.

Args:
  - schema (string): Schema name (default 'public').
  - table (string): Table or view name (unquoted; case-sensitive lookup against pg_catalog).
  - response_format ('markdown' | 'json').

Returns structured payload:
  {
    "columns": [{ column_name, data_type, is_nullable, default, description, position }],
    "primary_key": [column_name, ...],
    "foreign_keys": [{ name, columns, references_schema, references_table, references_columns, on_update, on_delete }],
    "check_constraints": [{ name, definition }]
  }`,
      inputSchema: DescribeTableInput.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (raw) => {
      const parsed = DescribeTableInput.safeParse(raw);
      if (!parsed.success) return errorResponse(zodMessage(parsed.error));
      const { schema, table, response_format } = parsed.data;

      const columnsSql = `
        SELECT
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          NOT a.attnotnull AS is_nullable,
          pg_get_expr(d.adbin, d.adrelid) AS "default",
          col_description(a.attrelid, a.attnum) AS description,
          a.attnum AS position
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
      `;

      const constraintsSql = `
        SELECT
          con.conname AS name,
          con.contype AS type,
          pg_get_constraintdef(con.oid, true) AS definition,
          (SELECT array_agg(att.attname ORDER BY u.ord) FROM unnest(con.conkey) WITH ORDINALITY u(attnum, ord)
             JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum) AS columns,
          fn.nspname AS fk_ref_schema,
          fc.relname AS fk_ref_table,
          (SELECT array_agg(att.attname ORDER BY u.ord) FROM unnest(con.confkey) WITH ORDINALITY u(attnum, ord)
             JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = u.attnum) AS fk_ref_columns,
          CASE con.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_update,
          CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_class fc ON fc.oid = con.confrelid
        LEFT JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
        ORDER BY con.conname
      `;

      try {
        const columns = await runQuery(columnsSql, [schema, table], { readOnly: true });
        if (!columns.rows.length) {
          return errorResponse(`Table "${schema}"."${table}" not found (or has no columns visible).`);
        }
        const constraints = await runQuery(constraintsSql, [schema, table], { readOnly: true });

        type ConRow = {
          name: string;
          type: string;
          definition: string;
          columns: string[] | null;
          fk_ref_schema: string | null;
          fk_ref_table: string | null;
          fk_ref_columns: string[] | null;
          on_update: string | null;
          on_delete: string | null;
        };
        const conRows = constraints.rows as ConRow[];
        const pkRow = conRows.find((r) => r.type === "p");

        const structured = {
          schema,
          table,
          columns: columns.rows,
          primary_key: pkRow?.columns ?? [],
          foreign_keys: conRows
            .filter((r) => r.type === "f")
            .map((r) => ({
              name: r.name,
              columns: r.columns,
              references_schema: r.fk_ref_schema,
              references_table: r.fk_ref_table,
              references_columns: r.fk_ref_columns,
              on_update: r.on_update,
              on_delete: r.on_delete,
            })),
          unique_constraints: conRows
            .filter((r) => r.type === "u")
            .map((r) => ({ name: r.name, columns: r.columns, definition: r.definition })),
          check_constraints: conRows
            .filter((r) => r.type === "c")
            .map((r) => ({ name: r.name, definition: r.definition })),
        } satisfies Record<string, unknown>;

        if (response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          };
        }
        const lines: string[] = [];
        lines.push(`# ${schema}.${table}`, "");
        lines.push("## Columns", "");
        lines.push("| # | Column | Type | Nullable | Default | Description |");
        lines.push("| --- | --- | --- | --- | --- | --- |");
        for (const c of columns.rows as Record<string, unknown>[]) {
          lines.push(
            `| ${c.position} | ${c.column_name} | ${c.data_type} | ${c.is_nullable ? "YES" : "NO"} | ${c.default ?? ""} | ${c.description ?? ""} |`,
          );
        }
        if (structured.primary_key.length) {
          lines.push("", `## Primary key`, "", `- ${structured.primary_key.join(", ")}`);
        }
        if (structured.foreign_keys.length) {
          lines.push("", "## Foreign keys", "");
          for (const fk of structured.foreign_keys) {
            lines.push(
              `- **${fk.name}**: (${fk.columns?.join(", ")}) → ${fk.references_schema}.${fk.references_table}(${fk.references_columns?.join(", ")})  ON UPDATE ${fk.on_update}  ON DELETE ${fk.on_delete}`,
            );
          }
        }
        if (structured.check_constraints.length) {
          lines.push("", "## Check constraints", "");
          for (const cc of structured.check_constraints) {
            lines.push(`- **${cc.name}**: \`${cc.definition}\``);
          }
        }
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: structured,
        };
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );

  server.registerTool(
    "postgres_list_indexes",
    {
      title: "List indexes",
      description: `List indexes in a schema (optionally filtered to a single table), with size and definition.

Args:
  - schema (string): Schema (default 'public').
  - table (string, optional): If provided, only return indexes for this table.
  - response_format ('markdown' | 'json').

Returns rows: { schema, table, index_name, is_unique, is_primary, size, definition }.`,
      inputSchema: ListIndexesInput.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (raw) => {
      const parsed = ListIndexesInput.safeParse(raw);
      if (!parsed.success) return errorResponse(zodMessage(parsed.error));
      const { schema, table, response_format } = parsed.data;
      const sql = `
        SELECT
          n.nspname AS schema,
          t.relname AS "table",
          i.relname AS index_name,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary,
          pg_size_pretty(pg_relation_size(i.oid)) AS size,
          pg_get_indexdef(ix.indexrelid) AS definition
        FROM pg_catalog.pg_index ix
        JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
        JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1
          AND ($2::text IS NULL OR t.relname = $2)
        ORDER BY t.relname, i.relname
      `;
      try {
        const result = await runQuery(sql, [schema, table ?? null], { readOnly: true });
        return formatQueryResult(result, response_format);
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );

  server.registerTool(
    "postgres_server_info",
    {
      title: "Server info and active connections",
      description: `Return the server version, the current database/user, and the list of active connections.

Args:
  - response_format ('markdown' | 'json').

Returns:
  {
    "server": { version, current_database, current_user, current_schema },
    "connections": [{ pid, state, usename, datname, client_addr, application_name, query_start, query }]
  }`,
      inputSchema: ListConnectionsInput.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (raw) => {
      const parsed = ListConnectionsInput.safeParse(raw);
      if (!parsed.success) return errorResponse(zodMessage(parsed.error));
      const { response_format } = parsed.data;
      try {
        const server = await runQuery(
          "SELECT version() AS version, current_database() AS current_database, current_user AS current_user, current_schema() AS current_schema",
          [],
          { readOnly: true },
        );
        const connections = await runQuery(
          `SELECT pid, state, usename, datname, client_addr::text AS client_addr, application_name, query_start, left(query, 200) AS query
             FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
            ORDER BY query_start DESC NULLS LAST
            LIMIT 200`,
          [],
          { readOnly: true },
        );
        const structured = {
          server: server.rows[0] ?? {},
          connections: connections.rows,
        };
        if (response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          };
        }
        const s = structured.server as Record<string, unknown>;
        const lines = [
          "# Server",
          "",
          `- **Version**: ${s.version}`,
          `- **Database**: ${s.current_database}`,
          `- **User**: ${s.current_user}`,
          `- **Schema**: ${s.current_schema}`,
          "",
          `## Active connections (${connections.rows.length})`,
          "",
        ];
        for (const c of connections.rows as Record<string, unknown>[]) {
          lines.push(
            `- pid=${c.pid} state=${c.state} user=${c.usename} db=${c.datname} app=${c.application_name} addr=${c.client_addr ?? "(local)"} query=\`${String(c.query ?? "").replace(/`/g, "'")}\``,
          );
        }
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: structured,
        };
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );

  server.registerTool(
    "postgres_explain",
    {
      title: "EXPLAIN (and optionally ANALYZE) a SQL statement",
      description: `Return the PostgreSQL query plan for a statement. When analyze=true, the plan is generated by actually executing the query — therefore only read-only statements (SELECT/WITH/SHOW/VALUES/TABLE) are allowed in that mode.

Args:
  - sql (string): The SQL statement to explain.
  - analyze (boolean): Use EXPLAIN ANALYZE (default false).
  - response_format ('markdown' | 'json').

Returns:
  - markdown: a fenced text block with the plan
  - json: { "plan": <PostgreSQL JSON plan> }`,
      inputSchema: ExplainInput.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (raw) => {
      const parsed = ExplainInput.safeParse(raw);
      if (!parsed.success) return errorResponse(zodMessage(parsed.error));
      const { sql, analyze, response_format } = parsed.data;

      if (analyze) {
        const { isReadOnlySql } = await import("../services/db.js");
        if (!isReadOnlySql(sql)) {
          return errorResponse(
            "EXPLAIN ANALYZE actually executes the query; only read-only statements are allowed when analyze=true.",
          );
        }
      }
      try {
        const jsonSql = `EXPLAIN (FORMAT JSON${analyze ? ", ANALYZE, BUFFERS" : ""}) ${sql}`;
        const jsonResult = await runQuery(jsonSql, [], { readOnly: !analyze ? true : false });
        const plan = (jsonResult.rows[0] as { ["QUERY PLAN"]?: unknown })?.["QUERY PLAN"];
        if (response_format === "json") {
          const out = { plan };
          return {
            content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
            structuredContent: out,
          };
        }
        const textSql = `EXPLAIN${analyze ? " (ANALYZE, BUFFERS, VERBOSE)" : " (VERBOSE)"} ${sql}`;
        const textResult = await runQuery(textSql, [], { readOnly: !analyze ? true : false });
        const text = (textResult.rows as Record<string, unknown>[])
          .map((r) => String(r["QUERY PLAN"] ?? ""))
          .join("\n");
        return {
          content: [{ type: "text", text: `# Query plan\n\n\`\`\`\n${text}\n\`\`\`` }],
          structuredContent: { plan },
        };
      } catch (err) {
        return errorResponse(handlePgError(err));
      }
    },
  );
}

function zodMessage(error: z.ZodError): string {
  return `Invalid arguments: ${error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
}
