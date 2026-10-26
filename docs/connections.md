# Connections

A **connection** is a named, saved way to reach one database. You register it once with
`deebeebridge add`; afterwards everything (CLI, and later the MCP server) refers to it by
**name only**. Credentials never leave your machine and never reach an AI agent.

## Where things live

| What | Where | Notes |
|---|---|---|
| Non-secret settings | `~/.deebeebridge/connections.json` | file `0600`, dir `0700`, written atomically |
| Password | `~/.deebeebridge/secrets.json` (same permissions, plain text), keyed by connection name | never in `connections.json`, logs, or output |

Set `DEEBEEBRIDGE_HOME` to use a different directory (used by tests).

`connections.json`:

```json
{ "version": 1, "connections": [ {
  "name": "local-pg", "type": "postgres", "host": "localhost", "port": 5432,
  "database": "app", "user": "readonly", "ssl": false, "mode": "read-only",
  "rowLimit": 500, "timeoutMs": 15000, "createdAt": "2026-10-19T00:00:00Z"
} ] }
```

- `name`: `^[a-z0-9][a-z0-9-_]{0,62}$`, unique.
- `type`: one of the supported sources (see [postgres.md](postgres.md), [mysql.md](mysql.md)).
- `mode`: `read-only` (default) or `read-write`. Read-only is enforced again by the database where the source allows it.

## Commands

| Command | Does |
|---|---|
| `deebeebridge add` | Prompts for each field (flags skip prompts), pings the database, then saves. On failure: retry / edit / cancel. |
| `deebeebridge list [--json]` | Shows saved connections. No secrets. |
| `deebeebridge test <name>` | Connects with the stored password and reports latency. |
| `deebeebridge mcp` | Starts the stdio [MCP server](mcp.md). |

**From a URL:** `deebeebridge add --url - --name app-db` reads `scheme://user:password@host:port/database?sslmode=require`
from stdin (or pass `--url <url>`, or set `DEEBEEBRIDGE_URL`). The URL supplies type, host, port (else the source's default),
database, user, password and SSL; `mode` defaults to `read-only` and `rowLimit` to 500, and any explicit flag wins over the URL.
SSL turns on for `sslmode`/`ssl-mode` values `require`, `verify-ca`, `verify-full`, `required`, `verify_identity` or `ssl=true`; anything else
(including `prefer`) leaves it off. Error messages never repeat the URL. Parsing lives in `core/src/connection-url.ts`; each source
declares its schemes in `DriverDefinition.urlSchemes`.

Non-interactive `add`: pass `--type --name --host --port --database --user --ssl|--no-ssl --mode --row-limit`
and supply the password with `--password-stdin` or the `DEEBEEBRIDGE_PASSWORD` environment variable.

```bash
echo -n "$PW" | deebeebridge add --type postgres --name local-pg --host localhost \
  --port 5432 --database app --user readonly --no-ssl --mode read-only --password-stdin
```

Failures print `CODE: message` on stderr and exit 1. The message is redacted (password and
`scheme://user:pass@` URLs are masked). Codes are defined in `packages/core/src/errors.ts`.

## How it fits together

```
cli  (prompts, flags, output)            packages/cli/src/commands/*
 └─ core  Registry                       packages/core/src/registry.ts
      ├─ ConfigStore  connections.json   config.ts
      ├─ SecretStore  secrets.json         secrets.ts
      └─ drivers      one per source     drivers/index.ts  ──► drivers/<source>.ts
```

- **Registry** is the only thing that touches config and secrets. `add` writes the password
  first, then the config, and removes the password if the config write fails, so the two
  cannot drift apart. `open(name)` returns a ready `Driver`.
- **ConfigStore / SecretStore** are injected into `createRegistry({ config, secrets })`. Tests use a
  temp directory and `memorySecrets()`; production uses the defaults.
- **probe(config, password)** connects, pings, disconnects and returns latency. `add` uses it
  before saving; `test` uses it for stored connections. It redacts the password from any error.
- **cli is thin**: it never reads files directly. Anything needing the
  filesystem or a database driver belongs in `core`.

## Adding a new database source

A source is one `DriverDefinition` (`drivers/types.ts`):

```ts
export const mysqlDriver: DriverDefinition = {
  label: "MySQL",          // shown in the `add` type picker
  defaultPort: 3306,       // default offered by `add`
  urlSchemes: ["mysql"],   // accepted by `add --url`
  dialect: "mysql",        // grammar for the read-only classifier
  create(config, password) { /* return a Driver; connect lazily */ },
};
```

Steps:

1. Create `packages/core/src/drivers/<source>.ts` exporting a `DriverDefinition`.
   Map the library's errors to `BridgeError` (`AUTH_FAILED`, `CONNECTION_FAILED`, ...).
2. Register it in `packages/core/src/drivers/index.ts`: `export const drivers = { postgres, mysql }`.
3. Add the client library to **both** `packages/core/package.json` and `packages/cli/package.json`
   (the CLI bundle inlines `core`, so the CLI's copy is what npm users install).
4. Add a `docs/<source>.md` and a service in `docker-compose.yml`; add a `DEEBEEBRIDGE_TEST_<SOURCE>` entry in
   `packages/core/test/drivers.integration.test.ts` (ping, wrong password, unreachable host) and in
   `bridge.integration.test.ts` (introspection, row cap, read-only rejection by classifier and by the database).

Nothing else changes: the type picker, default port, schema validation, `add`, `list`, `test` and the
registry all read from `drivers`.

A `Driver` also implements `listTables`, `describeTable` and `query` (see `drivers/types.ts`) for the
[MCP server](mcp.md). `query` must stop reading at `limit + 1` rows, and the driver, not the caller, applies
database-level read-only settings from `config.mode`. `DriverDefinition.dialect` tells the read-only
classifier which SQL grammar to use.

## Testing

```bash
cd packages/core && bunx vitest run        # unit tests (temp dir + in-memory secrets)
DEEBEEBRIDGE_TEST_PG=localhost:54329:postgres:admin:secretpw \
DEEBEEBRIDGE_TEST_MYSQL=127.0.0.1:33069:app:root:secretpw bunx vitest run       # + live servers (docker compose up -d)
```
