import { ArrowUpRight } from "lucide-react";

import { DOCS_URL, GITHUB_URL, INSTALL_COMMAND, LICENSE_URL } from "@/lib/site";

import { InstallBar, Wrap } from "./ui";

export function Closing() {
	return (
		<section
			aria-labelledby="v1-cta"
			className="border-border border-t py-24 sm:py-36"
		>
			<Wrap className="text-center">
				<h2
					id="v1-cta"
					className="mx-auto max-w-3xl text-balance font-semibold text-4xl text-foreground tracking-tight sm:text-6xl sm:leading-[1.04]"
				>
					Give your agent a name.
					<span className="block text-text-subtle">Keep the secret.</span>
				</h2>
				<div className="mx-auto mt-10 max-w-md text-left">
					<InstallBar command={INSTALL_COMMAND} label="install command" />
				</div>
				<p className="mt-6 font-mono text-text-subtle text-xs">
					Node 20+ <span aria-hidden>·</span> MIT licensed
				</p>
			</Wrap>
		</section>
	);
}

export function Footer() {
	const links = [
		{ href: GITHUB_URL, label: "GitHub" },
		{ href: DOCS_URL, label: "Docs" },
		{ href: LICENSE_URL, label: "License" },
	];
	return (
		<footer className="border-border border-t py-10 pb-24">
			<Wrap className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
				<p className="font-mono text-sm text-text-subtle">
					deebeebridge <span aria-hidden>·</span> PostgreSQL and MySQL today,
					ClickHouse planned
				</p>
				<nav aria-label="Footer">
					<ul className="flex list-none flex-wrap gap-x-6">
						{links.map((l) => (
							<li key={l.href}>
								<a
									href={l.href}
									className="inline-flex h-11 items-center gap-1 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
								>
									{l.label}
									<ArrowUpRight aria-hidden className="size-3.5" />
								</a>
							</li>
						))}
					</ul>
				</nav>
			</Wrap>
		</footer>
	);
}
