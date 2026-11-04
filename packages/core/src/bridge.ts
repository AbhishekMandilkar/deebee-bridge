import type { ConnectionConfig } from "./connection";
import { getDriverDefinition } from "./drivers/index";
import type { Driver, TableSchema } from "./drivers/types";
import type { Registry } from "./registry";
import { assertReadOnly } from "./safety";
import { capOutput } from "./serialize";

/**
 * What an agent may do with a saved connection, addressed by name. Owns driver
 * lifetimes (one lazily opened driver per connection), the read-only check and
 * output caps, so protocol layers (MCP, a future app) stay thin.
 */
export function createBridge(registry: Registry) {
	const open = new Map<
		string,
		Promise<{ config: ConnectionConfig; driver: Driver }>
	>();

	/** One driver per (connection, database): the same login, a different database. */
	function driverFor(name: string, database?: string) {
		const key = `${name}\0${database ?? ""}`;
		let entry = open.get(key);
		if (!entry) {
			entry = registry.open(name, database);
			entry.catch(() => open.delete(key));
			open.set(key, entry);
		}
		return entry;
	}

	return {
		async listConnections() {
			const all = await registry.list();
			return all.map(({ name, type, database, mode }) => ({
				name,
				type,
				database,
				mode,
			}));
		},

		async listDatabases(connection: string): Promise<string[]> {
			const { driver } = await driverFor(connection);
			return driver.listDatabases();
		},

		async listTables(connection: string, schema?: string, database?: string) {
			const { driver } = await driverFor(connection, database);
			return capOutput(await driver.listTables(schema));
		},

		async describeTable(
			connection: string,
			table: string,
			schema?: string,
			database?: string,
		): Promise<TableSchema> {
			const { driver } = await driverFor(connection, database);
			return driver.describeTable(table, schema);
		},

		async runQuery(
			connection: string,
			sql: string,
			params?: unknown[],
			database?: string,
		) {
			const { config, driver } = await driverFor(connection, database);
			if (config.mode === "read-only") {
				assertReadOnly(
					sql,
					getDriverDefinition(config.type).dialect,
					config.name,
				);
			}
			const start = performance.now();
			const result = await driver.query(sql, {
				params,
				limit: config.rowLimit,
			});
			const out = capOutput(result, result.truncated);
			return { ...out, durationMs: Math.round(performance.now() - start) };
		},

		async close() {
			const entries = [...open.values()];
			open.clear();
			await Promise.all(
				entries.map((e) =>
					e.then(({ driver }) => driver.close()).catch(() => {}),
				),
			);
		},
	};
}

export type Bridge = ReturnType<typeof createBridge>;
