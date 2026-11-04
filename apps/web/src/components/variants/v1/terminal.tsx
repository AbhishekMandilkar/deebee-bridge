"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { useCopy } from "@/hooks/use-copy";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type TermLine =
	| { kind: "cmd"; text: string }
	| { kind: "ask"; label: string; answer: string }
	| { kind: "out"; text: string; dim?: boolean };

const CMD_MS = 24;
const ANSWER_MS = 28;

function duration(line: TermLine) {
	if (line.kind === "cmd") return line.text.length * CMD_MS + 380;
	if (line.kind === "ask") return 140 + line.answer.length * ANSWER_MS + 90;
	return 120;
}

/** Plain-text form of the commands in a session, for the copy button. */
export function commandsOf(lines: TermLine[]) {
	return lines.flatMap((l) => (l.kind === "cmd" ? [l.text] : [])).join("\n");
}

/** A terminal that types its session out once. Remount (change `key`) to replay. */
export function Terminal({
	title,
	lines,
	play,
	copyLabel,
	className,
}: {
	title: string;
	lines: TermLine[];
	play: boolean;
	copyLabel: string;
	className?: string;
}) {
	const reduced = useReducedMotion();
	const starts: number[] = [];
	let total = 0;
	for (const l of lines) {
		starts.push(total);
		total += duration(l);
	}

	const [elapsed, setElapsed] = useState(0);
	useEffect(() => {
		if (!play || reduced) return;
		const t0 = performance.now();
		const id = setInterval(() => {
			const e = performance.now() - t0;
			setElapsed(e);
			if (e >= total) clearInterval(id);
		}, 32);
		return () => clearInterval(id);
	}, [play, reduced, total]);

	const now = reduced ? total : play ? elapsed : 0;
	const finished = now >= total;
	const command = commandsOf(lines);
	const { copied, copy } = useCopy(command);

	return (
		<figure
			className={cn("border border-border bg-surface", className)}
			aria-label={title}
		>
			<figcaption className="flex h-11 items-center justify-between border-border border-b pr-1 pl-4">
				<span className="flex items-center gap-3 font-mono text-text-subtle text-xs">
					<span aria-hidden className="flex gap-1.5">
						<i className="size-2 border border-text-subtle" />
						<i className="size-2 border border-text-subtle" />
						<i className="size-2 border border-text-subtle" />
					</span>
					{title}
				</span>
				<button
					type="button"
					onClick={copy}
					aria-label={`Copy ${copyLabel}`}
					className="inline-flex h-9 cursor-pointer items-center gap-1.5 px-2.5 font-mono text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
				>
					{copied ? (
						<Check aria-hidden className="size-3.5" />
					) : (
						<Copy aria-hidden className="size-3.5" />
					)}
					<span aria-hidden>{copied ? "Copied" : "Copy commands"}</span>
				</button>
				<span role="status" className="sr-only">
					{copied ? `Copied ${copyLabel}` : ""}
				</span>
			</figcaption>
			<div className="min-h-[24rem] overflow-x-auto p-4 font-mono text-sm leading-relaxed">
				{/* Screen readers get the finished session at once instead of a typing stream. */}
				<div className="sr-only">
					{lines.map((l, i) => (
						<p key={`${i}-${l.kind}`}>
							{l.kind === "cmd"
								? `$ ${l.text}`
								: l.kind === "ask"
									? `${l.label} ${l.answer}`
									: l.text}
						</p>
					))}
				</div>
				<div aria-hidden className="w-max min-w-full">
					{lines.map((l, i) => {
						const start = starts[i] ?? 0;
						const t = now - start;
						if (t < 0) return null;
						if (l.kind === "cmd") {
							const n = Math.min(l.text.length, Math.floor(t / CMD_MS));
							return (
								<div
									key={`${i}-${l.kind}`}
									className="whitespace-pre text-foreground"
								>
									<span className="select-none text-text-subtle">$ </span>
									{l.text.slice(0, n)}
									{n < l.text.length ? <Caret /> : null}
								</div>
							);
						}
						if (l.kind === "ask") {
							const n = Math.max(
								0,
								Math.min(l.answer.length, Math.floor((t - 140) / ANSWER_MS)),
							);
							return (
								<div key={`${i}-${l.kind}`} className="whitespace-pre">
									<span className="text-text-subtle">? {l.label} </span>
									<span className="text-foreground">
										{l.answer.slice(0, n)}
									</span>
									{n < l.answer.length ? <Caret /> : null}
								</div>
							);
						}
						return (
							<div
								key={`${i}-${l.kind}`}
								className={cn(
									"whitespace-pre",
									l.dim ? "text-text-subtle" : "text-text-secondary",
								)}
							>
								{l.text || " "}
							</div>
						);
					})}
					{finished ? (
						<div className="whitespace-pre text-foreground">
							<span className="select-none text-text-subtle">$ </span>
							<Caret />
						</div>
					) : null}
				</div>
			</div>
		</figure>
	);
}

function Caret() {
	return (
		<span className="ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-foreground motion-safe:animate-pulse" />
	);
}
