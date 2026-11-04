"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { useId, useLayoutEffect, useRef, useState } from "react";

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
	const listRef = useRef<HTMLDivElement>(null);
	// clip-path that reveals the active-state copy over the active tab; null until measured.
	const [clip, setClip] = useState<string | null>(null);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const measure = () => {
			const tab = refs.current[active];
			if (!tab) return;
			const right = list.clientWidth - tab.offsetLeft - tab.offsetWidth;
			setClip(`inset(0 ${right}px 0 ${tab.offsetLeft}px)`);
		};
		measure();
		// Tab widths change when the mono font loads and when the viewport resizes.
		const ro = new ResizeObserver(measure);
		ro.observe(list);
		for (const tab of refs.current) if (tab) ro.observe(tab);
		return () => ro.disconnect();
	}, [active]);

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
				ref={listRef}
				className="relative flex border-b border-border"
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
							// Once measured, the overlay below draws the active state.
							i === active && clip === null
								? "border-foreground text-foreground"
								: "border-transparent text-text-subtle hover:text-foreground",
						)}
					>
						{a.name}
					</button>
				))}
				{/* The active state as one layer, clipped to the active tab. Text color and
				    underline move together because they are revealed, not interpolated. */}
				{clip === null ? null : (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 flex transition-[clip-path] duration-250 ease-in-out motion-reduce:transition-none"
						style={{ clipPath: clip }}
					>
						{agents.map((a) => (
							<span
								key={a.id}
								className="-mb-px flex h-11 items-center border-b-2 border-foreground bg-background px-4 font-mono text-sm text-foreground"
							>
								{a.name}
							</span>
						))}
					</div>
				)}
			</div>
			<div
				role="tabpanel"
				id={`${base}-panel`}
				aria-labelledby={`${base}-tab-${agent.id}`}
				className="pt-4"
			>
				{/* Remounts per agent; @starting-style fades the new content in. */}
				<div
					key={agent.id}
					className="transition-opacity duration-150 ease-out starting:opacity-0"
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
		</div>
	);
}
