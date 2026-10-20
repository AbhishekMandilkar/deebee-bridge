import { Dim, Line, Section, Terminal } from "./shared";

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
				<div>
					<Terminal title="Without: the password is in the prompt" wrap>
						<Line speaker="you">Query our prod database. Here is the URL:</Line>
						<Line>
							<span className="[overflow-wrap:anywhere]">
								postgres://admin:
								<mark className="bg-foreground px-1 text-background">
									hunter2
								</mark>
								@db.internal/app
							</span>
						</Line>
					</Terminal>
					<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
						The highlighted password now sits in the prompt, the transcript and
						the model's context window.
					</p>
				</div>
				<div>
					<Terminal title="With deebeebridge: only a name" wrap>
						<Line speaker="you">
							Using the app-db connection, which tables have the most rows?
						</Line>
						<Line speaker="agent">
							list_tables {"{"} connection:{" "}
							<b className="font-semibold">"app-db"</b> {"}"}
						</Line>
						<Line>
							<Dim>→ orders 1.2M, events 880K, users 41K …</Dim>
						</Line>
					</Terminal>
					<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
						The agent holds{" "}
						<b className="font-medium text-foreground">app-db</b> and nothing
						else. The password stays in your keychain.
					</p>
				</div>
			</div>
		</Section>
	);
}
