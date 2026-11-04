"use client";

import { useEffect, useState } from "react";

import { useInView } from "@/hooks/use-in-view";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import { SectionHead, Wrap } from "./ui";

function CountUp({
	to,
	prefix = "",
	suffix = "",
}: {
	to: number;
	prefix?: string;
	suffix?: string;
}) {
	const reduced = useReducedMotion();
	const [ref, seen] = useInView<HTMLSpanElement>();
	const [value, setValue] = useState(0);

	useEffect(() => {
		if (!seen || reduced) return;
		const t0 = performance.now();
		let raf = 0;
		const tick = (now: number) => {
			const p = Math.min(1, (now - t0) / 1100);
			setValue(Math.round(to * (1 - (1 - p) ** 3)));
			if (p < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [seen, reduced, to]);

	const shown = reduced ? to : value;
	return (
		<span ref={ref}>
			{prefix}
			{shown}
			{suffix}
		</span>
	);
}

const stats = [
	{
		node: <CountUp to={400} prefix="≈" />,
		unit: "tokens",
		body: "for all four tool definitions. They're paid for in every session, so they stay terse.",
	},
	{
		node: <CountUp to={500} />,
		unit: "rows",
		body: "per result by default. The database stops at limit + 1, and truncated tells the agent more existed.",
	},
	{
		node: <CountUp to={64} />,
		unit: "KB",
		body: "hard cap on any response. A single cell is clipped at 2,000 characters.",
	},
];

const tools = [
	["list_connections", "what names exist"],
	["list_tables", "tables and rough row counts"],
	["describe_table", "columns, keys, indexes"],
	["run_query", "one SQL statement"],
];

export function Numbers() {
	return (
		<section
			id="small"
			aria-labelledby="small-title"
			className="border-border border-t py-24 sm:py-32"
		>
			<Wrap>
				<SectionHead
					id="small-title"
					kicker="Context budget"
					title="Small on purpose."
					lead="Every token an agent spends on tooling is one it can't spend on your problem. Four tools, compact positional JSON, hard caps."
				/>
				<dl className="mt-14 grid gap-px border border-border bg-border md:grid-cols-3">
					{stats.map((s) => (
						<div key={s.unit} className="bg-background p-6 sm:p-8">
							<dt className="flex items-baseline gap-2">
								<span className="font-mono font-semibold text-5xl text-foreground tracking-tight sm:text-6xl">
									{s.node}
								</span>
								<span className="font-mono text-sm text-text-subtle">
									{s.unit}
								</span>
							</dt>
							<dd className="mt-4 text-muted-foreground text-sm leading-relaxed">
								{s.body}
							</dd>
						</div>
					))}
				</dl>
				<ul className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
					{tools.map(([name, what]) => (
						<li key={name} className="bg-background px-5 py-4">
							<p className="font-mono text-foreground text-sm">{name}</p>
							<p className="mt-1 text-muted-foreground text-sm">{what}</p>
						</li>
					))}
				</ul>
			</Wrap>
		</section>
	);
}
