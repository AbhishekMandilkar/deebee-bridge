import pg from "pg";
import Cursor from "pg-cursor";
import { BridgeError, type ErrorCode } from "../errors";
import type { DriverDefinition, Table, TableSchema } from "./types";

const AUTH_SQLSTATES = new Set(["28000", "28P01"]);
const QUERY_CANCELED = "57014"; // statement_timeout

function mapError(err: unknown, fallback: ErrorCode): BridgeError {
	const e = err as { code?: string; message?: string };
	const message = e.message ?? String(err);
	if (e.code && AUTH_SQLSTATES.has(e.code))
		return new BridgeError("AUTH_FAILED", message);
	if (e.code === QUERY_CANCELED) return new BridgeError("TIMEOUT", message);
	return new BridgeError(fallback, message);
}

export const postgres: DriverDefinition = {
	label: "PostgreSQL",
	defaultPort: 5432,
	dialect: "postgresql",
	create(config, password) {
		const readOnly = config.mode === "read-only";
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
				// Backstop for read-only connections (see docs/postgres.md).
				options: readOnly ? "-c default_transaction_read_only=on" : undefined,
			});
			// An idle-client error must not crash the process.
			pool.on("error", () => {});
			return pool;
		};

		/** Parameterised catalog query; schema/table names are always bind values. */
		async function catalog(sql: string, params: unknown[]) {
			try {
				return (
					await getPool().query({ text: sql, values: params, rowMode: "array" })
				).rows;
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
					`SELECT c.relname,
					        CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view'
					             WHEN 'f' THEN 'foreign table' ELSE 'table' END,
					        CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END
					   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
					  WHERE n.nspname = COALESCE($1, current_schema()) AND c.relkind IN ('r','p','v','m','f')
					  ORDER BY 1`,
					[schema ?? null],
				);
				return { columns: ["name", "type", "rows"], rows } satisfies Table;
			},

			async describeTable(table, schema): Promise<TableSchema> {
				const cols = await catalog(
					`SELECT column_name, data_type, is_nullable = 'YES', column_default
					   FROM information_schema.columns
					  WHERE table_schema = COALESCE($1, current_schema()) AND table_name = $2
					  ORDER BY ordinal_position`,
					[schema ?? null, table],
				);
				if (cols.length === 0) {
					throw new BridgeError("QUERY_ERROR", `table "${table}" not found`);
				}
				const idx = await catalog(
					`SELECT i.relname, ix.indisunique, ix.indisprimary,
					        array_agg(a.attname::text ORDER BY k.ord)
					   FROM pg_index ix
					   JOIN pg_class t ON t.oid = ix.indrelid
					   JOIN pg_namespace n ON n.oid = t.relnamespace
					   JOIN pg_class i ON i.oid = ix.indexrelid
					   JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY k(attnum, ord) ON true
					   JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
					  WHERE n.nspname = COALESCE($1, current_schema()) AND t.relname = $2
					  GROUP BY i.relname, ix.indisunique, ix.indisprimary
					  ORDER BY i.relname`,
					[schema ?? null, table],
				);
				return {
					columns: cols.map(([name, type, nullable, def]) => ({
						name,
						type,
						nullable,
						...(def == null ? {} : { default: def }),
					})),
					primaryKey: idx.find((r) => r[2])?.[3] ?? [],
					indexes: idx.map(([name, unique, , columns]) => ({
						name,
						columns,
						unique,
					})),
				};
			},

			async query(sql, { params, limit }) {
				let client: pg.PoolClient;
				try {
					client = await getPool().connect();
				} catch (err) {
					throw mapError(err, "CONNECTION_FAILED");
				}
				let failure: unknown;
				try {
					// An explicit READ ONLY transaction cannot be switched off from inside a query.
					if (readOnly) await client.query("BEGIN READ ONLY");
					const cursor = client.query(
						new Cursor(sql, params, { rowMode: "array" }),
					);
					const { rows, columns } = await new Promise<Table>(
						(resolve, reject) =>
							cursor.read(limit + 1, (err, rows, result) =>
								err
									? reject(err)
									: resolve({
											rows,
											columns: (result?.fields ?? []).map((f) => f.name),
										}),
							),
					);
					await cursor.close();
					const truncated = rows.length > limit;
					return {
						columns,
						rows: truncated ? rows.slice(0, limit) : rows,
						truncated,
					};
				} catch (err) {
					failure = err;
					throw mapError(err, "QUERY_ERROR");
				} finally {
					if (readOnly) await client.query("ROLLBACK").catch(() => {});
					client.release(failure === undefined ? undefined : true);
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
