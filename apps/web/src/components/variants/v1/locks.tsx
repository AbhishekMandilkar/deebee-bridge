import {
	ArrowRight,
	Check,
	Database,
	ScanLine,
	ShieldCheck,
	X,
} from "lucide-react";

import { SectionHead, Wrap } from "./ui";

const pipeline = [
	{
		icon: ScanLine,
		name: "Agent SQL",
		body: "Whatever the model wrote.",
	},
	{
		icon: ShieldCheck,
		name: "Lock 1 · The parser",
		body: "Exactly one statement, and it must read. Anything unparseable is refused.",
	},
	{
		icon: ShieldCheck,
		name: "Lock 2 · The database",
		body: "Postgres runs it in a READ ONLY transaction. MySQL sets the session read-only.",
	},
	{
		icon: Database,
		name: "Your data",
		body: "Untouched by anything that wasn't a read.",
	},
];

const examples: { sql: string; allowed: boolean; why: string }[] = [
	{ sql: "SELECT * FROM orders LIMIT 5", allowed: true, why: "one SELECT" },
	{
		sql: "WITH t AS (SELECT 1 a) SELECT * FROM t",
		allowed: true,
		why: "WITH … SELECT",
	},
	{
		sql: "EXPLAIN SELECT * FROM orders",
		allowed: true,
		why: "EXPLAIN of a SELECT",
	},
	{ sql: "DELETE FROM users", allowed: false, why: "delete statement" },
	{
		sql: "SELECT 1; DROP TABLE users",
		allowed: false,
		why: "multiple statements",
	},
	{
		sql: "SELECT * FROM users FOR UPDATE",
		allowed: false,
		why: "locking read",
	},
	{
		sql: "SELECT * INTO backup FROM users",
		allowed: false,
		why: "SELECT INTO",
	},
	{
		sql: "EXPLAIN DELETE FROM users",
		allowed: false,
		why: "EXPLAIN of a non-SELECT",
	},
	{
		sql: "/*!50000 DROP TABLE users */ SELECT 1",
		allowed: false,
		why: "MySQL version comment",
	},
];

export function Locks() {
	return (
		<section
			id="guardrails"
			aria-labelledby="guardrails-title"
			className="border-border border-t py-24 sm:py-32"
		>
			<Wrap>
				<SectionHead
					id="guardrails-title"
					kicker="Guardrails"
					title="Two locks on every read-only connection."
					lead="Both have to open for a query to run, and the parser fails closed: if it can't read a statement, it doesn't run."
				/>

				<ol className="mt-14 grid border border-border md:grid-cols-4">
					{pipeline.map((node, i) => (
						<li
							key={node.name}
							className="relative border-border border-t p-5 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0"
						>
							<node.icon aria-hidden className="size-5 text-foreground" />
							<p className="mt-4 font-medium font-mono text-foreground text-sm">
								{node.name}
							</p>
							<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
								{node.body}
							</p>
							{i < pipeline.length - 1 ? (
								<span
									aria-hidden
									className="absolute right-0 bottom-0 z-10 hidden size-6 translate-x-1/2 translate-y-1/2 items-center justify-center border border-border bg-background text-text-subtle md:top-1/2 md:bottom-auto md:flex md:-translate-y-1/2"
								>
									<ArrowRight className="size-3.5" />
								</span>
							) : null}
						</li>
					))}
				</ol>

				<div className="mt-12">
					<ul className="md:hidden">
						{examples.map((e) => (
							<li
								key={e.sql}
								className="border-border border-b py-4 first:border-t"
							>
								<p className="break-all font-mono text-foreground text-sm">
									{e.sql}
								</p>
								<p className="mt-2 flex items-center justify-between gap-4 text-muted-foreground text-sm">
									<span>{e.why}</span>
									<span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-foreground text-xs">
										{e.allowed ? (
											<Check aria-hidden className="size-3.5" />
										) : (
											<X aria-hidden className="size-3.5" />
										)}
										{e.allowed ? "runs" : "refused"}
									</span>
								</p>
							</li>
						))}
					</ul>
					<div className="hidden md:block">
						<table className="w-full border-collapse text-left text-sm">
							<caption className="sr-only">
								Example statements and what lock 1 does with each
							</caption>
							<thead>
								<tr className="border-border border-b font-mono text-text-subtle text-xs uppercase tracking-wide">
									<th scope="col" className="py-3 pr-6 font-normal">
										An agent sends
									</th>
									<th scope="col" className="py-3 pr-6 font-normal">
										Lock 1 says
									</th>
									<th scope="col" className="py-3 font-normal">
										Result
									</th>
								</tr>
							</thead>
							<tbody>
								{examples.map((e) => (
									<tr key={e.sql} className="border-border border-b">
										<td className="py-3 pr-6 font-mono text-foreground">
											{e.sql}
										</td>
										<td className="py-3 pr-6 text-muted-foreground">{e.why}</td>
										<td className="py-3">
											<span className="inline-flex items-center gap-1.5 font-mono text-foreground text-xs">
												{e.allowed ? (
													<Check aria-hidden className="size-3.5" />
												) : (
													<X aria-hidden className="size-3.5" />
												)}
												{e.allowed ? "runs" : "refused"}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<p className="mt-6 max-w-2xl text-muted-foreground text-sm leading-relaxed">
					Lock 1 is a parser, and parsers have blind spots, so a database user
					with <code className="font-mono text-foreground">SELECT</code> grants
					only is still the real guarantee. the add prompt reminds you to use
					one.
				</p>
			</Wrap>
		</section>
	);
}
