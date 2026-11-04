import { ArrowDown, ArrowRight } from "lucide-react";

import { InlineCode, Section } from "./shared";

const flow = [
	{ name: "Your agent", detail: "Claude Code, Cursor or any MCP client" },
	{
		name: "deebeebridge mcp",
		detail: "Local server, started by the agent over stdio",
	},
	{ name: "Database driver", detail: "pg or mysql2, with a read-only session" },
	{ name: "Your database", detail: "PostgreSQL or MySQL" },
];

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
					<h3 className="sr-only">Request path</h3>
					<ol className="grid list-none gap-0 border border-border md:grid-cols-4">
						{flow.map((step, i) => (
							<li
								key={step.name}
								className="relative border-t border-border p-5 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0"
							>
								<p className="font-mono text-xs text-text-subtle" aria-hidden>
									{i + 1}
								</p>
								<p className="mt-2 font-mono text-sm font-medium text-foreground">
									{step.name}
								</p>
								<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
									{step.detail}
								</p>
								{i < flow.length - 1 ? (
									<span
										aria-hidden
										className="absolute -bottom-3 left-5 z-10 flex size-6 items-center justify-center border border-border bg-background text-text-subtle md:top-1/2 md:right-0 md:bottom-auto md:left-auto md:-translate-y-1/2 md:translate-x-1/2"
									>
										<ArrowDown className="size-3.5 md:hidden" />
										<ArrowRight className="hidden size-3.5 md:block" />
									</span>
								) : null}
							</li>
						))}
					</ol>
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						{stores.map((s) => (
							<div
								key={s.name}
								className="border border-dashed border-border p-5"
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
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold text-foreground">
						What the agent gets
					</h3>
					<table className="mt-4 w-full border-collapse text-left text-sm">
						<caption className="sr-only">
							The five MCP tools. Each takes a connection name.
						</caption>
						<thead>
							<tr className="border-b border-border font-mono text-xs tracking-wide text-text-subtle uppercase">
								<th scope="col" className="py-2 pr-4 font-normal">
									Tool
								</th>
								<th scope="col" className="py-2 font-normal">
									Returns
								</th>
							</tr>
						</thead>
						<tbody>
							{tools.map(([tool, returns]) => (
								<tr key={tool} className="border-b border-border align-top">
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
				</div>

				<div>
					<h3 className="text-lg font-semibold text-foreground">
						What it guarantees
					</h3>
					<ul className="mt-4 grid list-none gap-px border border-border bg-border md:grid-cols-3">
						{guarantees.map((g) => (
							<li key={g.title} className="bg-background p-5">
								<p className="font-medium text-foreground">{g.title}</p>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									{g.body}
								</p>
							</li>
						))}
					</ul>
					<p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						Read-write is opt-in per connection. A database user with{" "}
						<InlineCode>SELECT</InlineCode> grants only is still the real
						guarantee, so use one.
					</p>
				</div>
			</div>
		</Section>
	);
}
