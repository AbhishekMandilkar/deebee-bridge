/**
 * Scripted examples for the Wire demo. Tool names, result shapes and the rejection text mirror the real
 * server (docs/mcp.md, core/src/safety.ts, core/src/bridge.ts). Row values are made up.
 */

export type StepStatus = "ok" | "blocked" | "skipped";

export interface TraceStep {
	label: string;
	detail: string;
	status: StepStatus;
	/** Marks the step that touches the keychain. */
	secret?: boolean;
}

export interface Scenario {
	id: string;
	prompt: string;
	toolCall: string;
	steps: TraceStep[];
	result: string;
	isError?: boolean;
	agentSays?: string;
}

/** What lives on the user's machine and must never show up in the agent's context. */
export const SECRETS = [
	{ label: "password", needle: "hunter2" },
	{ label: "user", needle: "readonly" },
	{ label: "host", needle: "db.example.com" },
] as const;

const REJECT = (why: string) =>
	`QUERY_REJECTED_READONLY: "app-db" is read-only; only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN are allowed (${why}).`;

export const SCENARIOS: Scenario[] = [
	{
		id: "tables",
		prompt: "Which tables are the biggest?",
		toolCall: 'list_tables { connection: "app-db" }',
		steps: [
			{
				label: "Resolve the name",
				detail: "app-db → postgres · db.example.com:5432 · app",
				status: "ok",
			},
			{
				label: "Unlock the password",
				detail: "read from the OS keychain, held in memory only",
				status: "ok",
				secret: true,
			},
			{
				label: "Ask the database",
				detail: "table and view list, read-only · 38 ms",
				status: "ok",
			},
			{
				label: "Trim the result",
				detail: "3 rows, well under the 500-row cap",
				status: "ok",
			},
		],
		result:
			'{"columns":["name","type","rows"],"rows":[["orders","table",1204331],["events","table",880412],["users","table",41207]]}',
	},
	{
		id: "revenue",
		prompt: "Revenue per day for the last three days",
		toolCall:
			'run_query { connection: "app-db", sql: "SELECT date_trunc(\'day\', created_at) AS day, sum(total) FROM orders GROUP BY 1 ORDER BY 1 DESC LIMIT 3" }',
		steps: [
			{
				label: "Resolve the name",
				detail: "app-db → postgres · db.example.com:5432 · app",
				status: "ok",
			},
			{
				label: "Unlock the password",
				detail: "read from the OS keychain, held in memory only",
				status: "ok",
				secret: true,
			},
			{
				label: "Check the SQL",
				detail: "one statement · SELECT · no locking read, no INTO",
				status: "ok",
			},
			{
				label: "Run it read-only",
				detail: "BEGIN READ ONLY … 41 ms",
				status: "ok",
			},
			{
				label: "Trim the result",
				detail: "3 rows, under the 500-row and 64 KB caps",
				status: "ok",
			},
		],
		result:
			'{"columns":["day","sum"],"rows":[["2026-10-19","48210.50"],["2026-10-18","51877.00"],["2026-10-17","39402.25"]],"rowCount":3,"truncated":false,"durationMs":41}',
	},
	{
		id: "delete",
		prompt: "Clean up the test users",
		toolCall:
			'run_query { connection: "app-db", sql: "DELETE FROM users WHERE email LIKE \'%@test.com\'" }',
		steps: [
			{
				label: "Resolve the name",
				detail: "app-db → postgres · db.example.com:5432 · app",
				status: "ok",
			},
			{
				label: "Unlock the password",
				detail: "read from the OS keychain, held in memory only",
				status: "ok",
				secret: true,
			},
			{
				label: "Check the SQL",
				detail: "delete statement, not on the allow-list",
				status: "blocked",
			},
			{
				label: "Run it read-only",
				detail: "not reached: nothing was sent to the database",
				status: "skipped",
			},
			{
				label: "Trim the result",
				detail: "not reached",
				status: "skipped",
			},
		],
		result: REJECT("delete statement"),
		isError: true,
	},
	{
		id: "sneaky",
		prompt: "Ping the database, then drop the old users table",
		toolCall:
			'run_query { connection: "app-db", sql: "SELECT 1; DROP TABLE users" }',
		steps: [
			{
				label: "Resolve the name",
				detail: "app-db → postgres · db.example.com:5432 · app",
				status: "ok",
			},
			{
				label: "Unlock the password",
				detail: "read from the OS keychain, held in memory only",
				status: "ok",
				secret: true,
			},
			{
				label: "Check the SQL",
				detail: "two statements in one call",
				status: "blocked",
			},
			{
				label: "Run it read-only",
				detail: "not reached: nothing was sent to the database",
				status: "skipped",
			},
			{
				label: "Trim the result",
				detail: "not reached",
				status: "skipped",
			},
		],
		result: REJECT("multiple statements"),
		isError: true,
	},
	{
		id: "password",
		prompt: "What's the database password?",
		toolCall: "list_connections {}",
		steps: [
			{
				label: "Read saved connections",
				detail: "names and settings from ~/.deebeebridge/connections.json",
				status: "ok",
			},
			{
				label: "Keep four fields",
				detail:
					"name · type · database · mode. Host, user and password are dropped",
				status: "ok",
			},
		],
		result:
			'[{"name":"app-db","type":"postgres","database":"app","mode":"read-only"}]',
		agentSays:
			'I only have a connection name, "app-db". None of my tools can return credentials.',
	},
];
