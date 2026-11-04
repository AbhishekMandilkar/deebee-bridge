"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * A list whose 1px grid lines (the list's background, showing through `gap-px`)
 * light up around a fine pointer. The light is its own layer, so moving it
 * restyles one element, not the cards.
 */
export function GlowGrid({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	const listRef = useRef<HTMLUListElement>(null);
	const glowRef = useRef<HTMLLIElement>(null);

	useEffect(() => {
		const list = listRef.current;
		const glow = glowRef.current;
		if (!list || !glow) return;
		if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
			return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const move = (e: PointerEvent) => {
			const r = list.getBoundingClientRect();
			glow.style.setProperty("--x", `${e.clientX - r.left}px`);
			glow.style.setProperty("--y", `${e.clientY - r.top}px`);
			glow.dataset.on = "";
		};
		const leave = () => {
			delete glow.dataset.on;
		};
		list.addEventListener("pointermove", move);
		list.addEventListener("pointerleave", leave);
		return () => {
			list.removeEventListener("pointermove", move);
			list.removeEventListener("pointerleave", leave);
		};
	}, []);

	return (
		<ul ref={listRef} className={cn("relative", className)}>
			<li
				ref={glowRef}
				aria-hidden
				className="glow pointer-events-none absolute inset-0"
			/>
			{children}
		</ul>
	);
}
