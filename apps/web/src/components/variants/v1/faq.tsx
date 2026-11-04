import { Plus } from "lucide-react";

import { SectionHead, Wrap } from "./ui";

const faqs = [
	{
		q: "Can the agent read my password?",
		a: "No tool accepts or returns credentials, and passwords are masked from every error and log line. One honest limit: deebeebridge isn't a sandbox. An agent with unrestricted shell access runs as you. What it does is keep secrets out of prompts, transcripts and tool results.",
	},
	{
		q: "Can an agent write to my database?",
		a: "Not unless you let it. Connections are read-only by default. Switch one to read-write with --mode read-write and any statement is accepted, so do that on purpose, ideally against a database user with narrow grants.",
	},
	{
		q: "Where does everything live?",
		a: "Settings (host, port, user, mode) live in ~/.deebeebridge/connections.json, with no passwords in it. Passwords live in your OS keychain under the service name deebeebridge. Set DEEBEEBRIDGE_HOME to move the folder.",
	},
	{
		q: "Do I have to run a server?",
		a: "No. Your agent starts deebeebridge mcp as a child process over stdio. There's no daemon, no HTTP port and no account. HTTP transport and cloud sync are out of scope.",
	},
	{
		q: "Which databases and agents work?",
		a: "PostgreSQL and MySQL today, ClickHouse is planned. Any MCP client works: Claude Code and Cursor are documented.",
	},
];

export function Faq() {
	return (
		<section
			id="faq"
			aria-labelledby="faq-title"
			className="border-border border-t py-24 sm:py-32"
		>
			<Wrap className="grid gap-12 lg:grid-cols-[1fr_2fr]">
				<SectionHead
					id="faq-title"
					kicker="Questions"
					title="The honest answers."
				/>
				<div className="border-border border-t">
					{faqs.map((f) => (
						<details key={f.q} className="group border-border border-b">
							<summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-medium text-foreground outline-none marker:hidden focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
								{f.q}
								<Plus
									aria-hidden
									className="size-4 shrink-0 text-text-subtle transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
								/>
							</summary>
							<p className="max-w-2xl pb-6 text-muted-foreground leading-relaxed">
								{f.a}
							</p>
						</details>
					))}
				</div>
			</Wrap>
		</section>
	);
}
