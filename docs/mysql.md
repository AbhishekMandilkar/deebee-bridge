# MySQL

`type: "mysql"`, implemented in `packages/core/src/drivers/mysql.ts` on top of
[`mysql2`](https://sidorares.github.io/node-mysql2/docs). Read [connections.md](connections.md) first.

## Adding a connection

```bash
deebeebridge add          # Database type → MySQL; default port 3306
deebeebridge test <name>  # connects and reports latency
```

Use a dedicated user with read-only grants:

```sql
CREATE USER 'agent_ro'@'%' IDENTIFIED BY '...';
GRANT SELECT ON app.* TO 'agent_ro'@'%';
```

## What the driver does

- **Lazy pool**: nothing connects until a method is called; one `mysql2` pool (max 4), closed by `close()`.
- **Timeouts**: `connectTimeout` and the session `MAX_EXECUTION_TIME` are the connection's `timeoutMs` (default 15000). `MAX_EXECUTION_TIME` only applies to `SELECT`, which is all a read-only connection can run.
- **SSL**: `ssl: true` enables TLS with certificate verification; private-CA servers fail with `CONNECTION_FAILED`.
- **Read-only mode**: each new pooled connection runs `SET SESSION TRANSACTION READ ONLY`; an integration test sends a `DELETE` past the classifier and expects the database to refuse it.
- **Errors**: `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR` → `AUTH_FAILED`; every other connect/ping failure → `CONNECTION_FAILED`. Passwords are redacted.

## Queries and introspection

- `query` collects row events and stops at `limit + 1`; when the limit is hit the connection is dropped so the server stops producing rows.
  Statements without a result set (read-write connections) return `{columns: ["affectedRows"], rows: [[n]]}`.
- `listTables`/`describeTable` read `information_schema` (`TABLES`, `COLUMNS`, `STATISTICS`); names are bind parameters.
  `schema` defaults to `DATABASE()`. Row counts are InnoDB estimates.
- Bind values with `?` ([mcp.md](mcp.md) for the tools that use this).

## Testing against a real server

```bash
docker compose up -d mysql   # first start takes a few seconds before it accepts connections
cd packages/core
DEEBEEBRIDGE_TEST_MYSQL=127.0.0.1:33069:app:root:secretpw bunx vitest run
```

Covers a successful ping, a wrong password (`AUTH_FAILED`, password not in the message) and an unreachable port (`CONNECTION_FAILED`).
