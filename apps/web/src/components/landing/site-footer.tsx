import { Container, DOCS_URL, GITHUB_URL } from "./shared";

const links = [
	{ href: GITHUB_URL, label: "GitHub" },
	{ href: DOCS_URL, label: "Docs" },
	{ href: `${GITHUB_URL}/blob/main/LICENSE`, label: "MIT license" },
];

export function SiteFooter() {
	return (
		<footer className="border-t border-border py-10">
			<Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="font-mono text-sm font-semibold text-foreground">
						deebeebridge
					</p>
					<p className="mt-1 text-sm text-text-subtle">
						PostgreSQL and MySQL today. ClickHouse planned.
					</p>
				</div>
				<nav aria-label="Footer">
					<ul className="flex list-none flex-wrap gap-x-6">
						{links.map((l) => (
							<li key={l.href}>
								<a
									href={l.href}
									className="inline-flex h-11 items-center text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
								>
									{l.label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			</Container>
		</footer>
	);
}
