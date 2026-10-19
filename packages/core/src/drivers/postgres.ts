import pg from "pg";
import { BridgeError } from "../errors.js";
import type { DriverDefinition } from "./types.js";

const AUTH_SQLSTATES = new Set(["28000", "28P01"]);

function mapError(err: unknown): BridgeError {
	const e = err as { code?: string; message?: string };
	const message = e.message ?? String(err);
	if (e.code && AUTH_SQLSTATES.has(e.code))
		return new BridgeError("AUTH_FAILED", message);
	return new BridgeError("CONNECTION_FAILED", message);
}

export const postgres: DriverDefinition = {
	label: "PostgreSQL",
	defaultPort: 5432,
	create(config, password) {
		let pool: pg.Pool | undefined;
		const getPool = () => {
			pool ??= new pg.Pool({
				host: config.host,
				port: config.port,
				database: config.database,
				user: config.user,
				password,
				ssl: config.ssl,
				max: 4,
				connectionTimeoutMillis: config.timeoutMs,
				statement_timeout: config.timeoutMs,
				// Defense in depth for read-only connections (see docs/postgres.md).
				options:
					config.mode === "read-only"
						? "-c default_transaction_read_only=on"
						: undefined,
			});
			// An idle-client error must not crash the process.
			pool.on("error", () => {});
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
