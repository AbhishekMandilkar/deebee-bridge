# The `/dbb` skill

A skill that turns "check the last logged in user" into the right tool calls, so you stop spelling out
the connection, table and columns every time. Type `/dbb <question>` in your coding agent:

```
/dbb pls check last logged in user
/dbb how is the schema of the orders table
/dbb                                  # no question: lists your connections and their tables
```

The agent follows the skill: pick the connection, find the table, `describe_table`, run one read-only
query with a small `LIMIT`, answer, then show the SQL it ran. Source: `packages/cli/skills/dbb/SKILL.md`.

## Install (global)

```bash
deebeebridge skill install              # every tool found on this machine
deebeebridge skill install claude       # or name them: claude, cursor, codex
```

| Tool | Installed to | Invoke |
|---|---|---|
| Claude Code | `~/.claude/skills/dbb/` | `/dbb <question>` |
| Cursor | `~/.cursor/skills/dbb/` | `/dbb <question>` |
| Codex | `~/.agents/skills/dbb/` (plus `agents/openai.yaml`, which makes it manual-only) | `$dbb <question>` |

It always writes to your home directory, never into a project, and replaces an earlier copy, so run it
again after upgrading deebeebridge. Open sessions need a restart to see it.
After `add` and `mcp start`, an interactive terminal shows a one-line tip to run `skill install`; it disappears once every tool found has the skill, and it never prints in scripts or pipes.
Which tools are "found": their config directory exists (`~/.claude`, `~/.cursor`, `~/.codex`).
The skill is manual-only (`disable-model-invocation`), so it adds nothing to your agent's context until you type `/dbb`.

## Per-project notes: `.dbb.md`

The skill is the same everywhere; what differs per project goes in a `.dbb.md` file at the project root,
which the skill reads first. Commit it so your team's agents share it. Plain Markdown, for example:

```markdown
- Default connection: `app-db`
- Schema: `public`
- Tables:
  - `users` (`id`, `email`, `last_login_at`): "last logged in user" = newest `last_login_at`
  - `orders` (`id`, `user_id`, `status`, `created_at`): "recent orders" = newest by `created_at`
- Users live in a different database: `common.USER` (`id`, `full_name`, `email`); resolve `createdBy` with
  `JOIN common.USER u ON u.id = c.createdBy`.
- Ignore the `audit_*` tables.
```

Without a `.dbb.md` the skill calls `list_connections` and `list_tables` and picks the best match.

## Adding another tool

One entry in `SKILL_TARGETS` (`packages/core/src/skill-install.ts`): its config directory, user-level skills
directory, how it is invoked, and any extra files it needs.
