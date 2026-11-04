import { at, Thinking } from "./motion";
import { Dim, Line, Section, Terminal } from "./shared";
import { Stage } from "./stage";

/** A secret marked like a highlighter pass: drawn across once the line has arrived. */
function Leaked({ children, sweepAt }: { children: string; sweepAt: number }) {
	return (
		<mark className="relative inline-block bg-transparent px-1 text-foreground">
			{children}
			<span
				aria-hidden
				className="beat-sweep absolute inset-0 bg-foreground px-1 text-background select-none"
				style={at(sweepAt)}
			>
				{children}
			</span>
		</mark>
	);
}

/*
 * Each terminal plays as its own conversation when it scrolls into view. Side by
 * side on large screens, the right one waits (`--base`) until the left one has
 * leaked its password, so the two read as before and after.
 */
export function Problem() {
	return (
		<Section
			id="problem"
			index="01"
			label="The problem"
			title="Agents need your database. Pasting the password is how they get it."
			lead="A DATABASE_URL in a prompt, a .env the agent can read, a config in a repo. Each puts a live password in front of a model and into its transcript. deebeebridge swaps it for a name."
		>
			<div className="grid gap-6 lg:grid-cols-2">
				<Stage>
					<Terminal
						title="Without: the password is in the prompt"
						wrap
						className="beat"
						style={at(0)}
					>
						<Line speaker="you" className="beat" style={at(250)}>
							Query our prod database. Here is the URL:
						</Line>
						<Line className="beat" style={at(650)}>
							<span className="[overflow-wrap:anywhere]">
								postgres://admin:
								<Leaked sweepAt={1150}>hunter2</Leaked>
								@db.internal/app
							</span>
						</Line>
					</Terminal>
					<p
						className="beat mt-3 text-sm leading-relaxed text-muted-foreground"
						style={at(1600)}
					>
						The highlighted password now sits in the prompt, the transcript and
						the model's context window.
					</p>
				</Stage>
				<Stage className="lg:[--base:1100ms]">
					<Terminal
						title="With deebeebridge: only a name"
						wrap
						className="beat"
						style={at(100, { base: false })}
					>
						<Line speaker="you" className="beat" style={at(250)}>
							Using the app-db connection, which tables have the most rows?
						</Line>
						<Line speaker="agent" className="beat" style={at(750)}>
							<span className="relative block">
								<Thinking at={750} duration={900} />
								<span className="beat block" style={at(1650)}>
									list_tables {"{"} connection:{" "}
									<b className="font-semibold">"app-db"</b> {"}"}
								</span>
							</span>
						</Line>
						<Line className="beat" style={at(2150)}>
							<Dim>→ orders 1.2M, events 880K, users 41K …</Dim>
						</Line>
					</Terminal>
					<p
						className="beat mt-3 text-sm leading-relaxed text-muted-foreground"
						style={at(2500)}
					>
						The agent holds{" "}
						<b className="font-medium text-foreground">app-db</b> and nothing
						else. The password stays in a private file on your machine.
					</p>
				</Stage>
			</div>
		</Section>
	);
}
