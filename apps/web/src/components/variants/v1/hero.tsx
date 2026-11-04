import { ArrowDown } from "lucide-react";

import { INSTALL_COMMAND } from "@/lib/site";
import { InstallBar, Wrap } from "./ui";
import { Wire } from "./wire";

export function Hero() {
	return (
		<section
			id="top"
			aria-labelledby="v1-title"
			className="relative overflow-hidden"
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 [background-image:radial-gradient(color-mix(in_oklch,var(--foreground)_22%,transparent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_80%_70%_at_30%_0%,black,transparent)]"
			/>
			<Wrap className="relative pt-16 pb-20 sm:pt-24">
				<p className="font-mono text-text-subtle text-xs uppercase tracking-wide">
					MCP server <span aria-hidden>·</span> PostgreSQL{" "}
					<span aria-hidden>·</span> MySQL <span aria-hidden>·</span> open
					source
				</p>
				<h1
					id="v1-title"
					className="mt-6 max-w-4xl font-semibold text-4xl text-foreground tracking-tight sm:text-6xl sm:leading-[1.04] lg:text-7xl lg:leading-[1.02]"
				>
					Your agent queries prod.
					<span className="block text-text-subtle">
						It never sees the password.
					</span>
				</h1>
				<p className="mt-6 max-w-2xl text-pretty text-lg text-text-secondary leading-relaxed sm:text-xl">
					deebeebridge keeps database credentials in a private file on your
					machine and gives AI agents a connection name instead. Five small
					tools, read-only by default, nothing to host.
				</p>
				<div className="mt-9 max-w-md">
					<InstallBar command={INSTALL_COMMAND} label="install command" />
				</div>

				<div id="wire" className="mt-16 scroll-mt-20 sm:mt-20">
					<p className="mb-4 flex items-center gap-2 font-mono text-text-subtle text-xs">
						<ArrowDown aria-hidden className="size-3.5" />
						Pick something to ask. Watch what crosses the wire.
					</p>
					<Wire />
				</div>
			</Wrap>
		</section>
	);
}
