"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { useState } from "react";

import { useInView } from "@/hooks/use-in-view";
import { CLAUDE_COMMAND, CURSOR_CONFIG, INSTALL_COMMAND } from "@/lib/site";

import { Terminal, type TermLine } from "./terminal";
import { SectionHead, Wrap } from "./ui";

function table(headers: string[], rows: string[][]) {
	const widths = headers.map((h, i) =>
		Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
	);
	const line = (cells: string[]) =>
		cells
			.map((c, i) => c.padEnd(widths[i] ?? 0))
			.join("  ")
			.trimEnd();
	return [line(headers), ...rows.map(line)];
}

const INSTALL: TermLine[] = [
	{ kind: "cmd", text: INSTALL_COMMAND },
	{
		kind: "out",
		text: "# gives you `deebeebridge` and the short alias `dbb`",
		dim: true,
	},
	{ kind: "cmd", text: "deebeebridge --version" },
	{ kind: "out", text: "0.1.0" },
];

const ADD: TermLine[] = [
	{ kind: "cmd", text: "deebeebridge add" },
	{ kind: "ask", label: "Database type", answer: "postgres" },
	{ kind: "ask", label: "Connection name", answer: "app-db" },
	{ kind: "ask", label: "Host", answer: "db.example.com" },
	{ kind: "ask", label: "Port", answer: "5432" },
	{ kind: "ask", label: "Database", answer: "app" },
	{ kind: "ask", label: "User", answer: "readonly" },
	{ kind: "ask", label: "Password", answer: "********" },
	{ kind: "ask", label: "Use SSL?", answer: "yes" },
	{ kind: "ask", label: "Mode", answer: "read-only" },
	{
		kind: "out",
		text: 'Connected in 38ms. Saved "app-db" (password stored in the OS keychain).',
	},
	{ kind: "cmd", text: "deebeebridge list" },
	...table(
		["NAME", "TYPE", "HOST", "DATABASE", "USER", "MODE"],
		[
			[
				"app-db",
				"postgres",
				"db.example.com:5432",
				"app",
				"readonly",
				"read-only",
			],
		],
	).map((text): TermLine => ({ kind: "out", text })),
];

const CLAUDE: TermLine[] = [
	{ kind: "cmd", text: CLAUDE_COMMAND },
	{ kind: "out", text: "# then, in any Claude Code session:", dim: true },
	{
		kind: "out",
		text: "> Using the app-db connection, which tables have the most rows?",
	},
];

const CURSOR: TermLine[] = [
	{ kind: "out", text: "# ~/.cursor/mcp.json", dim: true },
	...CURSOR_CONFIG.split("\n").map((text): TermLine => ({ kind: "out", text })),
	{ kind: "out", text: "# then ask Cursor:", dim: true },
	{
		kind: "out",
		text: "> Using the app-db connection, which tables have the most rows?",
	},
];

const STEPS = [
	{
		title: "Install",
		blurb: "One global package. Node 20 or newer.",
		title2: "install",
	},
	{
		title: "Save a connection",
		blurb:
			"The password goes into your OS keychain. New connections are read-only.",
		title2: "add a connection",
	},
	{
		title: "Point your agent at it",
		blurb: "One line for Claude Code, one JSON block for Cursor.",
		title2: "connect an agent",
	},
] as const;

export function Setup() {
	const [ref, seen] = useInView<HTMLDivElement>({
		rootMargin: "0px 0px -20% 0px",
	});
	const [step, setStep] = useState(0);
	const [agent, setAgent] = useState<"claude" | "cursor">("claude");

	const lines =
		step === 0
			? INSTALL
			: step === 1
				? ADD
				: agent === "claude"
					? CLAUDE
					: CURSOR;
	const title = STEPS[step]?.title2 ?? "";
	const copyLabel = `${title} commands`;

	return (
		<section
			id="setup"
			aria-labelledby="setup-title"
			className="border-border border-t py-24 sm:py-32"
		>
			<Wrap>
				<SectionHead
					id="setup-title"
					kicker="Set up"
					title="Three commands. Then ask."
					lead="No server to host and no account to make. Your agent starts deebeebridge itself, over stdio, when it needs it."
				/>
				<div ref={ref} className="mt-14 grid gap-8 lg:grid-cols-[20rem_1fr]">
					<ol className="flex flex-col gap-2">
						{STEPS.map((s, i) => {
							const active = i === step;
							return (
								<li key={s.title}>
									<button
										type="button"
										aria-current={active ? "step" : undefined}
										onClick={() => setStep(i)}
										className={cn(
											"group flex w-full cursor-pointer gap-4 border p-4 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
											active
												? "border-foreground"
												: "border-border hover:border-text-subtle",
										)}
									>
										<span
											aria-hidden
											className={cn(
												"font-mono text-sm",
												active ? "text-foreground" : "text-text-subtle",
											)}
										>
											{String(i + 1).padStart(2, "0")}
										</span>
										<span>
											<span className="block font-medium text-foreground">
												{s.title}
											</span>
											<span className="mt-1 block text-muted-foreground text-sm leading-relaxed">
												{s.blurb}
											</span>
										</span>
									</button>
								</li>
							);
						})}
					</ol>

					<div className="min-w-0">
						{step === 2 ? (
							<fieldset className="mb-3 inline-flex min-w-0 border border-border p-0.5 font-mono text-xs">
								<legend className="sr-only">Agent</legend>
								{(["claude", "cursor"] as const).map((a) => (
									<button
										key={a}
										type="button"
										aria-pressed={agent === a}
										onClick={() => setAgent(a)}
										className={cn(
											"min-h-9 cursor-pointer px-3 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
											agent === a
												? "bg-foreground text-background"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{a === "claude" ? "Claude Code" : "Cursor"}
									</button>
								))}
							</fieldset>
						) : null}
						<Terminal
							key={`${step}-${agent}`}
							title={title}
							lines={lines}
							play={seen}
							copyLabel={copyLabel}
						/>
					</div>
				</div>
			</Wrap>
		</section>
	);
}
