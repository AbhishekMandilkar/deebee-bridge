import { buttonVariants } from "@deebeebridge/ui/components/button";
import { cn } from "@deebeebridge/ui/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";
import { GITHUB_URL } from "@/lib/site";

import { Wrap } from "./ui";

const links = [
	{ href: "#wire", label: "Demo" },
	{ href: "#setup", label: "Set up" },
	{ href: "#guardrails", label: "Guardrails" },
	{ href: "#faq", label: "FAQ" },
];

const linkClass = cn(
	buttonVariants({ variant: "ghost" }),
	"h-11 px-3 text-muted-foreground text-sm hover:text-foreground",
);

export function Header() {
	return (
		<header className="sticky top-0 z-40 border-border border-b bg-background/85 backdrop-blur">
			<Wrap className="flex h-14 items-center justify-between">
				<a
					href="#top"
					className="flex items-center gap-2 font-mono font-semibold text-foreground text-sm tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<span aria-hidden className="size-2.5 bg-foreground" />
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
			</Wrap>
		</header>
	);
}
