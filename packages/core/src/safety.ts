import sqlParser from "node-sql-parser";
import { BridgeError } from "./errors.js";

const parser = new sqlParser.Parser();

const ALLOWED = "SELECT/WITH/SHOW/DESCRIBE/EXPLAIN";
// `EXPLAIN [ANALYZE|VERBOSE|(options)|FORMAT=x] <stmt>`: the parser can't read this on every
// dialect, so strip the prefix and classify the statement being explained instead.
const EXPLAIN_PREFIX =
	/^\s*explain\s+(?:\([^)]*\)\s*|(?:analy[sz]e|verbose|extended|format\s*=\s*\w+)\s+)*/i;

interface Ast {
	type?: string;
	locking_read?: unknown;
	into?: { position?: unknown; expr?: unknown };
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
	dialect: "mysql" | "postgresql",
	name: string,
): void {
	let explained = false;
	let body = sql;
	if (EXPLAIN_PREFIX.test(sql)) {
		explained = true;
		body = sql.replace(EXPLAIN_PREFIX, "");
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
	if (stmt.locking_read) reject(name, "locking read");
	if (stmt.into?.position || stmt.into?.expr) reject(name, "SELECT INTO");
}
