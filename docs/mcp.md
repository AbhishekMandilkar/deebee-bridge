# MCP server

`deebeebridge mcp` runs a local [MCP](https://modelcontextprotocol.io) server over stdio. Agents use
saved connections ([connections.md](connections.md)) **by name only**; no tool accepts credentials, and
nothing but MCP protocol is written to stdout.

## Connect a client

```bash
claude mcp add deebeebridge -- deebeebridge mcp        # Claude Code
```

Cursor (`~/.cursor/mcp.json`):

```json
{ "mcpServers": { "deebeebridge": { "command": "deebeebridge", "args": ["mcp"] } } }
```

## Background HTTP server

`deebeebridge mcp` (stdio) exists only while its client runs. For a server that outlives the terminal:

```bash
deebeebridge mcp start     # detaches, prints the URL and copy-paste connect commands, exits
deebeebridge mcp status | logs [-n 50] | stop
deebeebridge mcp serve     # same server in the foreground (what `start` runs; handy under a process manager)
```

| | |
|---|---|
| Address | `http://127.0.0.1:<port>/mcp`, loopback only |
| Port | first free of: the last-used port, 43117, 38207, 29417 (`--port <n>` overrides). Clients keep the URL, so it stays stable across restarts |
| Auth | `Authorization: Bearer <token>`; the token is created on first start and kept in `server.json` (`0600`) with the port and pid |
| Refused | missing or wrong token (401), any `Origin` header (403, so web pages cannot drive it), a `Host` other than loopback on our port (403, DNS rebinding), bodies over 1 MB |
| Other paths | `GET /health` answers without a token and reveals nothing but the name |
| Files | `~/.deebeebridge/server.json`, `server.log` (trimmed past 1 MB on start) |

Claude Code: `claude mcp add --transport http deebeebridge http://127.0.0.1:43117/mcp --header "Authorization: Bearer <token>"`.
Cursor: `{"mcpServers":{"deebeebridge":{"url":"…/mcp","headers":{"Authorization":"Bearer <token>"}}}}`.

The server is stateless: each request gets a fresh MCP server over the shared connection pool, so restarting loses nothing.
Tools, limits and read-only rules are identical to stdio. Anyone holding the token can run read-only queries on every
saved connection, so treat it like a password (`server.json` has the same permissions as `secrets.json`). It does not
restart after a reboot, and detaching and stopping are only tested on macOS.

## Tools

Four tools, about 400 tokens of definitions in total (a test fails if the definitions exceed 3000 characters).
Every tool takes `connection`, the saved name. `schema` is the MySQL database / Postgres schema and defaults to the connection's own.

| Tool | Input | Result |
|---|---|---|
| `list_connections` | none | `[{name, type, database, mode}]` |
| `list_tables` | `connection`, `schema?` | `{columns: [name, type, rows], rows}`; `rows` is an approximate count |
| `describe_table` | `connection`, `table`, `schema?` | `{columns: [{name, type, nullable, default?}], primaryKey, indexes: [{name, columns, unique}]}` |
| `run_query` | `connection`, `sql`, `params?` | `{columns, rows, rowCount, truncated, durationMs}` |

Deliberately **not** separate tools: `list_databases`, `sample_rows` and `explain_query` (the original brief had them).
An agent can do each with `run_query` (`SHOW DATABASES`, `SELECT … LIMIT 5`, `EXPLAIN SELECT …`), and every
tool definition costs context on every session.

### Keeping output small

- Results are positional: `columns` once, then `rows` as arrays. No per-row keys, no pretty-printing.
- Rows are capped at the connection's `rowLimit` (default 500). The database stops producing rows at `limit + 1`,
  so `truncated: true` means more existed.
- The whole response is capped at 64 KB (`MAX_RESPONSE_CHARS` in `core/src/serialize.ts`), and a single cell at 2000 characters; oversized JSON documents and Buffers become clipped text with a `…(+N chars)` marker. A row that alone exceeds the budget is dropped and `truncated` is set.
- `bigint` → string, `Date` → ISO-8601, `Buffer` → `base64:…`.

### Errors

Failures return `isError: true` with text `CODE: message`, for example
`QUERY_REJECTED_READONLY: "prod" is read-only; only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN are allowed (delete statement).`
Codes are listed in `core/src/errors.ts`. Messages are redacted: `createDriver` wraps every driver so a password never appears in an error, whatever the database library wrote.

## Read-only enforcement

For `mode: "read-only"` connections there are two independent layers:

1. **Classifier** (`core/src/safety.ts`, `node-sql-parser`): exactly one statement, and it must be a
   `SELECT`/`WITH … SELECT`/`SHOW`/`DESCRIBE`, or `EXPLAIN` of a `SELECT`. Locking reads and `SELECT … INTO` are rejected
   wherever they appear (UNION branches, subqueries), as are MySQL `/*! … */` comments, which MySQL executes.
   Anything the parser cannot read is rejected (`QUERY_PARSE_FAILED`): it fails closed.
2. **Database**: Postgres runs each query inside `BEGIN READ ONLY`; MySQL sessions run `SET SESSION TRANSACTION READ ONLY`, awaited before the first query (a failure aborts the query).
   Integration tests send a `DELETE` straight to the driver to prove the database refuses it.

Neither layer replaces a database user with read-only grants. Functions with side effects outside the
database (Postgres `pg_sleep`, large reads, `LOAD_FILE` for users with `FILE`) are controlled by grants.

## Architecture

```
MCP client ─stdio─► cli/src/mcp/server.ts ─┐
MCP client ─HTTP──► cli/src/mcp/http.ts   ─┴► cli/src/mcp/tools.ts   (schemas, descriptions, error mapping)
                    (daemon.ts: start/stop/status/logs)
                                                   │
                                                   ▼
                              core/src/bridge.ts   createBridge(registry)
                                  one lazy driver per connection, classifier, output caps
                                                   │
                                                   ▼
                              core/src/drivers/*   Driver.listTables / describeTable / query
```

`tools.ts` has no logic beyond schema and error formatting, so another front end (for example a desktop app) can call `createBridge` directly.

## Testing

```bash
cd packages/cli  && bunx vitest run     # in-memory + HTTP MCP client: tool list, size budget, error mapping, token/Origin/Host guards, port fallback
cd packages/core && DEEBEEBRIDGE_TEST_PG=… DEEBEEBRIDGE_TEST_MYSQL=… bunx vitest run   # live: every tool path on both databases
npx @modelcontextprotocol/inspector deebeebridge mcp   # manual
```
