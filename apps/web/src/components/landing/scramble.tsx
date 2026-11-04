"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "•*#$%&@?/<>";
/** How often unresolved characters change glyph. Every frame reads as noise. */
const SWAP_MS = 55;

/**
 * Shows `text` as scrambled glyphs that resolve left to right, once, on first load.
 * Synced to the entrance animation of the word it sits in, so it decodes while
 * the word rises. If the page hydrates after that moment, the word is already
 * readable and is left alone.
 */
export function Scramble({
	text,
	delay,
	duration = 900,
}: {
	text: string;
	/** ms into the enclosing word's entrance animation to start resolving. */
	delay: number;
	duration?: number;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const [shown, setShown] = useState<string | null>(null);

	useEffect(() => {
		const host = ref.current?.closest<HTMLElement>(".beat-word");
		if (!host) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		// A finished animation's currentTime stops at its end, so read it once and
		// keep the clock running from the moment the animation started.
		const elapsed = host.getAnimations()[0]?.currentTime;
		if (typeof elapsed !== "number" || elapsed > delay) return;
		const origin = performance.now() - elapsed;
		const now = () => performance.now() - origin;

		let raf = 0;
		let lastSwap = -SWAP_MS;
		let noise = "";
		const tick = () => {
			const t = now();
			const progress = (t - delay) / duration;
			if (progress >= 1) {
				setShown(null);
				return;
			}
			const fixed = Math.max(0, Math.floor(progress * text.length));
			if (t - lastSwap >= SWAP_MS) {
				lastSwap = t;
				noise = Array.from(text, (ch) =>
					ch === "." || ch === " "
						? ch
						: (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "•"),
				).join("");
			}
			setShown(text.slice(0, fixed) + noise.slice(fixed));
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			// Never leave a half-decoded word behind if the loop is torn down mid-way.
			setShown(null);
		};
	}, [text, delay, duration]);

	return (
		<span ref={ref} className="relative inline-block">
			{/* The real word holds the width and stays readable to assistive tech. */}
			<span className={shown === null ? undefined : "opacity-0"}>{text}</span>
			{shown === null ? null : (
				<span aria-hidden className="absolute top-0 left-0 whitespace-nowrap">
					{shown}
				</span>
			)}
		</span>
	);
}
