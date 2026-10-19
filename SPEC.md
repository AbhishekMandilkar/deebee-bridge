# dbbridge: CLI + MCP Server for MySQL & ClickHouse

> Implementation spec for a coding agent. `dbbridge` is a working name; rename freely.

## Goal
Stop pasting database credentials into AI agents. Users register DB connections once through an
interactive CLI. Passwords live in the OS keychain. A local stdio MCP server exposes those
connections **by name only** to Claude Code, Cursor, and other MCP clients.

## Scope
**In scope:** CLI for managing connections, stdio MCP server, MySQL and ClickHouse support.
**Out of scope:** GUI/desktop app, HTTP transport, cloud sync, other databases.

## Tech Stack
- TypeScript, Node 20+, ESM
- CLI: `commander` + `@inquirer/prompts`
- MCP: `@modelcontextprotocol/sdk` (stdio transport only)
- Keychain: `@napi-rs/keyring`
- MySQL: `mysql2/promise`
- ClickHouse: `@clickhouse/client`
- Validation: `zod`
- SQL parsing: `node-sql-parser` (MySQL dialect) for read-only checks
- Tests: `vitest`
- Build: `tsup`; publish as an npm package with `"bin": { "dbbridge": "dist/cli.js" }`

## Project Layout (single package)
```
src/
  cli.ts                 # entry: commander setup
  commands/
    add.ts  list.ts  test.ts  edit.ts  remove.ts  mcp.ts  install.ts
  core/
    config.ts            # read/write ~/.dbbridge/connections.json (atomic writes)
    secrets.ts           # keychain get/set/delete
    registry.ts          # connection CRUD combining config + secrets
    drivers/
      types.ts           # Driver interface
      mysql.ts
      clickhouse.ts
    safety.ts            # read-only classifier, limit injection, size caps
    audit.ts             # append-only query log
    errors.ts            # typed error codes + redaction
  mcp/
    server.ts            # registers tools, maps errors to MCP errors
    tools/*.ts
test/
docker-compose.yml       # MySQL 8 + ClickHouse for integration tests
```

## Data Model
Non-secret config at `~/.dbbridge/connections.json` (file mode `0600`, dir `0700`):
```json
{
  "version": 1,
  "connections": [
    {
      "name": "prod-mysql",
      "type": "mysql",
      "host": "db.example.com",
      "port": 3306,
      "database": "app",
      "user": "readonly",
      "ssl": true,
      "mode": "read-only",
      "rowLimit": 500,
      "timeoutMs": 15000,
      "createdAt": "2026-10-19T00:00:00Z"
    }
  ]
}
```
- `type`: `"mysql" | "clickhouse"`; `mode`: `"read-only" | "read-write"`
- Connection names: `^[a-z0-9][a-z0-9-_]{0,62}$`, unique

**Secrets:** password only, in the OS keychain. Service `dbbridge`, account = connection name.
Never write passwords to disk, logs, stdout, or MCP responses.

## Driver Interface
```ts
interface Driver {
  ping(): Promise<void>;
  listDatabases(): Promise<string[]>;
  listTables(db?: string): Promise<{ name: string; type: string; rows?: number }[]>;
  describeTable(table: string, db?: string): Promise<TableSchema>;
  query(sql: string, opts: { params?: unknown[]; limit: number; timeoutMs: number; readOnly: boolean }):
    Promise<{ columns: { name: string; type: string }[]; rows: unknown[][]; durationMs: number }>;
  explain(sql: string): Promise<unknown>;
  close(): Promise<void>;
}
```
- Lazily create one pool per connection inside the MCP process and reuse it; close all on exit.
- MySQL: set `MAX_EXECUTION_TIME` per query; use `SET SESSION TRANSACTION READ ONLY` for read-only connections.
- ClickHouse: pass `readonly: 1` and `max_execution_time` settings per query on read-only connections; use `JSONCompact` format.
- Serialize BigInt, Date, Buffer safely (strings / ISO / base64).

## CLI Commands
### `dbbridge add`
1. Select type (MySQL / ClickHouse)
2. Prompt: name, host, port (default 3306 / 8123), database, user, password (masked), SSL (y/n)
3. Prompt: mode (default **read-only**), row limit (default 500)
4. Test the connection with a ping. On failure show the redacted error and offer: retry, edit fields, cancel.
5. On success, save the password to the keychain, then the config. If the config write fails, delete the keychain entry.

