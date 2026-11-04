"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { Check, Eye, Lock, Minus, Pause, Play, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useInView } from "@/hooks/use-in-view";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import {
	SCENARIOS,
	type Scenario,
	SECRETS,
	type StepStatus,
	type TraceStep,
} from "./scenarios";

const TICK_MS = 480;
const HOLD_MS = 4600;

type Item =
	| { kind: "prompt" }
	| { kind: "call" }
	| { kind: "step"; step: TraceStep }
	| { kind: "result" }
	| { kind: "says" };

function timeline(s: Scenario): Item[] {
	return [
		{ kind: "prompt" },
		{ kind: "call" },
		...s.steps.map((step): Item => ({ kind: "step", step })),
		{ kind: "result" },
		...(s.agentSays ? [{ kind: "says" } as const] : []),
	];
}

const statusIcon: Record<StepStatus, typeof Check> = {
	ok: Check,
	blocked: X,
	skipped: Minus,
};
const statusWord: Record<StepStatus, string> = {
	ok: "ok",
	blocked: "blocked",
	skipped: "skipped",
};

const enter =
	"animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none";

export function Wire() {
	const reduced = useReducedMotion();
	const [rootRef, onScreen] = useInView<HTMLDivElement>({
		once: false,
		rootMargin: "0px",
		threshold: 0.25,
	});
	const [index, setIndex] = useState(0);
	const [shown, setShown] = useState(0);
	const [auto, setAuto] = useState(true);

	const scenario = SCENARIOS[index] ?? SCENARIOS[0];
	if (!scenario) throw new Error("no scenarios");
	const items = useMemo(() => timeline(scenario), [scenario]);
	const visible = reduced ? items.length : shown;
	const done = visible >= items.length;
	const playing = auto && !reduced && onScreen;

	// Reveal one item at a time, hold the finished trace, then move to the next scenario.
	useEffect(() => {
		if (reduced || !onScreen) return;
		if (shown < items.length) {
			const t = setTimeout(
				() => setShown((n) => n + 1),
				shown === 0 ? 300 : TICK_MS,
			);
			return () => clearTimeout(t);
		}
		if (auto) {
			const t = setTimeout(() => {
				setIndex((i) => (i + 1) % SCENARIOS.length);
				setShown(0);
			}, HOLD_MS);
			return () => clearTimeout(t);
		}
	}, [shown, items.length, auto, reduced, onScreen]);

	function select(i: number) {
		setAuto(false);
		setIndex(i);
		setShown(0);
	}

	function onKeyDown(e: React.KeyboardEvent, i: number) {
		const n = SCENARIOS.length;
		const next =
			e.key === "ArrowDown" || e.key === "ArrowRight"
				? (i + 1) % n
				: e.key === "ArrowUp" || e.key === "ArrowLeft"
					? (i - 1 + n) % n
					: null;
		if (next === null) return;
		e.preventDefault();
		select(next);
		document.getElementById(`wire-tab-${next}`)?.focus();
	}

	const has = (kind: Item["kind"]) => {
		const at = items.findIndex((it) => it.kind === kind);
		return at !== -1 && at < visible;
	};

	// Everything the agent has been shown so far. The leak scan reads this very string.
	const context = [
		has("prompt") ? scenario.prompt : "",
		has("call") ? scenario.toolCall : "",
		has("result") ? scenario.result : "",
		has("says") ? (scenario.agentSays ?? "") : "",
	].join("\n");
	const hits = SECRETS.map((s) => ({
		...s,
		count: context.split(s.needle).length - 1,
	}));

	return (
		<div
			ref={rootRef}
			className="border border-border bg-surface shadow-[0_1px_0_0_var(--border),0_24px_80px_-32px_rgb(0_0_0/0.5)]"
		>
			<div className="flex h-11 items-center justify-between gap-4 border-border border-b px-4">
				<p className="truncate font-mono text-text-subtle text-xs">
					wire <span aria-hidden>·</span> app-db <span aria-hidden>·</span>{" "}
					postgres <span aria-hidden>·</span> read-only
				</p>
				<button
					type="button"
					onClick={() => setAuto((a) => !a)}
					disabled={reduced}
					aria-pressed={playing}
					className="inline-flex h-8 cursor-pointer items-center gap-1.5 px-2 font-mono text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
				>
					{playing ? (
						<Pause aria-hidden className="size-3.5" />
					) : (
						<Play aria-hidden className="size-3.5" />
					)}
					{reduced ? "Motion off" : playing ? "Pause demo" : "Play demo"}
				</button>
			</div>

			<div className="grid lg:grid-cols-[16.5rem_1fr]">
				<div className="border-border border-b p-3 lg:border-r lg:border-b-0 lg:p-4">
					<p
						id="wire-prompts"
						className="px-1 pb-2 font-mono text-text-subtle text-xs uppercase tracking-wide"
					>
						Ask your agent
					</p>
					<div
						role="tablist"
						aria-orientation="vertical"
						aria-labelledby="wire-prompts"
						className="flex flex-col gap-1"
					>
						{SCENARIOS.map((s, i) => {
							const active = i === index;
							return (
								<button
									key={s.id}
									id={`wire-tab-${i}`}
									type="button"
									role="tab"
									aria-selected={active}
									aria-controls="wire-panel"
									tabIndex={active ? 0 : -1}
									onClick={() => select(i)}
									onKeyDown={(e) => onKeyDown(e, i)}
									className={cn(
										"flex min-h-11 w-full cursor-pointer items-start gap-2.5 border px-3 py-2.5 text-left text-sm leading-snug outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
										active
											? "border-foreground bg-foreground text-background"
											: "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
									)}
								>
									<span
										aria-hidden
										className={cn(
											"mt-px font-mono text-xs",
											active ? "text-background/70" : "text-text-subtle",
										)}
									>
										{i + 1}
									</span>
									{s.prompt}
								</button>
							);
						})}
					</div>
				</div>

				<div
					role="tabpanel"
					id="wire-panel"
					aria-labelledby={`wire-tab-${index}`}
					className="grid min-w-0 lg:grid-cols-2"
				>
					{/* On the machine */}
					<div className="min-h-[27rem] min-w-0 border-border border-b p-4 sm:p-5 lg:border-r lg:border-b-0">
						<h3 className="flex items-center gap-2 font-mono text-muted-foreground text-xs uppercase tracking-wide">
							<Lock aria-hidden className="size-3.5" />
							On your machine
						</h3>
						<p className="mt-1 text-text-subtle text-xs">
							None of this is sent to the agent.
						</p>
						<ol className="mt-4 space-y-1">
							{items.map((it, i) => {
								if (it.kind !== "step" || i >= visible) return null;
								const { step } = it;
								const Icon = statusIcon[step.status];
								return (
									<li
										key={step.label}
										className={cn(
											"flex gap-3 border-l-2 py-2 pr-2 pl-3",
											enter,
											step.status === "blocked"
												? "border-foreground bg-foreground/[0.06]"
												: "border-border",
										)}
									>
										<Icon
											aria-hidden
											className={cn(
												"mt-0.5 size-4 shrink-0",
												step.status === "skipped"
													? "text-text-subtle"
													: "text-foreground",
											)}
										/>
										<div className="min-w-0">
											<p
												className={cn(
													"font-medium text-sm",
													step.status === "skipped"
														? "text-text-subtle"
														: "text-foreground",
												)}
											>
												{step.label}
												<span className="sr-only">
													{" "}
													({statusWord[step.status]})
												</span>
											</p>
											<p className="mt-0.5 break-words font-mono text-muted-foreground text-xs leading-relaxed">
												{step.secret ? (
													<>
														<span aria-hidden className="tracking-[0.2em]">
															•••••••••
														</span>{" "}
													</>
												) : null}
												{step.detail}
											</p>
										</div>
									</li>
								);
							})}
						</ol>
					</div>

					{/* In the agent's context */}
					<div className="flex min-h-[27rem] min-w-0 flex-col p-4 sm:p-5">
						<h3 className="flex items-center gap-2 font-mono text-muted-foreground text-xs uppercase tracking-wide">
							<Eye aria-hidden className="size-3.5" />
							In the agent&rsquo;s context
						</h3>
						<p className="mt-1 text-text-subtle text-xs">
							This is everything the model sees.
						</p>
						<div className="mt-4 flex-1 space-y-3 font-mono text-xs leading-relaxed">
							{has("prompt") ? (
								<Line who="you" className={enter}>
									<span className="font-sans text-foreground text-sm">
										{scenario.prompt}
									</span>
								</Line>
							) : null}
							{has("call") ? (
								<Line who="agent →" className={enter}>
									<span className="break-words text-foreground">
										{scenario.toolCall}
									</span>
								</Line>
							) : null}
							{has("result") ? (
								<Line
									who={scenario.isError ? "error ←" : "tool ←"}
									strong={scenario.isError}
									className={enter}
								>
									<span className="break-all text-text-secondary">
										{scenario.result}
									</span>
								</Line>
							) : null}
							{has("says") ? (
								<Line who="agent" className={enter}>
									<span className="font-sans text-foreground text-sm">
										{scenario.agentSays}
									</span>
								</Line>
							) : null}
						</div>

						<div className="mt-4 border-border border-t pt-3">
							<p className="font-mono text-text-subtle text-xs">
								{done ? "Leak scan of this context" : "Scanning this context…"}
							</p>
							<ul className="mt-2 flex flex-wrap gap-2">
								{hits.map((h) => (
									<li
										key={h.label}
										className="inline-flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-muted-foreground text-xs"
									>
										{h.count === 0 ? (
											<Check aria-hidden className="size-3 text-foreground" />
										) : (
											<X aria-hidden className="size-3 text-foreground" />
										)}
										{h.label}: {h.count} {h.count === 1 ? "match" : "matches"}
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function Line({
	who,
	strong,
	className,
	children,
}: {
	who: string;
	strong?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("grid grid-cols-[4.5rem_1fr] gap-2", className)}>
			<span
				className={cn(
					"pt-px",
					strong ? "font-semibold text-foreground" : "text-text-subtle",
				)}
			>
				{who}
			</span>
			<div className="min-w-0">{children}</div>
		</div>
	);
}
