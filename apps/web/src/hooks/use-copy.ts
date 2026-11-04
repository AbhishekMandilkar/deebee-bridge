"use client";

import { useEffect, useState } from "react";

export function useCopy(value: string) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const t = setTimeout(() => setCopied(false), 1800);
		return () => clearTimeout(t);
	}, [copied]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
		} catch {
			// Clipboard unavailable (insecure context or denied); the text stays selectable.
		}
	}

	return { copied, copy };
}
