import type { CSSProperties, ReactNode } from "react";

/*
 * Server-safe building blocks for the landing motion system in index.css.
 * Timing is written in ms from when the enclosing <Stage> plays (or from page
 * load, outside a stage). `--base` on an ancestor shifts a whole group.
 */

/** Delay for a `beat*` element. */
export function at(ms: number, { base = true } = {}): CSSProperties {
	return {
		"--at": base ? `calc(var(--base, 0ms) + ${ms}ms)` : `${ms}ms`,
	} as CSSProperties;
}

/** One word that rises out of its own line. */
export function MaskedWord({
	at: start,
	children,
}: {
	at: number;
	children: ReactNode;
}) {
	return (
		<span className="word-mask">
			<span className="beat-word" style={at(start)}>
				{children}
			</span>
		</span>
	);
}

/** A run of words that rise in one after another. */
export function Words({
	text,
	start,
	step,
}: {
	text: string;
	start: number;
	step: number;
}) {
	const words = text.split(" ");
	return words.map((word, i) => (
		// Words repeat, so the index is part of the identity.
		// biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
		<span key={i}>
			<MaskedWord at={start + i * step}>{word}</MaskedWord>
			{i < words.length - 1 ? " " : null}
		</span>
	));
}

/** ms per typed character. Keep in step with `--char-ms` in index.css. */
const CHAR_MS = 24;

/** How long `Typed` takes to type `text`, in ms. */
export const typingMs = (text: string) => text.length * CHAR_MS;

/** Monospace text typed out one character at a time, optionally with a caret. */
export function Typed({
	text,
	at: start,
	caret = false,
}: {
	text: string;
	at: number;
	caret?: boolean;
}) {
	return (
		<span
			className="relative inline-block align-top"
			style={{ "--n": text.length } as CSSProperties}
		>
			<span className="beat-type inline-block" style={at(start)}>
				{text}
			</span>
			{caret ? (
				<span
					aria-hidden
					className="beat-caret absolute inset-y-0.5 left-0 w-[1ch] bg-foreground/70"
					style={at(start)}
				/>
			) : null}
		</span>
	);
}

/** Three dots that pulse for `duration` ms, then give way to what follows. */
export function Thinking({
	at: start,
	duration,
}: {
	at: number;
	duration: number;
}) {
	return (
		<span
			aria-hidden
			className="beat-thinking absolute inset-y-0 left-0 flex items-center gap-1"
			style={{ ...at(start), "--for": `${duration}ms` } as CSSProperties}
		>
			{[0, 150, 300].map((delay) => (
				<span
					key={delay}
					className="size-1 bg-foreground"
					style={{ animationDelay: `calc(var(--at) + ${delay}ms)` }}
				/>
			))}
		</span>
	);
}
