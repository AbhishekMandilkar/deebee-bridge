import type { Table } from "./drivers/types";

/** Caps that keep tool output small enough for an agent's context window. */
export const MAX_CELL_CHARS = 2_000;
export const MAX_RESPONSE_CHARS = 64 * 1024;

const clip = (text: string): string =>
	text.length > MAX_CELL_CHARS
		? `${text.slice(0, MAX_CELL_CHARS)}…(+${text.length - MAX_CELL_CHARS} chars)`
		: text;

/** One cell as a JSON-safe value no larger than MAX_CELL_CHARS (oversized ones become clipped text). */
export function toJsonValue(v: unknown): unknown {
	if (typeof v === "bigint") return v.toString();
	if (v instanceof Date)
		return Number.isNaN(v.getTime()) ? null : v.toISOString();
	if (Buffer.isBuffer(v)) return clip(`base64:${v.toString("base64")}`);
	if (typeof v === "string") return clip(v);
	if (typeof v === "object" && v !== null) {
		// json/jsonb columns arrive as objects or arrays of any size.
		const text = JSON.stringify(v);
		return text.length > MAX_CELL_CHARS ? clip(text) : v;
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
		if (size > MAX_RESPONSE_CHARS) {
			truncated = true;
			break;
		}
		rows.push(row);
	}
	return { ...table, rows, rowCount: rows.length, truncated };
}
