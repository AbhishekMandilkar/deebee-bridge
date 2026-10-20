import { buttonVariants } from "@deebeebridge/ui/components/button";
import { cn } from "@deebeebridge/ui/lib/utils";
import { ArrowDown } from "lucide-react";

import { CommandLine, Container, INSTALL_COMMAND } from "./shared";

export function Hero() {
	return (
		<section id="top" aria-labelledby="hero-title" className="py-20 sm:py-32">
			<Container>
				<p className="font-mono text-xs tracking-wide text-text-subtle uppercase">
					CLI + MCP server · PostgreSQL · MySQL
				</p>
				<h1
					id="hero-title"
					className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl sm:leading-[1.05]"
				>
					Give your agent the database.{" "}
					<span className="block text-text-subtle">Not the password.</span>
				</h1>
				<p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-text-secondary sm:text-xl">
					Save a connection once and the password goes into your OS keychain.
					Claude Code, Cursor and any MCP client reach the database by name, and
					never see a host, user or password.
				</p>

				<div className="mt-10 max-w-xl">
					<CommandLine
						command={INSTALL_COMMAND}
						label="install command"
						size="lg"
					/>
					<div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
						<a
							href="#setup"
							className={cn(
								buttonVariants({ variant: "link" }),
								"h-11 px-0 text-sm text-foreground",
							)}
						>
							Set it up in three steps
							<ArrowDown aria-hidden />
						</a>
						<p className="font-mono text-xs text-text-subtle">
							Node 20+ · MIT licensed
						</p>
					</div>
				</div>
			</Container>
		</section>
	);
}
