import { describe, expect, it } from "vitest";
import { redactErrors } from "../src/drivers/index";
import type { Driver } from "../src/drivers/types";
import { BridgeError } from "../src/index";

const failing = (message: string, code?: "TIMEOUT"): Driver => {
	const fail = async () => {
		throw code ? new BridgeError(code, message) : new Error(message);
	};
	return {
		ping: fail,
		listTables: fail,
		describeTable: fail,
		query: fail,
		close: async () => {},
	};
};

describe("redactErrors", () => {
	it("masks the password in plain and typed errors from every method", async () => {
		const d = redactErrors(
			failing("access denied, password hunter2 wrong"),
			"hunter2",
		);
		const t = redactErrors(
			failing("timed out for hunter2", "TIMEOUT"),
			"hunter2",
		);
		for (const call of [
			() => d.ping(),
			() => d.listTables(),
			() => d.describeTable("t"),
			() => d.query("select 1", { limit: 1 }),
			() => t.query("select 1", { limit: 1 }),
		]) {
			const err = await call().catch((e) => e);
			expect(err).toBeInstanceOf(BridgeError);
			expect(err.message).not.toContain("hunter2");
		}
	});

	it("keeps typed codes and falls back by method", async () => {
		const t = redactErrors(failing("x", "TIMEOUT"), "pw");
		expect(await t.query("select 1", { limit: 1 }).catch((e) => e.code)).toBe(
			"TIMEOUT",
		);
		const d = redactErrors(failing("boom"), "pw");
		expect(await d.ping().catch((e) => e.code)).toBe("CONNECTION_FAILED");
		expect(await d.query("select 1", { limit: 1 }).catch((e) => e.code)).toBe(
			"QUERY_ERROR",
		);
	});
});
