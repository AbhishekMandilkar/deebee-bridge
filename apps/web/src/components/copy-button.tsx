"use client";

import { Button } from "@deebeebridge/ui/components/button";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const t = setTimeout(() => setCopied(false), 1800);
		return () => clearTimeout(t);
	}, [copied]);

	return (
		<>
			<Button
				variant="ghost"
				size="lg"
				aria-label={`Copy ${label}`}
				onClick={async () => {
					try {
						await navigator.clipboard.writeText(value);
						setCopied(true);
					} catch {
						// Clipboard is unavailable (insecure context or denied); the text stays selectable.
					}
				}}
				className="h-full min-h-11 min-w-24 px-3.5 text-sm text-text-subtle hover:text-foreground"
			>
				{copied ? <Check aria-hidden /> : <Copy aria-hidden />}
				<span aria-hidden className="font-mono">
					{copied ? "Copied" : "Copy"}
				</span>
			</Button>
			<span role="status" className="sr-only">
				{copied ? `Copied ${label}` : ""}
			</span>
		</>
	);
}
