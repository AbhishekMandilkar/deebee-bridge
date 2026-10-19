import { describe, expect, it } from "vitest";
import {
	capOutput,
	MAX_CELL_CHARS,
	MAX_RESPONSE_CHARS,
	toJsonValue,
} from "../src/serialize.js";

describe("toJsonValue", () => {
	it("makes bigint, Date and Buffer JSON-safe", () => {
		expect(toJsonValue(10n ** 20n)).toBe("100000000000000000000");
		expect(toJsonValue(new Date("2026-01-02T03:04:05Z"))).toBe(
			"2026-01-02T03:04:05.000Z",
		);
		expect(toJsonValue(Buffer.from("hi"))).toBe("base64:aGk=");
	});
	it("truncates very long strings", () => {
		const out = toJsonValue("x".repeat(MAX_CELL_CHARS + 5)) as string;
		expect(out.endsWith("…(+5 chars)")).toBe(true);
	});
});

describe("oversized cells", () => {
	it("clips large JSON documents and Buffers to text with a marker", () => {
		const big = { a: "z".repeat(MAX_CELL_CHARS * 2) };
		const json = toJsonValue(big) as string;
		expect(typeof json).toBe("string");
		expect(json.length).toBeLessThan(MAX_CELL_CHARS + 40);
		expect(json).toMatch(/…\(\+\d+ chars\)$/);
		expect(toJsonValue(Buffer.alloc(MAX_CELL_CHARS * 2))).toMatch(
			/^base64:.*…\(\+\d+ chars\)$/,
		);
	});
	it("keeps small JSON as structured data", () => {
		expect(toJsonValue({ a: [1, 2] })).toEqual({ a: [1, 2] });
		expect(toJsonValue(null)).toBeNull();
	});
});

describe("capOutput", () => {
	it("keeps small results whole", () => {
		const out = capOutput({ columns: ["a"], rows: [[1], [2]] });
		expect(out).toMatchObject({ rowCount: 2, truncated: false });
	});
	it("drops rows beyond the response budget and flags truncation", () => {
		const row = ["y".repeat(MAX_CELL_CHARS)];
		const rows = Array.from({ length: 100 }, () => row);
		const out = capOutput({ columns: ["a"], rows });
		expect(out.truncated).toBe(true);
		expect(out.rowCount).toBeLessThan(100);
		expect(JSON.stringify(out.rows).length).toBeLessThanOrEqual(
			MAX_RESPONSE_CHARS,
		);
	});
	it("never lets a single huge row exceed the budget", () => {
		const row = Array.from({ length: 100 }, () => "y".repeat(MAX_CELL_CHARS));
		const out = capOutput({ columns: ["a"], rows: [row] });
		expect(out).toMatchObject({ rowCount: 0, truncated: true });
	});
	it("propagates an upstream truncation flag", () => {
		expect(capOutput({ columns: [], rows: [] }, true).truncated).toBe(true);
	});
});
