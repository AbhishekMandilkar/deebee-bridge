import { describe, expect, it } from "vitest";
import { assertReadOnly } from "../src/index";

const dialects = ["mysql", "postgresql"] as const;

describe.each(dialects)("assertReadOnly (%s)", (d) => {
	const code = (sql: string) => {
		try {
			assertReadOnly(sql, d, "c");
		} catch (e) {
			return (e as { code: string }).code;
		}
		return "ok";
	};

	it.each([
		"select 1",
		"SELECT * FROM users WHERE name = 'a;b'",
		"select 1;",
		"  SeLeCt id from t -- trailing ; comment",
		"/* c */ select 1",
		"with x as (select 1 a) select * from x",
		"select 1 union select 2",
		"select a from t where b = 'drop table x; --'",
	])("allows %s", (sql) => expect(code(sql)).toBe("ok"));

	it.each([
		"insert into t values (1)",
		"update t set a = 1",
		"delete from t",
		"drop table t",
		"truncate t",
		"create table x (a int)",
		"set x = 1",
		"call f()",
		"select 1; drop table t",
		"select 1; select 2",
		"select 1; -- x\n delete from t",
		"select * into newt from t",
		"explain delete from t",
		"explain analyze update t set a = 1",
	])("rejects %s", (sql) =>
		expect(["QUERY_REJECTED_READONLY", "QUERY_PARSE_FAILED"]).toContain(
			code(sql),
		),
	);

	it("fails closed when the statement cannot be parsed", () => {
		expect(code("selec nonsense ((")).toBe("QUERY_PARSE_FAILED");
		expect(code("with x as (delete from t returning *) select * from x")).toBe(
			"QUERY_PARSE_FAILED",
		);
	});

	it("allows EXPLAIN of a select, including options", () => {
		expect(code("explain select 1")).toBe("ok");
		expect(code("EXPLAIN ANALYZE select * from t")).toBe("ok");
	});

	it("names the connection and allowed statements in the message", () => {
		expect(() => assertReadOnly("delete from t", d, "prod")).toThrow(
			/"prod" is read-only; only SELECT\/WITH\/SHOW\/DESCRIBE\/EXPLAIN/,
		);
	});
});

describe("assertReadOnly (hidden clauses)", () => {
	const mysql = (sql: string) => () => assertReadOnly(sql, "mysql", "c");
	it("checks every UNION branch, subquery and CTE, not just the first statement", () => {
		expect(
			mysql("select * from a union select * from b into outfile '/tmp/x'"),
		).toThrow(/SELECT INTO/);
		expect(mysql("select * from a union select * from b for update")).toThrow(
			/locking read/,
		);
		expect(mysql("select * from (select 1 for update) t")).toThrow(
			/locking read/,
		);
		expect(
			mysql("select * from t where x in (select y from z for update)"),
		).toThrow(/locking read/);
	});
	it("rejects version-conditional comments that MySQL executes", () => {
		expect(mysql("select * from t /*!50000 into outfile '/tmp/x' */")).toThrow(
			/version-conditional/,
		);
		expect(mysql("select /*+ MAX_EXECUTION_TIME(1) */ 1")).not.toThrow();
	});
});

describe("assertReadOnly (mysql only)", () => {
	const ok = (sql: string) => assertReadOnly(sql, "mysql", "c");
	it("allows SHOW and DESCRIBE", () => {
		ok("show tables");
		ok("describe users");
		ok("desc users");
	});
	it("rejects locking reads and INTO OUTFILE", () => {
		expect(() => ok("select * from t for update")).toThrow(/locking read/);
		expect(() => ok("select * from t into outfile '/tmp/x'")).toThrow();
	});
});
