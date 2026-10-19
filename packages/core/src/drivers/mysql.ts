import mysql from "mysql2/promise";
import { BridgeError } from "../errors.js";
import type { DriverDefinition } from "./types.js";

const ACCESS_DENIED = new Set([
	"ER_ACCESS_DENIED_ERROR",
	"ER_DBACCESS_DENIED_ERROR",
]);

function mapError(err: unknown): BridgeError {
	const e = err as { code?: string; message?: string };
	const message = e.message ?? String(err);
	if (e.code && ACCESS_DENIED.has(e.code))
		return new BridgeError("AUTH_FAILED", message);
	return new BridgeError("CONNECTION_FAILED", message);
}

export const mysqlDriver: DriverDefinition = {
	label: "MySQL",
	defaultPort: 3306,
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
				// Defense in depth for read-only connections (see docs/mysql.md).
				if (config.mode === "read-only") {
					pool.pool.on("connection", (conn) => {
						conn.query("SET SESSION TRANSACTION READ ONLY");
					});
				}
			}
			return pool;
		};
		return {
			async ping() {
				try {
					await getPool().query("SELECT 1");
				} catch (err) {
					throw mapError(err);
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