Also support non-interactive flags (`--type --name --host --port --database --user --ssl --mode`)
with the password from `--password-stdin` or the `DBBRIDGE_PASSWORD` env var, for scripting.

### Other commands
- `dbbridge list`: table of connections (no secrets); `--json` option
- `dbbridge test <name>`: ping and report latency
- `dbbridge edit <name>`: re-prompt with current values as defaults; re-test before saving
- `dbbridge remove <name>`: confirm, then delete config entry and keychain entry
- `dbbridge mcp`: start the MCP server over stdio. **Nothing but MCP protocol on stdout;** logs go to stderr.
- `dbbridge install <claude|cursor>`:
  - Claude Code: run or print `claude mcp add dbbridge -- dbbridge mcp`
  - Cursor: merge into `~/.cursor/mcp.json` without clobbering other servers:
    `{ "mcpServers": { "dbbridge": { "command": "dbbridge", "args": ["mcp"] } } }`

## MCP Tools
Every tool takes `connection` (a name). None accept credentials.

| Tool | Input | Output |
|---|---|---|
| `list_connections` | — | name, type, database, mode |
| `list_databases` | connection | database names |
| `list_tables` | connection, database? | table names, types, approx rows |
| `describe_table` | connection, table, database? | columns, types, nullability, keys, indexes |
| `sample_rows` | connection, table, database?, limit ≤ 50 | columns + rows |
| `run_query` | connection, sql, params? | columns, rows, rowCount, truncated, durationMs |
| `explain_query` | connection, sql | query plan |

Write tool descriptions so an agent knows to call `list_connections` and `describe_table` first,
and that results are capped.

Return results as compact JSON text content. Quote identifiers safely in `sample_rows`/`describe_table`;
never interpolate user strings into SQL there.

## Safety Rules
- New connections default to read-only. Suggest a DB user with read-only grants during `add`.
- `run_query` on read-only connections:
  - Allow only `SELECT`, `WITH … SELECT`, `SHOW`, `DESCRIBE`/`DESC`, `EXPLAIN`
  - Reject multiple statements, `SELECT … INTO OUTFILE/DUMPFILE`, `LOAD DATA`, locking reads (`FOR UPDATE`)
  - If parsing fails, **reject** (fail closed)
  - Defense in depth: DB-level read-only settings above apply even if the classifier is wrong
- Enforce the row limit (add or tighten `LIMIT`, or stop reading at limit + 1 to set `truncated`)
- Cap response size at 1 MB; truncate rows and set `truncated: true`
- Redact passwords and connection strings from all errors and logs
- Audit log at `~/.dbbridge/audit.log` (JSON lines: timestamp, connection, tool, sql, rowCount, durationMs, status). No result data.

## Errors
Typed codes, returned as MCP tool errors with an actionable message:
`CONNECTION_NOT_FOUND`, `SECRET_MISSING`, `AUTH_FAILED`, `CONNECTION_FAILED`,
`QUERY_REJECTED_READONLY`, `QUERY_PARSE_FAILED`, `TIMEOUT`, `QUERY_ERROR`.
Example: `QUERY_REJECTED_READONLY: "prod-mysql" is read-only; only SELECT/SHOW/DESCRIBE/EXPLAIN are allowed.`

## Testing
- **Unit:** read-only classifier with many edge cases (comments hiding statements, CTEs, mixed case,
  `INTO OUTFILE`, semicolons in strings, multi-statements, ClickHouse-specific syntax), limit injection,
  redaction, config read/write
- **Integration:** `docker-compose up` MySQL 8 + ClickHouse with seed data; exercise every tool end to end
- **MCP:** verify with `npx @modelcontextprotocol/inspector dbbridge mcp`
- Mock the keychain in CI

## Build Order
1. Config + keychain + registry
2. MySQL driver, then `add` / `list` / `test`
3. Safety module + tests
4. MCP server with all tools on MySQL
5. ClickHouse driver
6. `edit`, `remove`, `install`, audit log
7. README with setup and client config examples

## Acceptance Criteria
- `dbbridge add` saves working MySQL and ClickHouse connections; the password exists only in the keychain
- In Claude Code, an agent can list tables and run a SELECT using only the connection name
- Writes are rejected on read-only connections, both by the classifier and by the database
- No credentials appear in any MCP response, log, or config file
- `dbbridge mcp` prints nothing to stdout except MCP protocol messages
