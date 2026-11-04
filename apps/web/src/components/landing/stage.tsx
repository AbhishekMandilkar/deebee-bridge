"use client";

import type { CSSProperties, ReactNode } from "react";

import { useInView } from "@/hooks/use-in-view";

/**
 * Holds the `beat*` and `flow-*` animations inside it at their first frame
 * until it scrolls into view. With `once={false}` it also pauses them again
 * when it leaves, which is what looping animations want.
 */
export function Stage({
	className,
	style,
	once = true,
	children,
}: {
	className?: string;
	style?: CSSProperties;
	once?: boolean;
	children: ReactNode;
}) {
	const [ref, inView] = useInView<HTMLDivElement>({
		once,
		rootMargin: "0px 0px -15% 0px",
	});
	return (
		<div
			ref={ref}
			data-stage=""
			data-play={inView ? "" : undefined}
			className={className}
			style={style}
		>
			{children}
		</div>
	);
}
