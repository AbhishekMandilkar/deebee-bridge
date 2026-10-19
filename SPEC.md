# deebeebridge: CLI + MCP server for databases

> Living design doc. It started as an implementation brief and now records what is built and what
> is planned. When a better design appears, build it and update this file. Details live in [`docs/`](docs/connections.md).

## Goal
Stop pasting database credentials into AI agents. Users register connections once through an
interactive CLI. Passwords live in the OS keychain. A local stdio MCP server exposes those
connections **by name only** to Claude Code, Cursor and other MCP clients, with small outputs so
agents' context windows stay free.

## Scope
**Built:** PostgreSQL and MySQL; `add`, `list`, `test`, `mcp`; four MCP tools; read-only enforcement.
**Planned:** `edit`, `remove`, `install <claude|cursor>`, audit log, ClickHouse driver.
**Out of scope:** GUI/desktop app (core is kept protocol-free so one could reuse it), HTTP transport, cloud sync.

## Design rules
- Adding a database source is one `DriverDefinition` file plus one registry line ([connections.md](docs/connections.md)).
- Needs keychain, filesystem or a database driver → `packages/core`. Argument parsing, prompts, MCP wiring → `packages/cli`. Browser-safe → `apps/web`, `packages/ui`.
- Never write passwords to disk, logs, stdout or MCP responses. Every driver error is masked in one place (`redactErrors`).
- stdout of `deebeebridge mcp` is MCP protocol only.
- Tool definitions and results are paid for in every agent session: keep them terse ([mcp.md](docs/mcp.md)).

## Tech stack
TypeScript (ESM, Node 20+), Bun workspaces + Turborepo, `commander`, `@inquirer/prompts`,
`@modelcontextprotocol/sdk`, `@napi-rs/keyring`, `pg` + `pg-cursor`, `mysql2`, `zod`, `node-sql-parser`, `vitest`, `tsup`.
The npm package is `deebeebridge` (`packages/cli`); `@deebeebridge/core` is private and bundled into it.

## Layout
```
packages/core/src
  connection.ts   zod schema, name rule      config.ts    ~/.deebeebridge/connections.json (0600, atomic)
  secrets.ts      keychain / in-memory       registry.ts  connection CRUD over config + secrets
  drivers/        types.ts, index.ts, postgres.ts, mysql.ts
  safety.ts       read-only classifier       serialize.ts value + size caps
  bridge.ts       what an agent may do with a named connection
  errors.ts       typed codes + redaction
packages/cli/src
  cli.ts, commands/{add,list,test,mcp}.ts, mcp/{server,tools}.ts
```

## Data model
`~/.deebeebridge/connections.json` (override the directory with `DEEBEEBRIDGE_HOME`):
`name` (`^[a-z0-9][a-z0-9-_]{0,62}$`, unique), `type` (a key of `drivers`), `host`, `port`, `database`, `user`,
`ssl`, `mode` (`read-only` default | `read-write`), `rowLimit` (500), `timeoutMs` (15000), `createdAt`.
Password: OS keychain, service `deebeebridge`, account = connection name.

## Driver interface (`drivers/types.ts`)
`ping`, `listTables(schema?)`, `describeTable(table, schema?)`, `query(sql, {params?, limit})`, `close`.
Results are positional (`{columns: string[], rows: unknown[][]}`). `query` reads at most `limit + 1` rows.
The driver applies database-level read-only and timeout settings from its own config.

## CLI
- `add`: prompts for type, name, host, port, database, user, password, SSL, mode, row limit (flags skip prompts; password via `--password-stdin` or `DEEBEEBRIDGE_PASSWORD`). Pings first; on failure offers retry / edit / cancel. Saves keychain first, then config, and undoes the keychain entry if config fails.
- `list [--json]`, `test <name>`, `mcp`.
- Planned: `edit`, `remove`, `install claude|cursor` (`claude mcp add deebeebridge -- deebeebridge mcp`; merge into `~/.cursor/mcp.json` without clobbering other servers).

## MCP tools
Four tools, every one takes `connection` (a name; no tool accepts credentials):
`list_connections`, `list_tables(schema?)`, `describe_table(table, schema?)`, `run_query(sql, params?)`.
`list_databases`, `sample_rows` and `explain_query` were dropped on purpose: `run_query` covers them and each tool costs context.
Output is compact JSON. Rows are capped at the connection's `rowLimit`, cells at 2000 characters, responses at 64 KB, each with `truncated` set.

## Safety
- New connections are read-only. Two layers on read-only connections:
  1. Classifier (`safety.ts`): one statement; `SELECT`/`WITH…SELECT`/`SHOW`/`DESCRIBE`, or `EXPLAIN` of a `SELECT`. Rejects `INTO`, locking reads (anywhere in the tree, including UNION branches and subqueries), MySQL version-conditional comments, and anything unparseable (fails closed).
  2. Database: Postgres `BEGIN READ ONLY` per query; MySQL `SET SESSION TRANSACTION READ ONLY`, confirmed before the first query on each connection.
- A database user with read-only grants remains the real guarantee; the CLI suggests one.
- Planned: audit log `~/.deebeebridge/audit.log` (JSON lines: timestamp, connection, tool, sql, rowCount, durationMs, status; no result data).

## Errors
`CONNECTION_NOT_FOUND`, `CONNECTION_EXISTS`, `INVALID_CONNECTION`, `SECRET_MISSING`, `AUTH_FAILED`, `CONNECTION_FAILED`,
`QUERY_REJECTED_READONLY`, `QUERY_PARSE_FAILED`, `TIMEOUT`, `QUERY_ERROR`.
MCP returns `isError: true` with `CODE: message`.

## Testing
Unit: classifier edge cases, serialization caps, redaction, config and registry (temp dir + in-memory secrets), MCP tool list, size budget and error mapping.
Live: `docker compose up -d`, then run core tests with `DEEBEEBRIDGE_TEST_PG` / `DEEBEEBRIDGE_TEST_MYSQL` ([connections.md](docs/connections.md#testing)).
Manual: `npx @modelcontextprotocol/inspector deebeebridge mcp`.

## Known gaps
`describe_table` output is not size-capped. `EXPLAIN` of non-SELECT statements and the MySQL `EXPLAIN <table>` synonym are rejected. Postgres `FOR UPDATE` and writable CTEs fail to parse and so surface as `QUERY_PARSE_FAILED`. TLS with a private CA is not supported yet.
