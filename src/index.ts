#!/usr/bin/env node
/**
 * @warnyin/postgres-mcp — Model Context Protocol server for managing PostgreSQL.
 *
 * Run via npx:
 *   npx @warnyin/postgres-mcp
 *
 * Configure with DATABASE_URL (preferred) or PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT/PGSSLMODE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { closePool } from "./services/db.js";
import { registerQueryTool } from "./tools/query.js";
import { registerExecuteTool } from "./tools/execute.js";
import { registerIntrospectionTools } from "./tools/introspect.js";

function printHelp(): void {
  const lines = [
    `@warnyin/postgres-mcp v${SERVER_VERSION}`,
    ``,
    `Model Context Protocol server for PostgreSQL. Talks over stdio.`,
    ``,
    `Usage:`,
    `  npx @warnyin/postgres-mcp`,
    ``,
    `Environment variables (one of):`,
    `  DATABASE_URL                 postgres://user:pass@host:5432/db`,
    `  POSTGRES_URL                 (alias for DATABASE_URL)`,
    ``,
    `Or:`,
    `  PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE`,
    ``,
    `Optional:`,
    `  PGSSLMODE                    disable | require | verify-ca | verify-full`,
    `  PG_POOL_MAX                  max pool connections (default 10)`,
    ``,
    `Tools registered:`,
    `  postgres_query               read-only SELECT/WITH/SHOW/EXPLAIN/VALUES/TABLE`,
    `  postgres_execute             INSERT/UPDATE/DELETE/DDL (requires confirm=true)`,
    `  postgres_list_schemas        list schemas`,
    `  postgres_list_tables         list tables/views in a schema`,
    `  postgres_describe_table      columns, PK, FKs, checks`,
    `  postgres_list_indexes        indexes in a schema or table`,
    `  postgres_server_info         version, current db/user, active connections`,
    `  postgres_explain             EXPLAIN [ANALYZE] for a SQL statement`,
    ``,
  ];
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(SERVER_VERSION);
    return;
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerQueryTool(server);
  registerExecuteTool(server);
  registerIntrospectionTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdio MCP servers must not log to stdout).
  console.error(`[${SERVER_NAME}] v${SERVER_VERSION} ready on stdio.`);

  const shutdown = async (signal: string): Promise<void> => {
    console.error(`[${SERVER_NAME}] received ${signal}, shutting down...`);
    try {
      await server.close();
    } catch {
      // ignore
    }
    await closePool().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal error:`, err);
  process.exit(1);
});
