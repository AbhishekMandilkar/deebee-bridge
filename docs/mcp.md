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

## Tools

Four tools, about 400 tokens of definitions in total (a test fails if the definitions exceed 3000 characters).
Every tool takes `connection`, the saved name. `schema` is the MySQL database / Postgres schema and defaults to the connection's own.

| Tool | Input | Result |
|---|---|---|
| `list_connections` | none | `[{name, type, database, mode}]` |
| `list_tables` | `connection`, `schema?` | `{columns: [name, type, rows], rows}`; `rows` is an approximate count |
| `describe_table` | `connection`, `table`, `schema?` | `{columns: [{name, type, nullable, default?}], primaryKey, indexes: [{name, columns, unique}]}` |
| `run_query` | `connection`, `sql`, `params?` | `{columns, rows, rowCount, truncated, durationMs}` |

Deliberately **not** separate tools: `list_databases`, `sample_rows` and `explain_query` from `SPEC.md`.
An agent can do each with `run_query` (`SHOW DATABASES`, `SELECT … LIMIT 5`, `EXPLAIN SELECT …`), and every
tool definition costs context on every session.

### Keeping output small

- Results are positional: `columns` once, then `rows` as arrays. No per-row keys, no pretty-printing.
- Rows are capped at the connection's `rowLimit` (default 500). The database stops producing rows at `limit + 1`,
  so `truncated: true` means more existed.
- The whole response is capped at 64 KB (`MAX_RESPONSE_CHARS` in `core/src/serialize.ts`), and a single cell at 2000 characters.
- `bigint` → string, `Date` → ISO-8601, `Buffer` → `base64:…`.

### Errors

Failures return `isError: true` with text `CODE: message`, for example
`QUERY_REJECTED_READONLY: "prod" is read-only; only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN are allowed (delete statement).`
Codes are listed in `core/src/errors.ts`. Messages are redacted.

## Read-only enforcement

For `mode: "read-only"` connections there are two independent layers:

1. **Classifier** (`core/src/safety.ts`, `node-sql-parser`): exactly one statement, and it must be a
   `SELECT`/`WITH … SELECT`/`SHOW`/`DESCRIBE`, or `EXPLAIN` of a `SELECT`. Locking reads and `SELECT … INTO` are rejected.
   Anything the parser cannot read is rejected (`QUERY_PARSE_FAILED`): it fails closed.
2. **Database**: Postgres runs each query inside `BEGIN READ ONLY`; MySQL sessions run `SET SESSION TRANSACTION READ ONLY`.
   Integration tests send a `DELETE` straight to the driver to prove the database refuses it.

Neither layer replaces a database user with read-only grants. Functions with side effects outside the
database (Postgres `pg_sleep`, large reads, `LOAD_FILE` for users with `FILE`) are controlled by grants.

## Architecture

```
MCP client ─stdio─► cli/src/mcp/server.ts ─► cli/src/mcp/tools.ts   (schemas, descriptions, error mapping)
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
cd packages/cli  && bunx vitest run     # in-memory MCP client: tool list, size budget, error mapping, no secrets
cd packages/core && DEEBEEBRIDGE_TEST_PG=… DEEBEEBRIDGE_TEST_MYSQL=… bunx vitest run   # live: every tool path on both databases
npx @modelcontextprotocol/inspector deebeebridge mcp   # manual
```
