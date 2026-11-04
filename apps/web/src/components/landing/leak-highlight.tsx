"use client";

import { useEffect, useRef, useState } from "react";

/**
 * static: highlighted, no motion (server render, no JS, reduced motion, already on screen)
 * armed:  below the fold at hydration, highlight hidden until it scrolls into view
 * lit:    highlight sweeps in once
 */
type Phase = "static" | "armed" | "lit";

/** Marks a leaked secret. The highlight draws across it once, the first time it scrolls into view. */
export function LeakHighlight({ children }: { children: string }) {
	const ref = useRef<HTMLElement>(null);
	const [phase, setPhase] = useState<Phase>("static");

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		// Already visible: the reader has seen it highlighted, so don't take it away.
		if (el.getBoundingClientRect().top < window.innerHeight) return;

		setPhase("armed");
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return;
				setPhase("lit");
				io.disconnect();
			},
			{ rootMargin: "0px 0px -25% 0px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<mark
			ref={ref}
			data-phase={phase}
			className="group relative inline-block bg-transparent px-1 text-foreground"
		>
			{children}
			<span
				aria-hidden
				className="absolute inset-0 bg-foreground px-1 text-background select-none [clip-path:inset(0)] group-data-[phase=armed]:[clip-path:inset(0_100%_0_0)] group-data-[phase=lit]:transition-[clip-path] group-data-[phase=lit]:delay-150 group-data-[phase=lit]:duration-600 group-data-[phase=lit]:ease-in-out"
			>
				{children}
			</span>
		</mark>
	);
}
