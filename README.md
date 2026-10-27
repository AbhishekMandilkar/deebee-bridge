# deebeebridge

Give AI coding agents access to your databases **without giving them your credentials**.

You register a connection once. The password is saved in a private file on your machine (`0600`). Claude Code, Cursor or any
MCP client then reaches the database by **connection name** through a local server, and can list
tables, read schemas and run queries. Writes are blocked unless you allow them.

Supports **PostgreSQL** and **MySQL**. ClickHouse is planned.

## Install

Requires Node 20+.

```bash
npm i -g deebeebridge
deebeebridge --help
```

This installs two identical commands: `deebeebridge` and the short alias `dbb`.

To run from source instead (needs [Bun](https://bun.sh)):

```bash
git clone https://github.com/AbhishekMandilkar/deebee-bridge.git && cd deebee-bridge
bun install
cd packages/cli && bun run build
ln -s "$PWD/dist/cli.js" ~/.local/bin/deebeebridge   # any directory on your PATH
```

## Use it

**1. Save a connection** (interactive; the password prompt is masked):

```bash
deebeebridge add
```

Or paste a connection URL (Postgres: `postgres://` or `postgresql://`; MySQL: `mysql://`). It supplies the
host, port, database, user, password and SSL setting; only the connection name is left to type:

```bash
echo 'postgresql://user:pass@db.example.com/app?sslmode=require' | deebeebridge add --url - --name app-db
```

`--url -` reads the URL from stdin, and `DEEBEEBRIDGE_URL` works too. Avoid `--url '<url>'` on the command
line: the password would sit in your shell history and process list. Flags such as `--mode read-write` override the URL.
Special characters in the password must be percent-encoded (`@` → `%40`).

Or in a script, with flags and the password on stdin:

```bash
echo -n "$DB_PASSWORD" | deebeebridge add --type postgres --name app-db \
  --host db.example.com --port 5432 --database app --user readonly \
  --ssl --mode read-only --row-limit 500 --password-stdin
```

`add` tests the connection before saving. New connections default to `read-only`.
Prefer a database user that only has `SELECT` grants ([examples](docs/postgres.md)).

**2. Check it:**

```bash
deebeebridge list          # table of saved connections (add --json for scripts)
deebeebridge test app-db   # connects and prints latency
```

**3. Connect your agent:**

```bash
claude mcp add deebeebridge -- deebeebridge mcp     # Claude Code
```

Cursor, in `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "deebeebridge": { "command": "deebeebridge", "args": ["mcp"] } } }
```

**Optional: one background server instead.** `deebeebridge mcp` talks over stdio and lives only as long as
its client. Run `deebeebridge mcp start` for a server that keeps running after you close the terminal;
it prints the URL and the exact command for your client:

```bash
deebeebridge mcp start     # MCP server running at http://127.0.0.1:43117/mcp (pid 4821) + connect commands
deebeebridge mcp status    # running? where?
deebeebridge mcp logs      # tail of ~/.deebeebridge/server.log
deebeebridge mcp stop
```

It listens on `127.0.0.1` only, on an uncommon port (43117, then 38207 or 29417 if taken; the last one used
is tried first so the URL stays the same). Every request needs the bearer token that `start` prints (kept
in `~/.deebeebridge/server.json`, mode `0600`); browser requests are refused. It does not restart after a reboot.

Then ask the agent something like *"Using the app-db connection, which tables have the most rows?"*
It never sees a host, user or password, only the name.

**4. Optional: the `/dbb` shortcut.** Install a skill so you can type `/dbb pls check last logged in user`
instead of spelling out the connection and tables:

```bash
deebeebridge skill install      # Claude Code, Cursor and Codex, whichever are on this machine (global)
```

Put per-project hints (default connection, key tables) in a `.dbb.md` at the project root. Details: [skill](docs/skill.md).

## What the agent gets

Four small tools (about 400 tokens of definitions), each taking the connection name:

| Tool | Returns |
|---|---|
| `list_connections` | name, type, database, mode of each saved connection |
| `list_tables` | tables and views with approximate row counts |
| `describe_table` | columns, types, nullability, primary key, indexes |
| `run_query` | `columns` and `rows`, plus `rowCount`, `truncated`, `durationMs` |

Results stay small on purpose: rows are capped at the connection's row limit (default 500), each cell
at 2000 characters, each response at 64 KB, and `truncated` tells the agent when it was cut.
Details: [docs/mcp.md](docs/mcp.md).

## How it works

```
Agent ──MCP over stdio──► deebeebridge mcp ──► driver (pg / mysql2) ──► your database
                               │
                               ├─ ~/.deebeebridge/connections.json   host, port, user, mode… (no passwords)
                               └─ ~/.deebeebridge/secrets.json       passwords (plain text, file mode 0600)
```

- **Credentials:** only the connection *name* crosses the MCP boundary. Passwords live in `secrets.json`, readable
  only by you (like `~/.ssh` keys or `~/.pgpass`), and are masked from every error message and log line.
  Anyone who can read your home directory can read them; use a database user with read-only grants.
- **Read-only connections** are enforced twice. A SQL parser allows only one `SELECT`, `WITH … SELECT`,
  `SHOW`, `DESCRIBE` or `EXPLAIN` statement and rejects anything it cannot parse. The database then
  refuses writes itself (Postgres `READ ONLY` transaction, MySQL read-only session).
- **Read-write connections** accept any statement; use them deliberately.
- **stdout** of `deebeebridge mcp` carries MCP protocol only.

Deeper: [connections](docs/connections.md) · [PostgreSQL](docs/postgres.md) · [MySQL](docs/mysql.md) · [MCP server](docs/mcp.md) · [`/dbb` skill](docs/skill.md) · [design and roadmap](SPEC.md).

## Configuration

| Setting | Default |
|---|---|
| Config directory | `~/.deebeebridge/` (override with `DEEBEEBRIDGE_HOME`) |
| Passwords | `<config directory>/secrets.json`, one entry per connection name |
| Password for non-interactive `add` | `--password-stdin`, `DEEBEEBRIDGE_PASSWORD`, or inside the `--url` |
| Connection URL for `add` | `--url <url>`, `--url -` (stdin) or `DEEBEEBRIDGE_URL` |

## Status

Built: `add`, `list`, `test`, `mcp`, Postgres and MySQL. Planned: `edit`, `remove`, `install claude|cursor`,
audit log, ClickHouse. Known gaps are listed at the bottom of [SPEC.md](SPEC.md).

## Develop

Bun workspaces + Turborepo: `packages/core` (all logic), `packages/cli` (the `deebeebridge` binary),
`apps/web` ([landing site](apps/web/README.md)), `packages/ui`, `packages/config`.

```bash
bun run check-types && bun run build     # whole repo
cd packages/core && bunx vitest run      # unit tests
docker compose up -d                     # Postgres + MySQL for the live tests
DEEBEEBRIDGE_TEST_PG=localhost:54329:postgres:admin:secretpw \
DEEBEEBRIDGE_TEST_MYSQL=127.0.0.1:33069:app:root:secretpw bunx vitest run
```

Run Biome on the files you touch (`bunx biome check --write <paths>`), not `bun run check`: the web
scaffold is 2-space indented and the root command would reformat about 46 of its files.
To add a database, see [Adding a new database source](docs/connections.md#adding-a-new-database-source).

## License

[MIT](LICENSE)
