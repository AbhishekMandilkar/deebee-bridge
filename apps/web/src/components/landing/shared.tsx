import { cn } from "@deebeebridge/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

import { CopyButton } from "../copy-button";
import { at, Typed, typingMs, Words } from "./motion";
import { Stage } from "./stage";

export const GITHUB_URL = "https://github.com/AbhishekMandilkar/deebee-bridge";
export const DOCS_URL = `${GITHUB_URL}/tree/main/docs`;
export const INSTALL_COMMAND = "npm i -g deebeebridge";

export function Container({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("mx-auto w-full max-w-5xl px-5 sm:px-8", className)}>
			{children}
		</div>
	);
}

export function Section({
	id,
	index,
	label,
	title,
	lead,
	children,
}: {
	id: string;
	index: string;
	label: string;
	title: ReactNode;
	lead?: ReactNode;
	children: ReactNode;
}) {
	// The title rises in word by word, then the lead follows.
	const WORD_START = 120;
	const WORD_STEP = 35;
	const wordCount = typeof title === "string" ? title.split(" ").length : 4;
	const leadAt = WORD_START + wordCount * WORD_STEP + 150;
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className="border-t border-border py-20 sm:py-28"
		>
			<Container>
				<Stage>
					<p
						className="beat font-mono text-xs tracking-wide text-text-subtle uppercase"
						style={at(0)}
					>
						<span aria-hidden>{index} / </span>
						{label}
					</p>
					<h2
						id={`${id}-title`}
						className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl"
					>
						{typeof title === "string" ? (
							<Words text={title} start={WORD_START} step={WORD_STEP} />
						) : (
							title
						)}
					</h2>
					{lead ? (
						<p
							className="beat mt-4 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
							style={at(leadAt)}
						>
							{lead}
						</p>
					) : null}
				</Stage>
				<div className="mt-12">{children}</div>
			</Container>
		</section>
	);
}

/** A framed block of monospaced text. Scrolls sideways on narrow screens. */
export function Terminal({
	title,
	children,
	className,
	style,
	wrap = false,
}: {
	title: string;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	/** Wrap long lines instead of scrolling. Children should be `Line`s. */
	wrap?: boolean;
}) {
	const body = "p-4 font-mono text-sm leading-relaxed text-foreground";
	return (
		<figure
			className={cn("border border-border bg-surface", className)}
			style={style}
		>
			<figcaption className="border-b border-border px-4 py-2 font-mono text-xs text-text-subtle">
				{title}
			</figcaption>
			{wrap ? (
				<div className={cn(body, "space-y-1")}>{children}</div>
			) : (
				<pre
					className={cn(
						body,
						"overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
					)}
				>
					{children}
				</pre>
			)}
		</figure>
	);
}

/** One row of a wrapping terminal: a fixed gutter, then text that wraps in its own column. */
export function Line({
	speaker,
	className,
	style,
	children,
}: {
	speaker?: string;
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex gap-3", className)} style={style}>
			<span
				aria-hidden={speaker ? undefined : true}
				className="w-12 shrink-0 text-text-subtle select-none"
			>
				{speaker}
			</span>
			<div className="min-w-0 break-words">{children}</div>
		</div>
	);
}

/** Dim, non-selectable gutter text such as a shell prompt or speaker label. */
export function Gutter({
	children,
	width,
	decorative = true,
}: {
	children: ReactNode;
	width?: string;
	decorative?: boolean;
}) {
	return (
		<span
			aria-hidden={decorative || undefined}
			className="inline-block shrink-0 text-text-subtle select-none"
			style={width ? { minWidth: width } : undefined}
		>
			{children}
		</span>
	);
}

export function Dim({ children }: { children: ReactNode }) {
	return <span className="text-text-subtle">{children}</span>;
}

/** How long a `CommandLine` with `at` takes to arrive and type its command. */
export const commandLineMs = (command: string) => 250 + typingMs(command);

/** A single copyable shell command in a bordered bar. With `at`, it arrives and types itself out. */
export function CommandLine({
	command,
	label,
	size = "md",
	at: start,
}: {
	command: string;
	label: string;
	size?: "md" | "lg";
	at?: number;
}) {
	const animated = start !== undefined;
	return (
		<div
			className={cn(
				"flex items-stretch justify-between border border-border bg-surface",
				animated && "beat",
			)}
			style={animated ? at(start) : undefined}
		>
			<div className="flex min-w-0 items-center overflow-x-auto px-4 py-3 font-mono">
				<code
					className={cn(
						"whitespace-nowrap text-foreground",
						size === "lg" ? "text-sm sm:text-base" : "text-sm",
					)}
				>
					<span aria-hidden className="text-text-subtle select-none">
						${" "}
					</span>
					{animated ? <Typed text={command} at={start + 250} caret /> : command}
				</code>
			</div>
			<div className="flex shrink-0 items-center border-l border-border">
				<CopyButton value={command} label={label} />
			</div>
		</div>
	);
}

export function InlineCode({ children }: { children: ReactNode }) {
	return (
		<code className="border border-border bg-surface px-1.5 py-0.5 font-mono whitespace-nowrap text-[0.85em] text-foreground">
			{children}
		</code>
	);
}
