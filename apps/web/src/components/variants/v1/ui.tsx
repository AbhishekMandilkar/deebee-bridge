"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";

import { useCopy } from "@/hooks/use-copy";

export function Wrap({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
			{children}
		</div>
	);
}

export function SectionHead({
	id,
	kicker,
	title,
	lead,
}: {
	id: string;
	kicker: string;
	title: ReactNode;
	lead?: ReactNode;
}) {
	return (
		<header>
			<p className="font-mono text-text-subtle text-xs uppercase tracking-wide">
				{kicker}
			</p>
			<h2
				id={id}
				className="mt-3 max-w-3xl text-balance font-semibold text-3xl text-foreground tracking-tight sm:text-5xl sm:leading-[1.05]"
			>
				{title}
			</h2>
			{lead ? (
				<p className="mt-5 max-w-2xl text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
					{lead}
				</p>
			) : null}
		</header>
	);
}

/** A single shell command with a copy affordance. */
export function InstallBar({
	command,
	label,
	className,
}: {
	command: string;
	label: string;
	className?: string;
}) {
	const { copied, copy } = useCopy(command);
	return (
		<div
			className={cn(
				"flex items-stretch border border-border bg-surface font-mono",
				className,
			)}
		>
			<div className="flex min-w-0 flex-1 items-center overflow-x-auto px-3 sm:px-4">
				<code className="whitespace-nowrap py-3.5 text-foreground text-sm sm:text-base">
					<span aria-hidden className="select-none text-text-subtle">
						${" "}
					</span>
					{command}
				</code>
			</div>
			<button
				type="button"
				onClick={copy}
				aria-label={`Copy ${label}`}
				className="inline-flex min-h-11 min-w-28 shrink-0 cursor-pointer items-center justify-center gap-2 border-border border-l px-4 text-muted-foreground text-sm outline-none transition-colors hover:bg-foreground hover:text-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
			>
				{copied ? (
					<Check aria-hidden className="size-4" />
				) : (
					<Copy aria-hidden className="size-4" />
				)}
				<span aria-hidden>{copied ? "Copied" : "Copy"}</span>
			</button>
			<span role="status" className="sr-only">
				{copied ? `Copied ${label}` : ""}
			</span>
		</div>
	);
}
