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
- **Timeouts**: `connectTimeout` is the connection's `timeoutMs` (default 15000). Per-query `MAX_EXECUTION_TIME` arrives with `query`.
- **SSL**: `ssl: true` enables TLS with certificate verification; private-CA servers fail with `CONNECTION_FAILED`.
- **Read-only mode**: each new pooled connection runs `SET SESSION TRANSACTION READ ONLY`. Not yet exercised by a test, because the `Driver` interface has no query method; it gets tested when `query` lands.
- **Errors**: `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR` → `AUTH_FAILED`; every other connect/ping failure → `CONNECTION_FAILED`. Passwords are redacted.

## Current scope

Only `ping` and `close`.

## Testing against a real server

```bash
docker compose up -d mysql   # first start takes a few seconds before it accepts connections
cd packages/core
DEEBEEBRIDGE_TEST_MYSQL=127.0.0.1:33069:app:root:secretpw bunx vitest run
```

Covers a successful ping, a wrong password (`AUTH_FAILED`, password not in the message) and an unreachable port (`CONNECTION_FAILED`).
