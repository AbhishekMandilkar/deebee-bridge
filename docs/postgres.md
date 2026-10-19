# PostgreSQL

`type: "postgres"`, implemented in `packages/core/src/drivers/postgres.ts` on top of
[`pg`](https://node-postgres.com). Read [connections.md](connections.md) first for how
connections are stored and used.

## Adding a connection

```bash
deebeebridge add
# Database type → PostgreSQL, then name, host, port (default 5432), database, user, password, SSL, mode, row limit
deebeebridge test <name>
```

Non-interactive: see the example in [connections.md](connections.md).

Create a dedicated database user with read-only grants rather than reusing an admin account:

```sql
CREATE ROLE agent_ro LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE app TO agent_ro;
GRANT USAGE ON SCHEMA public TO agent_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agent_ro;
```

## What the driver does

- **Lazy pool**: nothing connects until a method is called; one `pg.Pool` (max 4) per driver, closed by `close()`.
- **Timeouts**: `connectionTimeoutMillis` and `statement_timeout` are both the connection's `timeoutMs` (default 15000).
- **SSL**: `ssl: true` enables TLS with certificate verification (`pg` default). Servers with a
  private CA or self-signed certificate will fail with `CONNECTION_FAILED` until custom CA support is added.
- **Read-only mode**: connections with `mode: "read-only"` start every session with
  `default_transaction_read_only=on`, so the database rejects writes even if a statement slips past
  any client-side check. (A session can still `SET` it back; a read-only grant on the user is the real guarantee.)
- **Errors**: SQLSTATE `28000`/`28P01` → `AUTH_FAILED`; every other connect/ping failure
  (refused, DNS, timeout, unknown database) → `CONNECTION_FAILED`. Passwords are redacted.

## Current scope

Only `ping` and `close` are implemented. Listing databases/tables, describing tables and running
queries arrive with the MCP tools and extend the `Driver` interface.

## Testing against a real server

```bash
docker compose up -d postgres
cd packages/core
DEEBEEBRIDGE_TEST_PG=localhost:54329:postgres:admin:secretpw bunx vitest run
```

The live tests (`test/drivers.integration.test.ts`) cover a successful ping, a wrong password
(`AUTH_FAILED`, password not in the message) and an unreachable port (`CONNECTION_FAILED`).
They are skipped when `DEEBEEBRIDGE_TEST_PG` is unset.
