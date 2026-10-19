import sqlParser from "node-sql-parser";
import type { SqlDialect } from "./drivers/types";
import { BridgeError } from "./errors";

const parser = new sqlParser.Parser();

const ALLOWED = "SELECT/WITH/SHOW/DESCRIBE/EXPLAIN";
// `EXPLAIN [ANALYZE|VERBOSE|(options)|FORMAT=x] <stmt>`: the parser can't read this on every
// dialect, so strip the prefix and classify the statement being explained instead.
const EXPLAIN_PREFIX =
	/^\s*explain\s+(?:\([^)]*\)\s*|(?:analy[sz]e|verbose|extended|format\s*=\s*\w+)\s+)*/i;

interface Ast {
	type?: string;
}

function reject(name: string, why: string): never {
	throw new BridgeError(
		"QUERY_REJECTED_READONLY",
		`"${name}" is read-only; only ${ALLOWED} are allowed (${why}).`,
	);
}

/**
 * Throws unless `sql` is exactly one read-only statement. Fails closed: anything the
 * parser cannot read is rejected. The database's own read-only settings are the backstop.
 */
export function assertReadOnly(
	sql: string,
	dialect: SqlDialect,
	name: string,
): void {
	let explained = false;
	let body = sql;
	if (EXPLAIN_PREFIX.test(sql)) {
		explained = true;
		body = sql.replace(EXPLAIN_PREFIX, "");
	}

	// MySQL runs `/*!50000 ... */` as code, but the parser reads it as a comment.
	if (dialect === "mysql" && /\/\*!|\/\*M!/.test(sql)) {
		reject(name, "version-conditional comment");
	}

	let ast: Ast | Ast[];
	try {
		ast = parser.astify(body, { database: dialect }) as Ast | Ast[];
	} catch {
		throw new BridgeError(
			"QUERY_PARSE_FAILED",
			`could not parse the statement; rewrite it as a single plain ${ALLOWED} statement.`,
		);
	}

	const statements = Array.isArray(ast) ? ast : [ast];
	if (statements.length !== 1) reject(name, "multiple statements");
	const stmt = statements[0] as Ast;

	if (explained) {
		if (stmt.type !== "select") reject(name, "EXPLAIN of a non-SELECT");
	} else if (!["select", "show", "desc"].includes(stmt.type ?? "")) {
		reject(name, `${stmt.type ?? "unknown"} statement`);
	}
	const found = findForbidden(stmt);
	if (found) reject(name, found);
}

/**
 * Locking reads and SELECT INTO can sit on any node: the right side of a UNION
 * (`_next`), a subquery, a CTE. Walk the whole tree rather than just the top statement.
 */
function findForbidden(node: unknown): string | undefined {
	if (!node || typeof node !== "object") return undefined;
	const n = node as Record<string, unknown>;
	if (n.locking_read) return "locking read";
	const into = n.into as { position?: unknown; expr?: unknown } | undefined;
	if (into?.position || into?.expr) return "SELECT INTO";
	for (const child of Object.values(n)) {
		const hit = findForbidden(child);
		if (hit) return hit;
	}
	return undefined;
}
