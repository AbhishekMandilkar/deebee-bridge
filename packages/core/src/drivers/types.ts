import type { ConnectionConfig } from "../connection.js";

/**
 * What every database source must be able to do once connected.
 * Grows with the MCP tools (listTables, describeTable, query, ...); only what the
 * CLI needs today is here. Throw BridgeError for failures a user can act on.
 */
export interface Driver {
	ping(): Promise<void>;
	close(): Promise<void>;
}

/**
 * Everything the framework needs to know about a database source.
 * Adding a source = one file exporting a DriverDefinition + one line in drivers/index.ts.
 */
export interface DriverDefinition {
	/** Human name shown in prompts. */
	label: string;
	defaultPort: number;
	/** Build a driver. Must not touch the network until a method is called. */
	create(config: ConnectionConfig, password: string): Driver;
}
