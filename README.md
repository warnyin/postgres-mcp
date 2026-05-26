# @warnyin/postgres-mcp

Model Context Protocol (MCP) server for managing **PostgreSQL** databases. Runnable via `npx` — no install required.

It exposes safe, well-typed tools that let an LLM (Claude, Cursor, VS Code, etc.) inspect schemas, run read-only queries, execute writes with explicit confirmation, and analyze query plans.

[![npm version](https://img.shields.io/npm/v/@warnyin/postgres-mcp.svg)](https://www.npmjs.com/package/@warnyin/postgres-mcp)
[![license](https://img.shields.io/npm/l/@warnyin/postgres-mcp.svg)](./LICENSE)

---

## Features

- **`postgres_query`** — Read-only SQL (`SELECT` / `WITH` / `SHOW` / `EXPLAIN` / `VALUES` / `TABLE`). Runs in a `BEGIN READ ONLY` transaction and is gated by a client-side parser that rejects write keywords and multi-statement smuggling.
- **`postgres_execute`** — Write / DDL statements. Requires `confirm: true` to actually run.
- **`postgres_list_schemas`** — List schemas with owners.
- **`postgres_list_tables`** — List tables / views with row estimates and total size.
- **`postgres_describe_table`** — Columns, primary key, foreign keys, unique and check constraints.
- **`postgres_list_indexes`** — Index definitions and sizes.
- **`postgres_server_info`** — Server version, current database/user, and active connections.
- **`postgres_explain`** — `EXPLAIN` and `EXPLAIN ANALYZE` (analyze mode rejects write statements).

Every tool supports `response_format: "markdown" | "json"` and returns structured content for downstream agents.

---

## Quick start

```bash
DATABASE_URL=postgres://user:pass@host:5432/db npx -y @warnyin/postgres-mcp
```

The process speaks MCP over **stdio**, so it's normally launched by your client (Claude Desktop, Cursor, VS Code, etc.) rather than run directly.

### Help

```bash
npx -y @warnyin/postgres-mcp --help
```

---

## Configuration

The server reads connection settings from environment variables.

**Preferred:**

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Full connection string, e.g. `postgres://user:pass@host:5432/db` |
| `POSTGRES_URL` | Alias for `DATABASE_URL` |

**Or set individual variables:**

| Variable | Default |
| --- | --- |
| `PGHOST` | (required if no `DATABASE_URL`) |
| `PGPORT` | `5432` |
| `PGUSER` | — |
| `PGPASSWORD` | — |
| `PGDATABASE` | — |

**Optional:**

| Variable | Description |
| --- | --- |
| `PGSSLMODE` | `disable` \| `require` \| `verify-ca` \| `verify-full` |
| `PG_POOL_MAX` | Max pool connections (default `10`) |

---

## Client setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@warnyin/postgres-mcp"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@host:5432/db"
      }
    }
  }
}
```

### Cursor / VS Code (MCP)

```json
{
  "mcp.servers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@warnyin/postgres-mcp"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@host:5432/db"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add postgres --env DATABASE_URL=postgres://user:pass@host:5432/db \
  -- npx -y @warnyin/postgres-mcp
```

---

## Tool reference

### `postgres_query`

Run a **read-only** SQL statement.

```jsonc
{
  "sql": "SELECT id, email FROM users WHERE created_at > $1 ORDER BY id LIMIT 10",
  "params": ["2026-01-01"],
  "statement_timeout_ms": 5000,
  "response_format": "markdown"
}
```

Rejects anything that isn't `SELECT` / `WITH` / `SHOW` / `EXPLAIN` / `VALUES` / `TABLE`. Also blocks multi-statement payloads that try to smuggle a write after a read.

### `postgres_execute`

Run a **write / DDL** statement. Requires `confirm: true`.

```jsonc
{
  "sql": "UPDATE orders SET status = $1 WHERE id = ANY($2::int[]) RETURNING id",
  "params": ["shipped", "{1,2,3}"],
  "confirm": true
}
```

### `postgres_describe_table`

```jsonc
{ "schema": "public", "table": "orders" }
```

Returns:

```jsonc
{
  "columns": [{ "column_name": "id", "data_type": "integer", "is_nullable": false, "default": "nextval(...)", "position": 1 }],
  "primary_key": ["id"],
  "foreign_keys": [{ "name": "...", "columns": ["customer_id"], "references_schema": "public", "references_table": "customers", "references_columns": ["id"], "on_update": "NO ACTION", "on_delete": "CASCADE" }],
  "unique_constraints": [],
  "check_constraints": []
}
```

### `postgres_explain`

```jsonc
{ "sql": "SELECT * FROM users WHERE email = $1", "analyze": false }
```

When `analyze: true`, the underlying `EXPLAIN ANALYZE` actually runs the query; only read-only statements are allowed in that mode.

---

## Security notes

- The server always uses **parameterized queries** — pass values through `params`, never via string concatenation.
- `postgres_query` enforces read-only by parser **and** transaction (`BEGIN READ ONLY`).
- `postgres_execute` requires explicit `confirm: true` per call.
- Each statement runs with `statement_timeout` (default 30 s; configurable per call).
- Treat the database role you connect with as the trust boundary — give the MCP server a role with the minimum privileges it needs.

---

## Development

```bash
npm install
npm run build         # produces dist/index.js
node dist/index.js --help
```

Run from source with hot reload:

```bash
npm run dev
```

---

## License

[MIT](./LICENSE)
