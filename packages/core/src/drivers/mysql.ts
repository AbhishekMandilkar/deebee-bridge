import type { Connection as CallbackConnection } from "mysql2";
import mysql from "mysql2/promise";
import { BridgeError, type ErrorCode } from "../errors.js";
import type { DriverDefinition, Table, TableSchema } from "./types.js";

const ACCESS_DENIED = new Set([
	"ER_ACCESS_DENIED_ERROR",
	"ER_DBACCESS_DENIED_ERROR",
]);
const TIMED_OUT = new Set(["ER_QUERY_TIMEOUT", "PROTOCOL_SEQUENCE_TIMEOUT"]);

function mapError(err: unknown, fallback: ErrorCode): BridgeError {
	const e = err as { code?: string; message?: string };
	const message = e.message ?? String(err);
	if (e.code && ACCESS_DENIED.has(e.code))
		return new BridgeError("AUTH_FAILED", message);
	if (e.code && TIMED_OUT.has(e.code))
		return new BridgeError("TIMEOUT", message);
	return new BridgeError(fallback, message);
}

export const mysqlDriver: DriverDefinition = {
	label: "MySQL",
	defaultPort: 3306,
	dialect: "mysql",
	create(config, password) {
		let pool: mysql.Pool | undefined;
		const getPool = () => {
			if (!pool) {
				pool = mysql.createPool({
					host: config.host,
					port: config.port,
					database: config.database,
					user: config.user,
					password,
					ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
					connectionLimit: 4,
					connectTimeout: config.timeoutMs,
				});
				pool.pool.on("connection", (conn) => {
					// timeoutMs is a validated integer, safe to inline.
					conn.query(`SET SESSION MAX_EXECUTION_TIME=${config.timeoutMs}`);
					// Backstop for read-only connections (see docs/mysql.md).
					if (config.mode === "read-only")
						conn.query("SET SESSION TRANSACTION READ ONLY");
				});
			}
			return pool;
		};

		/** Parameterised catalog query; schema/table names are always bind values. */
		async function catalog(sql: string, params: unknown[]) {
			try {
				const [rows] = await getPool().query({
					sql,
					values: params,
					rowsAsArray: true,
				});
				// biome-ignore lint/suspicious/noExplicitAny: driver rows are untyped positional values
				return rows as any[][];
			} catch (err) {
				throw mapError(err, "QUERY_ERROR");
			}
		}

		return {
			async ping() {
				try {
					await getPool().query("SELECT 1");
				} catch (err) {
					throw mapError(err, "CONNECTION_FAILED");
				}
			},

			async listTables(schema) {
				const rows = await catalog(
					`SELECT TABLE_NAME, IF(TABLE_TYPE = 'BASE TABLE', 'table', 'view'), TABLE_ROWS
					   FROM information_schema.TABLES
					  WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) ORDER BY 1`,
					[schema ?? null],
				);
				return { columns: ["name", "type", "rows"], rows } satisfies Table;
			},

			async describeTable(table, schema): Promise<TableSchema> {
				const cols = await catalog(
					`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE = 'YES', COLUMN_DEFAULT
					   FROM information_schema.COLUMNS
					  WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?
					  ORDER BY ORDINAL_POSITION`,
					[schema ?? null, table],
				);
				if (cols.length === 0) {
					throw new BridgeError("QUERY_ERROR", `table "${table}" not found`);
				}
				const stats = await catalog(
					`SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
					   FROM information_schema.STATISTICS
					  WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?
					  ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
					[schema ?? null, table],
				);
				const indexes = new Map<
					string,
					{ name: string; columns: string[]; unique: boolean }
				>();
				for (const [name, column, nonUnique] of stats) {
					const ix = indexes.get(name) ?? {
						name,
						columns: [] as string[],
						unique: !nonUnique,
					};
					ix.columns.push(column);
					indexes.set(name, ix);
				}
				return {
					columns: cols.map(([name, type, nullable, def]) => ({
						name,
						type,
						nullable: Boolean(nullable),
						...(def == null ? {} : { default: String(def) }),
					})),
					primaryKey: indexes.get("PRIMARY")?.columns ?? [],
					indexes: [...indexes.values()],
				};
			},

			async query(sql, { params, limit }) {
				let conn: mysql.PoolConnection;
				try {
					conn = await getPool().getConnection();
				} catch (err) {
					throw mapError(err, "CONNECTION_FAILED");
				}
				let abandon = false;
				try {
					const q = (conn.connection as unknown as CallbackConnection).query({
						sql,
						values: params,
						rowsAsArray: true,
						timeout: config.timeoutMs,
					});
					// Collect row events and stop at limit + 1, instead of buffering everything.
					return await new Promise<Table & { truncated: boolean }>(
						(resolve, reject) => {
							let columns: string[] = [];
							const rows: unknown[][] = [];
							q.on("fields", (fields?: { name: string }[]) => {
								// undefined for statements without a result set
								columns = fields?.map((f) => f.name) ?? [];
							});
							q.on("result", (row: unknown) => {
								if (!Array.isArray(row)) {
									// Statements without a result set report an OK packet instead of rows.
									const { affectedRows = 0 } = row as { affectedRows?: number };
									columns = ["affectedRows"];
									rows.push([affectedRows]);
								} else if (rows.length <= limit) {
									rows.push(row);
									if (rows.length > limit) {
										// The server may still be producing rows: drop the connection.
										abandon = true;
										resolve({
											columns,
											rows: rows.slice(0, limit),
											truncated: true,
										});
									}
								}
							});
							q.on("error", reject);
							q.on("end", () => resolve({ columns, rows, truncated: false }));
						},
					);
				} catch (err) {
					abandon = true;
					throw mapError(err, "QUERY_ERROR");
				} finally {
					if (abandon) conn.destroy();
					else conn.release();
				}
			},

			async close() {
				const p = pool;
				pool = undefined;
				await p?.end();
			},
		};
	},
};
