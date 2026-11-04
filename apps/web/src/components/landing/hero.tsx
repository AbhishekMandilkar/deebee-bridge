import { buttonVariants } from "@deebeebridge/ui/components/button";
import { cn } from "@deebeebridge/ui/lib/utils";
import { ArrowDown } from "lucide-react";

import { HeroBackdrop } from "./hero-backdrop";
import { at, MaskedWord, Words } from "./motion";
import { Scramble } from "./scramble";
import {
	CommandLine,
	Container,
	commandLineMs,
	INSTALL_COMMAND,
} from "./shared";

/*
 * Load sequence, in ms. It plays on page load (there's no Stage here), as CSS
 * animations, so it stays smooth while the page hydrates.
 */
const LINE_ONE = "Give your agent the database.";
const WORD_START = 120;
const WORD_STEP = 60;
const lineOneWords = LINE_ONE.split(" ").length;
const NOT_AT = WORD_START + lineOneWords * WORD_STEP;
const PASSWORD_AT = NOT_AT + 2 * WORD_STEP;
const LEAD_AT = PASSWORD_AT + 220;
const COMMAND_AT = LEAD_AT + 140;
const META_AT = COMMAND_AT + commandLineMs(INSTALL_COMMAND);

export function Hero() {
	return (
		<section
			id="top"
			aria-labelledby="hero-title"
			className="relative isolate overflow-hidden py-20 sm:py-32"
		>
			<HeroBackdrop />
			<Container>
				<p
					className="beat font-mono text-xs tracking-wide text-text-subtle uppercase"
					style={at(0)}
				>
					CLI + MCP server · PostgreSQL · MySQL
				</p>
				<h1
					id="hero-title"
					className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl sm:leading-[1.05]"
				>
					<Words text={LINE_ONE} start={WORD_START} step={WORD_STEP} />{" "}
					<span className="block text-text-subtle">
						<MaskedWord at={NOT_AT}>Not</MaskedWord>{" "}
						<MaskedWord at={NOT_AT + WORD_STEP}>the</MaskedWord>{" "}
						<MaskedWord at={PASSWORD_AT}>
							{/* Decodes from glyphs while it rises: the one word the agent never sees. */}
							<Scramble text="password." delay={PASSWORD_AT + 200} />
						</MaskedWord>
					</span>
				</h1>
				<p
					className="beat mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-text-secondary sm:text-xl"
					style={at(LEAD_AT)}
				>
					Save a connection once and the password goes into a private file only
					you can read. Claude Code, Cursor and any MCP client reach the
					database by name, and never see a host, user or password.
				</p>

				<div className="mt-10 max-w-xl">
					<CommandLine
						command={INSTALL_COMMAND}
						label="install command"
						size="lg"
						at={COMMAND_AT}
					/>
					<div
						className="beat mt-4 flex flex-wrap items-center gap-x-6 gap-y-2"
						style={at(META_AT)}
					>
						<a
							href="#setup"
							className={cn(
								buttonVariants({ variant: "link" }),
								"group h-11 px-0 text-sm text-foreground",
							)}
						>
							Set it up in three steps
							<ArrowDown
								aria-hidden
								className="transition-transform duration-200 ease-out motion-safe:group-hover:translate-y-0.5"
							/>
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
