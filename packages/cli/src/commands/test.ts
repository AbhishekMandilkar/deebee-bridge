import { probe, type Registry } from "@deebeebridge/core";

export async function testCommand(
	registry: Registry,
	name: string,
): Promise<void> {
	const conn = await registry.get(name);
	const password = await registry.password(name);
	console.log(`"${name}" OK (${await probe(conn, password)}ms)`);
}
