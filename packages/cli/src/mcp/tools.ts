import { type Bridge, toBridgeError } from "@deebeebridge/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Tool text is paid for in every agent's context window on every session: keep
// descriptions and schemas terse, and results compact (positional rows, no pretty-print).

const connection = z.string();
const schema = z.string().optional();
const database = z.string().optional();

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (value: unknown): Result => ({
	content: [{ type: "text", text: JSON.stringify(value) }],
});

const fail = (err: unknown): Result => ({
	isError: true,
	content: [
		{ type: "text", text: String(toBridgeError(err, [], "QUERY_ERROR")) },
	],
});

export function registerTools(server: McpServer, bridge: Bridge): void {
	const readOnly = { readOnlyHint: true };
	const run = async (fn: () => Promise<unknown>): Promise<Result> => {
		try {
			return ok(await fn());
		} catch (err) {
			return fail(err);
		}
	};

	server.registerTool(
		"list_connections",
		{
			description:
				"List saved database connections (name, type, default database, mode). Call first; other tools take a connection name. A connection can hold several databases: see list_databases.",
			annotations: readOnly,
		},
		() => run(() => bridge.listConnections()),
	);

	server.registerTool(
		"list_databases",
		{
			description:
				"List the databases on a connection's server. Other tools take database to use one; default is the connection's own.",
			inputSchema: { connection },
			annotations: readOnly,
		},
		(a) => run(() => bridge.listDatabases(a.connection)),
	);

	server.registerTool(
		"list_tables",
		{
			description:
				"List tables and views with approximate row counts. schema (Postgres) and database default to the connection's own.",
			inputSchema: { connection, schema, database },
			annotations: readOnly,
		},
		(a) => run(() => bridge.listTables(a.connection, a.schema, a.database)),
	);

	server.registerTool(
		"describe_table",
		{
			description:
				"Columns, primary key and indexes of a table. Call before writing SQL.",
			inputSchema: { connection, table: z.string(), schema, database },
			annotations: readOnly,
		},
		(a) =>
			run(() =>
				bridge.describeTable(a.connection, a.table, a.schema, a.database),
			),
	);

	server.registerTool(
		"run_query",
		{
			description:
				"Run one SQL statement. Read-only connections accept only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN. Bind values via params ($1 on Postgres, ? on MySQL). Output is capped (see truncated): select needed columns and add LIMIT. database picks another database; MySQL also reaches others as db.table.",
			inputSchema: {
				connection,
				sql: z.string(),
				params: z
					.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
					.optional(),
				database,
			},
		},
		(a) =>
			run(() => bridge.runQuery(a.connection, a.sql, a.params, a.database)),
	);
}
