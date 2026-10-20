import type { ReactNode } from "react";

import { AgentTabs } from "./agent-tabs";
import {
	CommandLine,
	Dim,
	INSTALL_COMMAND,
	InlineCode,
	Section,
	Terminal,
} from "./shared";

function Step({
	n,
	title,
	children,
}: {
	n: number;
	title: string;
	children: ReactNode;
}) {
	return (
		<li className="grid gap-4 border-t border-border py-10 first:border-t-0 first:pt-0 md:grid-cols-[14rem_1fr] md:gap-10">
			<div>
				<p className="font-mono text-sm text-text-subtle" aria-hidden>
					{String(n).padStart(2, "0")}
				</p>
				<h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3>
			</div>
			<div className="min-w-0 space-y-4">{children}</div>
		</li>
	);
}

export function Setup() {
	return (
		<Section
			id="setup"
			index="02"
			label="Set up"
			title="Three steps, then ask your agent."
			lead="No server to host and no account to create. Everything runs on your machine."
		>
			<ol className="list-none">
				<Step n={1} title="Install">
					<CommandLine command={INSTALL_COMMAND} label="install command" />
					<p className="text-sm leading-relaxed text-muted-foreground">
						Gives you <InlineCode>deebeebridge</InlineCode> and the short alias{" "}
						<InlineCode>dbb</InlineCode>. Needs Node 20 or newer.
					</p>
				</Step>

				<Step n={2} title="Save a connection">
					<CommandLine command="deebeebridge add" label="add command" />
					<Terminal title="Example session">
						<Dim>? Database type</Dim> postgres{"\n"}
						<Dim>? Connection name</Dim> app-db{"\n"}
						<Dim>? Host</Dim> db.example.com{"\n"}
						<Dim>? User</Dim> readonly{"\n"}
						<Dim>? Password</Dim> ********{"\n"}
						Connected in 38ms. Saved "app-db" (password stored in the OS
						keychain).
					</Terminal>
					<p className="text-sm leading-relaxed text-muted-foreground">
						It tests the connection before saving, and new connections are{" "}
						<InlineCode>read-only</InlineCode>. Prefer a URL? Pipe it in with{" "}
						<InlineCode>--url -</InlineCode> so the password stays out of your
						shell history.
					</p>
				</Step>

				<Step n={3} title="Connect your agent">
					<AgentTabs />
					<p className="text-sm leading-relaxed text-muted-foreground">
						Then ask:{" "}
						<em className="text-text-secondary not-italic">
							“Using the app-db connection, which tables have the most rows?”
						</em>{" "}
						The agent sees the name <InlineCode>app-db</InlineCode>, never the
						credentials.
					</p>
				</Step>
			</ol>
		</Section>
	);
}
