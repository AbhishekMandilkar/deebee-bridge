import { type Bridge, BridgeError, redact } from "@deebeebridge/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Tool text is paid for in every agent's context window on every session: keep
// descriptions and schemas terse, and results compact (positional rows, no pretty-print).

const connection = z.string();
const schema = z.string().optional();

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (value: unknown): Result => ({
	content: [{ type: "text", text: JSON.stringify(value) }],
});

const fail = (err: unknown): Result => ({
	isError: true,
	content: [
		{
			type: "text",
			text:
				err instanceof BridgeError
					? String(err)
					: `QUERY_ERROR: ${redact(err instanceof Error ? err.message : String(err))}`,
		},
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
				"List saved database connections (name, type, database, mode). Call first; other tools take a connection name.",
			annotations: readOnly,
		},
		() => run(() => bridge.listConnections()),
	);

	server.registerTool(
		"list_tables",
		{
			description:
				"List tables and views with approximate row counts. schema defaults to the connection's own.",
			inputSchema: { connection, schema },
			annotations: readOnly,
		},
		(a) => run(() => bridge.listTables(a.connection, a.schema)),
	);

	server.registerTool(
		"describe_table",
		{
			description:
				"Columns, primary key and indexes of a table. Call before writing SQL.",
			inputSchema: { connection, table: z.string(), schema },
			annotations: readOnly,
		},
		(a) => run(() => bridge.describeTable(a.connection, a.table, a.schema)),
	);

	server.registerTool(
		"run_query",
		{
			description:
				"Run one SQL statement. Read-only connections accept only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN. Bind values via params ($1 on Postgres, ? on MySQL). Output is capped (see truncated): select needed columns and add LIMIT.",
			inputSchema: {
				connection,
				sql: z.string(),
				params: z
					.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
					.optional(),
			},
		},
		(a) => run(() => bridge.runQuery(a.connection, a.sql, a.params)),
	);
}
