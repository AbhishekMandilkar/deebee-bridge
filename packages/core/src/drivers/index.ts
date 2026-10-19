import type { ConnectionConfig } from "../connection.js";
import { BridgeError, type ErrorCode, toBridgeError } from "../errors.js";
import { mysqlDriver as mysql } from "./mysql.js";
import { postgres } from "./postgres.js";
import type { Driver, DriverDefinition } from "./types.js";

/** The one place that lists supported database sources. */
export const drivers = { postgres, mysql } satisfies Record<
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

/**
 * Every error leaving a driver is a BridgeError with the password masked, whatever the
 * source library put in its message. Done here once so new sources cannot forget it.
 */
export function redactErrors(driver: Driver, password: string): Driver {
	const guard =
		<A extends unknown[], R>(
			fn: (...args: A) => Promise<R>,
			fallback: ErrorCode,
		) =>
		async (...args: A): Promise<R> => {
			try {
				return await fn(...args);
			} catch (err) {
				throw toBridgeError(err, [password], fallback);
			}
		};
	return {
		ping: guard(() => driver.ping(), "CONNECTION_FAILED"),
		listTables: guard((s) => driver.listTables(s), "QUERY_ERROR"),
		describeTable: guard((t, s) => driver.describeTable(t, s), "QUERY_ERROR"),
		query: guard((sql, opts) => driver.query(sql, opts), "QUERY_ERROR"),
		close: () => driver.close(),
	};
}

export function createDriver(
	config: ConnectionConfig,
	password: string,
): Driver {
	return redactErrors(
		getDriverDefinition(config.type).create(config, password),
		password,
	);
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
	} finally {
		await driver.close().catch(() => {});
	}
}
