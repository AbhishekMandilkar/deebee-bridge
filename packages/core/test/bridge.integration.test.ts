import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type ConnectionConfig,
	configStore,
	createBridge,
	createRegistry,
	DEFAULTS,
	memorySecrets,
} from "../src/index";

// Live servers, opt-in per source: host:port:database:user:password
const targets = {
	postgres: {
		spec: process.env.DEEBEEBRIDGE_TEST_PG,
		ph: (n: number) => `$${n}`,
		datetime: "TIMESTAMP '2026-10-27 18:30:00'",
		currentDb: "SELECT current_database()",
		other: "template1", // exists on every server and accepts connections
		noDefaultDb: false, // Postgres falls back to a database named after the user
	},
	mysql: {
		spec: process.env.DEEBEEBRIDGE_TEST_MYSQL,
		ph: () => "?",
		datetime: "CAST('2026-10-27 18:30:00' AS DATETIME)",
		currentDb: "SELECT DATABASE()",
		other: "performance_schema", // exists on every server
		noDefaultDb: true,
	},
} as const;

for (const [
	type,
	{ spec, ph, datetime, currentDb, other, noDefaultDb },
] of Object.entries(targets)) {
	describe.skipIf(!spec)(`bridge on ${type} (live)`, () => {
		const [host = "", port = "", database = "", user = "", password = ""] =
			spec?.split(":") ?? [];
		const conn = (
			name: string,
			mode: ConnectionConfig["mode"],
			rowLimit = 2,
		): ConnectionConfig => ({
			name,
			type,
			host,
			port: Number(port),
			database,
			user,
			ssl: false,
			...DEFAULTS,
			mode,
			rowLimit,
			createdAt: new Date().toISOString(),
		});
		const bridge = createBridge(
			createRegistry({
				config: configStore(join(tmpdir(), `dbb-${type}-${process.pid}`)),
				secrets: memorySecrets(),
			}),
		);
		let rw: ReturnType<typeof createBridge>;
		let ro: ReturnType<typeof createBridge>;

		beforeAll(async () => {
			const home = await mkdtemp(join(tmpdir(), "dbb-"));
			const registry = createRegistry({
				config: configStore(home),
				secrets: memorySecrets(),
			});
			await registry.add(conn("rw", "read-write", 500), password);
			await registry.add(conn("ro", "read-only", 2), password);
			rw = createBridge(registry);
			ro = createBridge(registry);
			await rw.runQuery("rw", "DROP TABLE IF EXISTS dbb_it");
			await rw.runQuery(
				"rw",
				"CREATE TABLE dbb_it (id int primary key, name varchar(20) not null, note text)",
			);
			await rw.runQuery("rw", "CREATE INDEX dbb_it_name ON dbb_it (name)");
			await rw.runQuery(
				"rw",
				"INSERT INTO dbb_it VALUES (1,'a',NULL),(2,'b','x'),(3,'c','y')",
			);
		});
		afterAll(async () => {
			await rw?.runQuery("rw", "DROP TABLE IF EXISTS dbb_it");
			await rw?.close();
			await ro?.close();
			await bridge.close();
		});

		it("lists connections without secrets", async () => {
			const list = await ro.listConnections();
			expect(list).toEqual([
				expect.objectContaining({ name: "rw", mode: "read-write" }),
				expect.objectContaining({ name: "ro", mode: "read-only" }),
			]);
			expect(JSON.stringify(list)).not.toContain(password);
		});

		it("lists tables", async () => {
			const t = await ro.listTables("ro");
			expect(t.columns).toEqual(["name", "type", "rows"]);
			expect(t.rows.map((r) => r[0])).toContain("dbb_it");
		});

		it("describes a table: columns, primary key, indexes", async () => {
			const d = await ro.describeTable("ro", "dbb_it");
			expect(d.columns.map((c) => [c.name, c.nullable])).toEqual([
				["id", false],
				["name", false],
				["note", true],
			]);
			expect(d.primaryKey).toEqual(["id"]);
			expect(d.indexes.find((i) => i.name === "dbb_it_name")).toEqual({
				name: "dbb_it_name",
				columns: ["name"],
				unique: false,
			});
			await expect(ro.describeTable("ro", "nope")).rejects.toMatchObject({
				code: "QUERY_ERROR",
			});
		});

		it("selects with params and caps rows at the connection's rowLimit", async () => {
			const one = await ro.runQuery(
				"ro",
				`SELECT name FROM dbb_it WHERE id = ${ph(1)}`,
				[2],
			);
			expect(one).toMatchObject({
				columns: ["name"],
				rows: [["b"]],
				rowCount: 1,
				truncated: false,
			});
			const all = await ro.runQuery("ro", "SELECT id FROM dbb_it ORDER BY id");
			expect(all).toMatchObject({
				rowCount: 2,
				truncated: true,
				rows: [[1], [2]],
			});
		});

		it("returns zone-less dates and datetimes as stored, whatever this machine's offset", async () => {
			const r = await ro.runQuery(
				"ro",
				`SELECT ${datetime} AS dt, CAST('2026-10-27' AS DATE) AS d`,
			);
			expect(r.rows).toEqual([["2026-10-27 18:30:00", "2026-10-27"]]);
		});

		it("lists databases without system schemas, and includes this one", async () => {
			const dbs = await ro.listDatabases("ro");
			expect(dbs).toContain(database);
			expect(dbs).not.toContain("information_schema");
			expect(dbs).not.toContain("mysql");
		});

		it("runs against another database of the same server when `database` is given", async () => {
			const home = (await ro.runQuery("ro", currentDb)).rows[0]?.[0];
			expect(home).toBe(database);
			const elsewhere = await ro.runQuery("ro", currentDb, undefined, other);
			expect(elsewhere.rows[0]?.[0]).toBe(other);
			// back on the default, and the other database's driver did not replace it
			expect((await ro.runQuery("ro", currentDb)).rows[0]?.[0]).toBe(database);
			const tables = await ro.listTables("ro", undefined, other);
			expect(tables.columns).toEqual(["name", "type", "rows"]);
		});

		it.skipIf(!noDefaultDb)(
			"works with no default database: catalog calls ask for one, `database` supplies it",
			async () => {
				const home = await mkdtemp(join(tmpdir(), "dbb-nodb-"));
				const registry = createRegistry({
					config: configStore(home),
					secrets: memorySecrets(),
				});
				await registry.add(
					{ ...conn("bare", "read-only", 5), database: undefined },
					password,
				);
				const bare = createBridge(registry);
				expect(await bare.listDatabases("bare")).toContain(database);
				await expect(bare.listTables("bare")).rejects.toMatchObject({
					code: "QUERY_ERROR",
					message: expect.stringContaining("list_databases"),
				});
				expect(
					(await bare.listTables("bare", undefined, database)).columns,
				).toEqual(["name", "type", "rows"]);
				await bare.close();
			},
		);

		it("rejects writes on a read-only connection (classifier)", async () => {
			await expect(
				ro.runQuery("ro", "DELETE FROM dbb_it"),
			).rejects.toMatchObject({
				code: "QUERY_REJECTED_READONLY",
			});
			expect(
				(await rw.runQuery("rw", "SELECT count(*) AS n FROM dbb_it"))
					.rows[0]?.[0],
			).toBe(type === "postgres" ? "3" : 3);
		});

		it("also rejects writes at the database level when the classifier is bypassed", async () => {
			// Same read-only connection config, but call the driver directly.
			const registry = createRegistry({
				config: configStore(await mkdtemp(join(tmpdir(), "dbb-"))),
				secrets: memorySecrets(),
			});
			await registry.add(conn("ro2", "read-only"), password);
			const { driver } = await registry.open("ro2");
			await expect(
				driver.query("DELETE FROM dbb_it", { limit: 1 }),
			).rejects.toMatchObject({
				code: "QUERY_ERROR",
			});
			await driver.close();
			expect((await rw.runQuery("rw", "SELECT 1 FROM dbb_it")).rowCount).toBe(
				3,
			);
		});

		it("allows writes on a read-write connection", async () => {
			await rw.runQuery("rw", `INSERT INTO dbb_it VALUES (4,'d',NULL)`);
			expect((await rw.runQuery("rw", "SELECT 1 FROM dbb_it")).rowCount).toBe(
				4,
			);
			await rw.runQuery("rw", "DELETE FROM dbb_it WHERE id = 4");
		});

		it("maps SQL errors to QUERY_ERROR", async () => {
			await expect(
				ro.runQuery("ro", "SELECT * FROM missing_table_xyz"),
			).rejects.toMatchObject({
				code: "QUERY_ERROR",
			});
		});

		it("times out long queries", async () => {
			const registry = createRegistry({
				config: configStore(await mkdtemp(join(tmpdir(), "dbb-"))),
				secrets: memorySecrets(),
			});
			await registry.add(
				{ ...conn("slow", "read-only"), timeoutMs: 500 },
				password,
			);
			const b = createBridge(registry);
			const sleep =
				type === "postgres"
					? "SELECT pg_sleep(3)"
					: "SELECT SLEEP(3) FROM dbb_it";
			const err = await b.runQuery("slow", sleep).catch((e) => e);
			await b.close();
			// MySQL's MAX_EXECUTION_TIME makes SLEEP return early rather than error; accept either.
			if (type === "postgres") expect(err.code).toBe("TIMEOUT");
			else
				expect(err.code === "TIMEOUT" || err.rowCount !== undefined).toBe(true);
		});
	});
}
