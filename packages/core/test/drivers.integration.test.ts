import { describe, expect, it } from "vitest";
import { type ConnectionConfig, DEFAULTS, probe } from "../src/index.js";

// Live servers, opt-in per source: host:port:database:user:password
const targets = {
	postgres: process.env.DEEBEEBRIDGE_TEST_PG,
	mysql: process.env.DEEBEEBRIDGE_TEST_MYSQL,
} as const;

for (const [type, spec] of Object.entries(targets)) {
	describe.skipIf(!spec)(`${type} driver (live)`, () => {
		const [host = "", port = "", database = "", user = "", password = ""] =
			spec?.split(":") ?? [];
		const base: ConnectionConfig = {
			name: "it",
			type,
			host,
			port: Number(port),
			database,
			user,
			ssl: false,
			...DEFAULTS,
			createdAt: new Date().toISOString(),
		};

		it("pings with valid credentials", async () => {
			expect(await probe(base, password)).toBeGreaterThanOrEqual(0);
		});

		it("maps a wrong password to AUTH_FAILED without leaking it", async () => {
			const err = await probe(base, "wrong-password-xyz").catch((e) => e);
			expect(err.code).toBe("AUTH_FAILED");
			expect(err.message).not.toContain("wrong-password-xyz");
		});

		it("maps an unreachable host to CONNECTION_FAILED", async () => {
			const err = await probe(
				{ ...base, port: 1, timeoutMs: 2000 },
				password,
			).catch((e) => e);
			expect(err.code).toBe("CONNECTION_FAILED");
		});
	});
}
