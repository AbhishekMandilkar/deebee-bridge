import type { ConnectionConfig } from "./connection.js";
import { getDriverDefinition } from "./drivers/index.js";
import type { Driver, TableSchema } from "./drivers/types.js";
import type { Registry } from "./registry.js";
import { assertReadOnly } from "./safety.js";
import { capOutput } from "./serialize.js";

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

	function driverFor(name: string) {
		let entry = open.get(name);
		if (!entry) {
			entry = registry.open(name);
			entry.catch(() => open.delete(name));
			open.set(name, entry);
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

		async listTables(connection: string, schema?: string) {
			const { driver } = await driverFor(connection);
			return capOutput(await driver.listTables(schema));
		},

		async describeTable(
			connection: string,
			table: string,
			schema?: string,
		): Promise<TableSchema> {
			const { driver } = await driverFor(connection);
			return driver.describeTable(table, schema);
		},

		async runQuery(connection: string, sql: string, params?: unknown[]) {
			const { config, driver } = await driverFor(connection);
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
