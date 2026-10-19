import { describe, expect, it } from "vitest";
import { parseConnectionUrl } from "../src/index";

describe("parseConnectionUrl", () => {
	it("reads every field of a Postgres URL", () => {
		expect(
			parseConnectionUrl(
				"postgresql://app:s3cret@db.example.com:6432/shop?sslmode=require",
			),
		).toEqual({
			type: "postgres",
			host: "db.example.com",
			port: 6432,
			database: "shop",
			user: "app",
			password: "s3cret",
			ssl: true,
		});
	});

	it("accepts both Postgres schemes and the MySQL scheme", () => {
		expect(parseConnectionUrl("postgres://u@h/d").type).toBe("postgres");
		expect(parseConnectionUrl("mysql://u:p@h:3307/d").type).toBe("mysql");
	});

	it("leaves port, database, user and password undefined when absent, and ssl off", () => {
		expect(parseConnectionUrl("postgres://localhost")).toEqual({
			type: "postgres",
			host: "localhost",
			port: undefined,
			database: undefined,
			user: undefined,
			password: undefined,
			ssl: false,
		});
	});

	it("decodes percent-escapes in user, password and database", () => {
		const p = parseConnectionUrl("mysql://us%40r:p%40ss%2Fw%3Ard@h/my%20db");
		expect([p.user, p.password, p.database]).toEqual([
			"us@r",
			"p@ss/w:rd",
			"my db",
		]);
	});

	it.each([
		["?sslmode=require", true],
		["?sslmode=verify-full", true],
		["?ssl-mode=REQUIRED", true],
		["?ssl=true", true],
		["?sslmode=disable", false],
		["?sslmode=prefer", false],
		["", false],
	])("ssl for %s is %s", (query, ssl) => {
		expect(parseConnectionUrl(`postgres://u:p@h/d${query}`).ssl).toBe(ssl);
	});

	it("handles IPv6 hosts", () => {
		expect(parseConnectionUrl("postgres://u:p@[::1]:5432/d").host).toBe("::1");
	});

	it("rejects other schemes and garbage, without echoing the URL", () => {
		for (const bad of [
			"oracle://u:hunter2@h/d",
			"not a url hunter2",
			"postgres://u:hunter2@/d",
		]) {
			const err = (() => {
				try {
					parseConnectionUrl(bad);
				} catch (e) {
					return e as { code: string; message: string };
				}
			})();
			expect(err?.code).toBe("INVALID_CONNECTION");
			expect(err?.message).not.toContain("hunter2");
		}
	});
});
