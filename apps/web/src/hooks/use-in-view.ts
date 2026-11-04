"use client";

import { useEffect, useRef, useState } from "react";

/** Reports whether the referenced element has entered the viewport. Latches true unless `once` is false. */
export function useInView<T extends Element>({
	once = true,
	rootMargin = "0px 0px -10% 0px",
	threshold = 0,
}: {
	once?: boolean;
	rootMargin?: string;
	threshold?: number;
} = {}) {
	const ref = useRef<T>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry) return;
				if (entry.isIntersecting) {
					setInView(true);
					if (once) io.disconnect();
				} else if (!once) {
					setInView(false);
				}
			},
			{ rootMargin, threshold },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [once, rootMargin, threshold]);

	return [ref, inView] as const;
}
