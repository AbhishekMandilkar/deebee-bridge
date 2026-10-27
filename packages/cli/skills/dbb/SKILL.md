---
name: dbb
description: Ask your saved databases a question through deebeebridge, e.g. /dbb last logged in user, /dbb schema of orders
argument-hint: <question about your data or a table's schema>
disable-model-invocation: true
---

Answer this request with the deebeebridge MCP tools (`list_connections`, `list_tables`, `describe_table`, `run_query`). Each takes a saved connection *name*; hosts, users and passwords never enter the conversation.

Request (the text after the skill name): $ARGUMENTS

## Steps

1. **Project notes.** Read `.dbb.md` in the project root when it exists. It names this project's default connection, schema and tables, and what phrases like "last logged in user" mean.
2. **Connection.** Use the default from the notes. Without one, call `list_connections` and pick by name and database. Ask the user only when two connections fit equally well. An empty request ends here: list the connections and their tables.
3. **Table.** Take it from the notes when listed there; otherwise call `list_tables` and choose the best match for the request.
4. **Columns.** Call `describe_table` on every table you query, before the query. Column names come from its result.
5. **Answer.**
   - Schema question: summarize the `describe_table` result as columns (name, type, nullable), primary key and indexes.
   - Data question: run one `run_query`: SELECT only, the needed columns named, `ORDER BY` for "last", "latest" or "top", `LIMIT 20` unless the user asked for more.
6. **Reply** with the answer first, then one line: connection, table, and the SQL you ran. Done when the question is answered, or when you have stated exactly what blocked it.

## Rules

- Connections are read-only unless `list_connections` shows `mode: read-write`. On `QUERY_REJECTED_READONLY`, report it and stop.
- `truncated: true` in a result means more rows exist; say so.
- Select the columns the question needs. Credentials, hashes and tokens stay out of the output.
