import type { ConnectionConfig } from "../connection.js";
import { BridgeError, toBridgeError } from "../errors.js";
import { postgres } from "./postgres.js";
import type { Driver, DriverDefinition } from "./types.js";

/** The one place that lists supported database sources. */
	string,
	DriverDefinition
>;

export function getDriverDefinition(type: string): DriverDefinition {
	const def = (drivers as Record<string, DriverDefinition>)[type];
	if (!def)
		throw new BridgeError(
			"INVALID_CONNECTION",
			`unsupported connection type "${type}"`,
		);
	return def;
}

export function createDriver(
	config: ConnectionConfig,
	password: string,
): Driver {
	return getDriverDefinition(config.type).create(config, password);
}

/** Connect, ping, disconnect. Returns latency in ms; throws a redacted BridgeError. */
export async function probe(
	config: ConnectionConfig,
	password: string,
): Promise<number> {
	const driver = createDriver(config, password);
	const start = performance.now();
	try {
		await driver.ping();
		return Math.round(performance.now() - start);
	} catch (err) {
		throw toBridgeError(err, [password]);
	} finally {
		await driver.close().catch(() => {});
	}
}
