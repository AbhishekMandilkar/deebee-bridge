"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { useId, useRef, useState } from "react";

import { CopyButton } from "../copy-button";

const agents = [
	{
		id: "claude",
		name: "Claude Code",
		hint: "Run once in any terminal:",
		file: null,
		code: "claude mcp add deebeebridge -- deebeebridge mcp",
	},
	{
		id: "cursor",
		name: "Cursor",
		hint: "Add to ~/.cursor/mcp.json:",
		file: "~/.cursor/mcp.json",
		code: `{
  "mcpServers": {
    "deebeebridge": { "command": "deebeebridge", "args": ["mcp"] }
  }
}`,
	},
] as const;

export function AgentTabs() {
	const [active, setActive] = useState(0);
	const base = useId();
	const refs = useRef<(HTMLButtonElement | null)[]>([]);

	function onKeyDown(e: React.KeyboardEvent, i: number) {
		const last = agents.length - 1;
		const next =
			e.key === "ArrowRight"
				? (i + 1) % agents.length
				: e.key === "ArrowLeft"
					? (i - 1 + agents.length) % agents.length
					: e.key === "Home"
						? 0
						: e.key === "End"
							? last
							: null;
		if (next === null) return;
		e.preventDefault();
		setActive(next);
		refs.current[next]?.focus();
	}

	const agent = agents[active];

	return (
		<div>
			<div
				role="tablist"
				aria-label="Choose your agent"
				className="flex border-b border-border"
			>
				{agents.map((a, i) => (
					<button
						key={a.id}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="tab"
						id={`${base}-tab-${a.id}`}
						aria-selected={i === active}
						aria-controls={`${base}-panel`}
						tabIndex={i === active ? 0 : -1}
						onClick={() => setActive(i)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className={cn(
							"-mb-px h-11 cursor-pointer border-b-2 px-4 font-mono text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
							i === active
								? "border-foreground text-foreground"
								: "border-transparent text-text-subtle hover:text-foreground",
						)}
					>
						{a.name}
					</button>
				))}
			</div>
			<div
				role="tabpanel"
				id={`${base}-panel`}
				aria-labelledby={`${base}-tab-${agent.id}`}
				className="pt-4"
			>
				<p className="mb-2 text-sm text-muted-foreground">{agent.hint}</p>
				<div className="border border-border bg-surface">
					<pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
						{agent.code}
					</pre>
					<div className="flex justify-end border-t border-border">
						<CopyButton value={agent.code} label={`${agent.name} setup`} />
					</div>
				</div>
			</div>
		</div>
	);
}
