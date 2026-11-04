import { ArrowDown, ArrowRight } from "lucide-react";

import { GlowGrid } from "./glow-grid";
import { at } from "./motion";
import { InlineCode, Section } from "./shared";
import { Stage } from "./stage";

const flow = [
	{ name: "Your agent", detail: "Claude Code, Cursor or any MCP client" },
	{
		name: "deebeebridge mcp",
		detail: "Local server, started by the agent over stdio",
	},
	{ name: "Database driver", detail: "pg or mysql2, with a read-only session" },
	{ name: "Your database", detail: "PostgreSQL or MySQL" },
];

/* What crosses each hop while its box is lit. Decorative: the boxes and the
 * copy around them carry the same facts. */
const wire = [
	'run_query { connection: "app-db", sql: "SELECT …" }',
	'resolve "app-db" → host, user, password from secrets.json',
	"read-only session · one SELECT, parsed and allowed",
	"rows back · capped at 500 · truncated flag if cut",
];

/* The request loop starts once the boxes have arrived, then spends 1.2s on each
 * hop of a 6s cycle (see the flow-* keyframes in index.css). */
const FLOW_AT = 900;
const HOP = 1200;

const stores = [
	{
		name: "~/.deebeebridge/connections.json",
		detail: "Host, port, database, user, mode. No passwords.",
	},
	{
		name: "secrets.json",
		detail: "Passwords (plain text, mode 0600), one entry per connection name.",
	},
];

const tools = [
	[
		"list_connections",
		"Name, type, database and mode of each saved connection",
	],
	["list_databases", "The databases on the connection's server"],
	["list_tables", "Tables and views with approximate row counts"],
	["describe_table", "Columns, types, nullability, primary key, indexes"],
	["run_query", "Columns and rows, plus rowCount, truncated and durationMs"],
] as const;

const guarantees = [
	{
		title: "Names, not credentials",
		body: "Only the connection name crosses the MCP boundary. Passwords are masked from every error message and log line.",
	},
	{
		title: "Read-only, enforced twice",
		body: "A SQL parser allows one SELECT, WITH … SELECT, SHOW, DESCRIBE or EXPLAIN and rejects anything it cannot parse. Then the database refuses writes itself.",
	},
	{
		title: "Small on purpose",
		body: "Rows are capped at 500 by default, cells at 2,000 characters and responses at 64 KB, with a truncated flag. Five tools cost about 600 tokens.",
	},
];

function RequestPath() {
	return (
		// Loops only while on screen.
		<Stage once={false}>
			<h3 className="sr-only">Request path</h3>
			<ol className="relative grid list-none gap-0 border border-border md:grid-cols-4">
				{flow.map((step, i) => (
					<li
						key={step.name}
						className="relative border-t border-border first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0"
					>
						<span
							aria-hidden
							className="flow-box pointer-events-none absolute inset-0 bg-foreground/[0.06]"
							style={at(FLOW_AT + i * HOP)}
						/>
						<div className="beat relative p-5" style={at(i * 90)}>
							<p className="font-mono text-xs text-text-subtle" aria-hidden>
								{i + 1}
							</p>
							<p className="mt-2 font-mono text-sm font-medium text-foreground">
								{step.name}
							</p>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
								{step.detail}
							</p>
						</div>
						{i < flow.length - 1 ? (
							<span
								aria-hidden
								className="beat absolute -bottom-3 left-5 z-10 flex size-6 items-center justify-center border border-border bg-background text-text-subtle md:top-1/2 md:right-0 md:bottom-auto md:left-auto md:-translate-y-1/2 md:translate-x-1/2"
								style={at(i * 90 + 140)}
							>
								{/* Flashes as the request crosses this hop. */}
								<span
									className="flow-hop absolute -inset-px border border-foreground bg-foreground/15"
									style={at(FLOW_AT + (i + 1) * HOP - 250)}
								/>
								<ArrowDown className="relative size-3.5 md:hidden" />
								<ArrowRight className="relative hidden size-3.5 md:block" />
							</span>
						) : null}
					</li>
				))}
				{/* The request itself: a bar that steps along the bottom edge, one column per hop. */}
				<li
					aria-hidden
					className="flow-bar pointer-events-none absolute bottom-0 left-0 hidden h-0.5 w-1/4 bg-foreground md:block"
					style={at(FLOW_AT)}
				/>
			</ol>
			<div
				aria-hidden
				className="beat mt-4 flex items-center gap-4 border border-border bg-surface px-4 py-3 font-mono text-xs motion-reduce:hidden"
				style={at(flow.length * 90 + 100)}
			>
				<span className="flex shrink-0 items-center gap-2 tracking-wide text-text-subtle uppercase">
					<span className="size-1.5 bg-foreground motion-safe:animate-pulse" />
					On the wire
				</span>
				<span className="grid min-w-0 flex-1">
					{wire.map((w, i) => (
						<span
							key={w}
							className="flow-text col-start-1 row-start-1 truncate text-foreground"
							style={at(FLOW_AT + i * HOP)}
						>
							{w}
						</span>
					))}
				</span>
			</div>
		</Stage>
	);
}

