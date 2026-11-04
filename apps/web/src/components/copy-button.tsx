"use client";

import { Button } from "@deebeebridge/ui/components/button";
import { cn } from "@deebeebridge/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/* Both states share one grid cell and crossfade, so the button never changes width.
 * A transition (not keyframes) so a quick re-click retargets instead of restarting. */
const layer =
	"col-start-1 row-start-1 transition-[opacity,transform,filter] duration-160 ease-out motion-reduce:transition-opacity";
const hiddenIcon =
	"scale-90 opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none";
const hiddenLabel = "opacity-0 blur-[2px] motion-reduce:blur-none";

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
				<span aria-hidden className="grid">
					<Copy className={cn(layer, copied && hiddenIcon)} />
					<Check className={cn(layer, !copied && hiddenIcon)} />
				</span>
				<span aria-hidden className="grid font-mono">
					<span className={cn(layer, copied && hiddenLabel)}>Copy</span>
					<span className={cn(layer, !copied && hiddenLabel)}>Copied</span>
				</span>
			</Button>
			<span role="status" className="sr-only">
				{copied ? `Copied ${label}` : ""}
			</span>
		</>
	);
}
