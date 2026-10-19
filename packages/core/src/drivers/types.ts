import type { ConnectionConfig } from "../connection";

export type SqlDialect = "mysql" | "postgresql";

/** A result set as column names + positional rows (compact; no per-row keys). */
export interface Table {
	columns: string[];
	rows: unknown[][];
}

export interface TableSchema {
	columns: {
		name: string;
		type: string;
		nullable: boolean;
		default?: string;
	}[];
	primaryKey: string[];
	indexes: { name: string; columns: string[]; unique: boolean }[];
}

/**
 * What every database source must be able to do once connected.
 * Throw BridgeError for failures a user can act on. The driver owns database-level
 * enforcement of `config.mode` (defense in depth behind the safety classifier).
 */
export interface Driver {
	ping(): Promise<void>;
	/** Tables and views of `schema` (default: the connection's own). Columns: name, type, rows (approx). */
	listTables(schema?: string): Promise<Table>;
	describeTable(table: string, schema?: string): Promise<TableSchema>;
	/** Run one statement; read at most `limit` rows and report whether more existed. */
	query(
		sql: string,
		opts: { params?: unknown[]; limit: number },
	): Promise<Table & { truncated: boolean }>;
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
	/** SQL dialect name for the read-only classifier (node-sql-parser). */
	dialect: SqlDialect;
	/** Build a driver. Must not touch the network until a method is called. */
	create(config: ConnectionConfig, password: string): Driver;
}