export function HowItWorks() {
	return (
		<Section
			id="how-it-works"
			index="03"
			label="How it works"
			title="A local MCP server that only knows names."
			lead="The agent starts deebeebridge as a child process. It resolves the name, reads the password from your private secrets file, and talks to the database for you."
		>
			<div className="space-y-16">
				<div>
					<RequestPath />
					<Stage className="mt-4 grid gap-4 md:grid-cols-2">
						{stores.map((s, i) => (
							<div
								key={s.name}
								className="beat border border-dashed border-border p-5"
								style={at(i * 90)}
							>
								<p className="font-mono text-xs tracking-wide text-text-subtle uppercase">
									Read at startup
								</p>
								<p className="mt-2 font-mono text-sm font-medium break-all text-foreground">
									{s.name}
								</p>
								<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
									{s.detail}
								</p>
							</div>
						))}
					</Stage>
				</div>

				<Stage>
					<h3
						className="beat text-lg font-semibold text-foreground"
						style={at(0)}
					>
						What the agent gets
					</h3>
					<table className="mt-4 w-full border-collapse text-left text-sm">
						<caption className="sr-only">
							The five MCP tools. Each takes a connection name.
						</caption>
						<thead>
							<tr
								className="beat border-b border-border font-mono text-xs tracking-wide text-text-subtle uppercase"
								style={at(80)}
							>
								<th scope="col" className="py-2 pr-4 font-normal">
									Tool
								</th>
								<th scope="col" className="py-2 font-normal">
									Returns
								</th>
							</tr>
						</thead>
						<tbody>
							{tools.map(([tool, returns], i) => (
								<tr
									key={tool}
									className="beat border-b border-border align-top"
									style={at(140 + i * 60)}
								>
									<th
										scope="row"
										className="py-3 pr-4 font-mono font-medium whitespace-nowrap text-foreground"
									>
										{tool}
									</th>
									<td className="py-3 text-muted-foreground">{returns}</td>
								</tr>
							))}
						</tbody>
					</table>
				</Stage>

				<Stage>
					<h3
						className="beat text-lg font-semibold text-foreground"
						style={at(0)}
					>
						What it guarantees
					</h3>
					<GlowGrid className="mt-4 grid list-none gap-px border border-border bg-border md:grid-cols-3">
						{guarantees.map((g, i) => (
							<li
								key={g.title}
								className="beat relative bg-background p-5"
								style={at(100 + i * 90)}
							>
								<p className="font-medium text-foreground">{g.title}</p>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									{g.body}
								</p>
							</li>
						))}
					</GlowGrid>
					<p
						className="beat mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground"
						style={at(100 + guarantees.length * 90 + 100)}
					>
						Read-write is opt-in per connection. A database user with{" "}
						<InlineCode>SELECT</InlineCode> grants only is still the real
						guarantee, so use one.
					</p>
				</Stage>
			</div>
		</Section>
	);
}
