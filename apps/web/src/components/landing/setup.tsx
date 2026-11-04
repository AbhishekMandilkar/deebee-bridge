import type { ReactNode } from "react";

import { AgentTabs } from "./agent-tabs";
import { at, Thinking, Typed, typingMs } from "./motion";
import {
	CommandLine,
	commandLineMs,
	Dim,
	INSTALL_COMMAND,
	InlineCode,
	Section,
	Terminal,
} from "./shared";
import { Stage } from "./stage";

function Step({
	n,
	title,
	children,
}: {
	n: number;
	title: string;
	children: ReactNode;
}) {
	const number = String(n).padStart(2, "0");
	return (
		<li className="border-t border-border py-10 first:border-t-0 first:pt-0">
			<Stage className="grid gap-4 md:grid-cols-[14rem_1fr] md:gap-10">
				<div className="beat relative" style={at(0)}>
					{/* Marker on the scroll rail; fills as the step crosses mid-screen. */}
					<span
						aria-hidden
						className="absolute top-1.5 -left-5 -ml-[3.5px] hidden size-2 border border-border bg-background md:block"
					>
						<span className="rail-lit absolute -inset-px bg-foreground" />
					</span>
					<p
						className="relative font-mono text-sm text-text-subtle"
						aria-hidden
					>
						{number}
						<span className="rail-lit absolute inset-0 text-foreground">
							{number}
						</span>
					</p>
					<h3 className="mt-1 text-lg font-semibold text-foreground">
						{title}
					</h3>
				</div>
				<div className="min-w-0 space-y-4">{children}</div>
			</Stage>
		</li>
	);
}

/* The `deebeebridge add` prompts, answered one after another as if typed. */
const answers = [
	["? Database type", "postgres"],
	["? Connection name", "app-db"],
	["? Host", "db.example.com"],
	["? User", "readonly"],
	["? Password", "********"],
] as const;

const ADD_COMMAND = "deebeebridge add";
const SESSION_AT = 150 + commandLineMs(ADD_COMMAND) + 150;
const PROMPT_LEAD = 160;
const PROMPT_GAP = 120;

const session = answers.map(([question, answer], i) => {
	const start =
		SESSION_AT +
		answers
			.slice(0, i)
			.reduce((t, [, a]) => t + PROMPT_LEAD + typingMs(a) + PROMPT_GAP, 0);
	return { question, answer, start };
});
const last = session[session.length - 1];
const CONNECT_AT = last
	? last.start + PROMPT_LEAD + typingMs(last.answer) + PROMPT_GAP
	: SESSION_AT;
const CONNECT_FOR = 600;
const NOTE_AT = CONNECT_AT + CONNECT_FOR + 200;

export function Setup() {
	return (
		<Section
			id="setup"
			index="02"
			label="Set up"
			title="Three steps, then ask your agent."
			lead="No server to host and no account to create. Everything runs on your machine."
		>
			<div className="rail relative">
				{/* Scroll-linked progress through the steps (where supported). */}
				<span
					aria-hidden
					className="absolute inset-y-0 -left-5 hidden w-px bg-border md:block"
				>
					<span className="rail-fill absolute inset-0 bg-foreground" />
				</span>
				<ol className="list-none">
					<Step n={1} title="Install">
						<CommandLine
							command={INSTALL_COMMAND}
							label="install command"
							at={150}
						/>
						<p
							className="beat text-sm leading-relaxed text-muted-foreground"
							style={at(150 + commandLineMs(INSTALL_COMMAND))}
						>
							Gives you <InlineCode>deebeebridge</InlineCode> and the short
							alias <InlineCode>dbb</InlineCode>. Needs Node 20 or newer.
						</p>
					</Step>

					<Step n={2} title="Save a connection">
						<CommandLine command={ADD_COMMAND} label="add command" at={150} />
						<Terminal
							title="Example session"
							className="beat"
							style={at(SESSION_AT - 100)}
						>
							{session.map(({ question, answer, start }) => (
								<span key={question} className="beat block" style={at(start)}>
									<Dim>{question}</Dim>{" "}
									<Typed text={answer} at={start + PROMPT_LEAD} />
								</span>
							))}
							<span className="relative block">
								<Thinking at={CONNECT_AT} duration={CONNECT_FOR} />
								<span
									className="beat block"
									style={at(CONNECT_AT + CONNECT_FOR)}
								>
									Connected in 38ms. Saved "app-db" (password stored in
									secrets.json, mode 0600).
								</span>
							</span>
						</Terminal>
						<p
							className="beat text-sm leading-relaxed text-muted-foreground"
							style={at(NOTE_AT)}
						>
							It tests the connection before saving, and new connections are{" "}
							<InlineCode>read-only</InlineCode>. Prefer a URL? Pipe it in with{" "}
							<InlineCode>--url -</InlineCode> so the password stays out of your
							shell history.
						</p>
					</Step>

					<Step n={3} title="Connect your agent">
						<div className="beat" style={at(150)}>
							<AgentTabs />
						</div>
						<p
							className="beat text-sm leading-relaxed text-muted-foreground"
							style={at(350)}
						>
							Then ask:{" "}
							<em className="text-text-secondary not-italic">
								“Using the app-db connection, which tables have the most rows?”
							</em>{" "}
							The agent sees the name <InlineCode>app-db</InlineCode>, never the
							credentials.
						</p>
					</Step>
				</ol>
			</div>
		</Section>
	);
}
