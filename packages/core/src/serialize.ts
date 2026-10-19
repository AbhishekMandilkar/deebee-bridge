import type { Table } from "./drivers/types.js";

/** Caps that keep tool output small enough for an agent's context window. */
export const MAX_CELL_CHARS = 2_000;
export const MAX_RESPONSE_CHARS = 64 * 1024;

export function toJsonValue(v: unknown): unknown {
	if (typeof v === "bigint") return v.toString();
	if (v instanceof Date)
		return Number.isNaN(v.getTime()) ? null : v.toISOString();
	if (Buffer.isBuffer(v))
		return `base64:${v.toString("base64")}`.slice(0, MAX_CELL_CHARS);
	if (typeof v === "string" && v.length > MAX_CELL_CHARS) {
		return `${v.slice(0, MAX_CELL_CHARS)}…(+${v.length - MAX_CELL_CHARS} chars)`;
	}
	return v;
}

/** JSON-safe cells, then as many leading rows as fit in MAX_RESPONSE_CHARS. */
export function capOutput<T extends Table>(
	table: T,
	alreadyTruncated = false,
): T & { rowCount: number; truncated: boolean } {
	const rows: unknown[][] = [];
	let truncated = alreadyTruncated;
	let size = JSON.stringify(table.columns).length;
	for (const raw of table.rows) {
		const row = raw.map(toJsonValue);
		size += JSON.stringify(row).length + 1;
		if (size > MAX_RESPONSE_CHARS && rows.length > 0) {
			truncated = true;
			break;
		}
		rows.push(row);
	}
	return { ...table, rows, rowCount: rows.length, truncated };
}
