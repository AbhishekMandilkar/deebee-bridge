import type { Registry } from "@deebeebridge/core";
import { table } from "../io";

export async function listCommand(
	registry: Registry,
	flags: { json?: boolean },
): Promise<void> {
	const conns = await registry.list();
	if (flags.json) {
		console.log(JSON.stringify(conns, null, 2));
	} else if (conns.length === 0) {
		console.log("No connections. Run `deebeebridge add`.");
	} else {
		console.log(
			table(
				["NAME", "TYPE", "HOST", "DATABASE", "USER", "MODE"],
				conns.map((c) => [
					c.name,
					c.type,
					`${c.host}:${c.port}`,
					c.database,
					c.user,
					c.mode,
				]),
			),
		);
	}
}
