import { buttonVariants } from "@deebeebridge/ui/components/button";
import { cn } from "@deebeebridge/ui/lib/utils";

import { ThemeToggle } from "../theme-toggle";
import { Container, GITHUB_URL } from "./shared";

const links = [
	{ href: "#problem", label: "Problem" },
	{ href: "#setup", label: "Set up" },
	{ href: "#how-it-works", label: "How it works" },
];

const linkClass = cn(
	buttonVariants({ variant: "ghost" }),
	"h-11 px-3 text-sm text-muted-foreground hover:text-foreground",
);

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
			<Container className="flex h-14 items-center justify-between">
				<a
					href="#top"
					className="font-mono text-sm font-semibold tracking-tight text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					deebeebridge
				</a>
				<nav aria-label="Primary" className="flex items-center gap-1">
					{links.map((l) => (
						<a
							key={l.href}
							href={l.href}
							className={cn(linkClass, "hidden md:inline-flex")}
						>
							{l.label}
						</a>
					))}
					<a href={GITHUB_URL} className={linkClass}>
						GitHub
					</a>
					<ThemeToggle />
				</nav>
			</Container>
		</header>
	);
}
