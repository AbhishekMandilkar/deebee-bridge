"use client";

import { cn } from "@deebeebridge/ui/lib/utils";
import { useEffect, useRef } from "react";

/** Radius of the lens that brightens the grid under the pointer, in px. */
const R = 240;
/** Fraction of the remaining distance the lens covers each frame: a soft follow. */
const FOLLOW = 0.14;

const grid =
	"absolute inset-0 bg-[radial-gradient(var(--foreground)_1px,transparent_1px)] bg-size-[28px_28px] [mask-image:radial-gradient(ellipse_75%_80%_at_75%_35%,black,transparent)]";

/**
 * A dot grid behind the hero. With a fine pointer, a lens follows the cursor
 * and shows a brighter copy of the grid. Lens and copy move in opposite
 * directions by transform only, so the dots stay registered and nothing repaints.
 */
export function HeroBackdrop() {
	const rootRef = useRef<HTMLDivElement>(null);
	const lensRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const root = rootRef.current;
		const lens = lensRef.current;
		const inner = innerRef.current;
		const host = root?.parentElement;
		if (!root || !lens || !inner || !host) return;
		if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
			return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const fit = () => {
			inner.style.width = `${root.offsetWidth}px`;
			inner.style.height = `${root.offsetHeight}px`;
		};
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(root);

		let tx = 0;
		let ty = 0;
		let x = 0;
		let y = 0;
		let raf = 0;
		let placed = false;

		const frame = () => {
			x += (tx - x) * FOLLOW;
			y += (ty - y) * FOLLOW;
			lens.style.transform = `translate3d(${x - R}px, ${y - R}px, 0)`;
			inner.style.transform = `translate3d(${R - x}px, ${R - y}px, 0)`;
			raf =
				Math.abs(tx - x) + Math.abs(ty - y) > 0.3
					? requestAnimationFrame(frame)
					: 0;
		};
		const move = (e: PointerEvent) => {
			const r = root.getBoundingClientRect();
			tx = e.clientX - r.left;
			ty = e.clientY - r.top;
			if (!placed) {
				// Appear where the pointer is instead of sliding in from the last exit.
				x = tx;
				y = ty;
				placed = true;
			}
			lens.dataset.on = "";
			if (!raf) raf = requestAnimationFrame(frame);
		};
		const leave = () => {
			delete lens.dataset.on;
			placed = false;
		};

		host.addEventListener("pointermove", move);
		host.addEventListener("pointerleave", leave);
		return () => {
			ro.disconnect();
			cancelAnimationFrame(raf);
			host.removeEventListener("pointermove", move);
			host.removeEventListener("pointerleave", leave);
		};
	}, []);

	return (
		<div
			ref={rootRef}
			aria-hidden
			className="pointer-events-none absolute inset-0 -z-10"
		>
			<div className={cn(grid, "hero-grid opacity-[0.14]")} />
			<div
				ref={lensRef}
				className="absolute top-0 left-0 overflow-hidden rounded-full opacity-0 transition-opacity duration-500 ease-out [mask-image:radial-gradient(closest-side,black,transparent)] data-on:opacity-100"
				style={{ width: R * 2, height: R * 2 }}
			>
				<div
					ref={innerRef}
					className={cn(grid, "inset-auto top-0 left-0 opacity-70")}
				/>
			</div>
		</div>
	);
}
