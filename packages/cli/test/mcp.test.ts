import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	configStore,
	createBridge,
	createRegistry,
	DEFAULTS,
	memorySecrets,
} from "@deebeebridge/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/mcp/server";

let client: Client;
const bridge = (async () => {
	const registry = createRegistry({
		config: configStore(await mkdtemp(join(tmpdir(), "dbb-mcp-"))),
		secrets: memorySecrets(),
	});
	await registry.add(
		{
			name: "pg",
			type: "postgres",
			host: "127.0.0.1",
			port: 1,
			database: "app",
			user: "u",
			ssl: false,
			...DEFAULTS,
			createdAt: new Date().toISOString(),
		},
		"s3cret-pw",
	);
	return createBridge(registry);
})();

beforeAll(async () => {
	const [a, b] = InMemoryTransport.createLinkedPair();
	await createMcpServer(await bridge).connect(a);
	client = new Client({ name: "test", version: "0" });
	await client.connect(b);
});
afterAll(async () => {
	await client.close();
	await (await bridge).close();
});

const text = (r: unknown) =>
	(r as { content: { text: string }[] }).content[0]?.text ?? "";

describe("tool definitions", () => {
	it("exposes four tools", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"describe_table",
			"list_connections",
			"list_tables",
			"run_query",
		]);
	});

	it("stays small enough to be cheap in an agent's context (budget: 3000 chars of JSON)", async () => {
		const { tools } = await client.listTools();
		const size = JSON.stringify(tools).length;
		expect(size).toBeLessThan(3000);
	});

	it("accepts no credentials anywhere in the schemas", async () => {
		const { tools } = await client.listTools();
		expect(JSON.stringify(tools)).not.toMatch(/password|secret|token|dsn|url/i);
	});
});

describe("tool calls", () => {
	it("list_connections returns compact JSON without secrets", async () => {
		const r = await client.callTool({
			name: "list_connections",
			arguments: {},
		});
		expect(text(r)).toBe(
			'[{"name":"pg","type":"postgres","database":"app","mode":"read-only"}]',
		);
	});

	it("maps typed errors to isError results", async () => {
		const missing = await client.callTool({
			name: "list_tables",
			arguments: { connection: "nope" },
		});
		expect(missing.isError).toBe(true);
		expect(text(missing)).toMatch(/^CONNECTION_NOT_FOUND: /);

		const write = await client.callTool({
			name: "run_query",
			arguments: { connection: "pg", sql: "DELETE FROM users" },
		});
		expect(write.isError).toBe(true);
		expect(text(write)).toMatch(/^QUERY_REJECTED_READONLY: "pg" is read-only/);
	});

	it("never echoes the stored password in errors", async () => {
		const r = await client.callTool({
			name: "run_query",
			arguments: { connection: "pg", sql: "select 1" },
		});
		expect(r.isError).toBe(true);
		expect(text(r)).not.toContain("s3cret-pw");
	});
});
