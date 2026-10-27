import { mkdtemp } from "node:fs/promises";
import { createServer, request, type Server } from "node:http";
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
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpServer, listenOnFirstFree } from "../src/mcp/http";

const TOKEN = "test-token-0123456789abcdef";
let server: Server;
let port: number;

beforeAll(async () => {
	const registry = createRegistry({
		config: configStore(await mkdtemp(join(tmpdir(), "dbb-http-"))),
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
	server = createHttpServer(createBridge(registry), TOKEN);
	port = await listenOnFirstFree(server, [0]);
});
afterAll(() => new Promise((r) => server.close(() => r(undefined))));

/** Raw request, so tests can send headers fetch() forbids (Host) or would add (Origin). */
function raw(opts: {
	path?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}): Promise<{ status: number; text: string }> {
	return new Promise((resolve, reject) => {
		const req = request(
			{
				host: "127.0.0.1",
				port,
				path: opts.path ?? "/mcp",
				method: opts.method ?? "POST",
				headers: {
					host: `127.0.0.1:${port}`,
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					...opts.headers,
				},
			},
			(res) => {
				let text = "";
				res.on("data", (c) => {
					text += c;
				});
				res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
			},
		);
		req.on("error", reject);
		req.end(opts.body);
	});
}

const auth = { authorization: `Bearer ${TOKEN}` };
const ping = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });

describe("http guards", () => {
	it("serves /health without a token", async () => {
		const res = await raw({ path: "/health", method: "GET" });
		expect(res.status).toBe(200);
		expect(JSON.parse(res.text)).toEqual({ name: "deebeebridge", ok: true });
	});

	it("rejects a missing or wrong token", async () => {
		expect((await raw({ body: ping })).status).toBe(401);
		const bad = { authorization: "Bearer nope" };
		expect((await raw({ headers: bad, body: ping })).status).toBe(401);
	});

	it("rejects browser origins and foreign Host headers, even with the token", async () => {
		const origin = { ...auth, origin: "https://evil.example" };
		expect((await raw({ headers: origin, body: ping })).status).toBe(403);
		const host = { ...auth, host: "evil.example" };
		expect((await raw({ headers: host, body: ping })).status).toBe(403);
	});

	it("only answers POST /mcp and /health", async () => {
		expect((await raw({ headers: auth, method: "GET" })).status).toBe(405);
		expect((await raw({ path: "/other", headers: auth })).status).toBe(404);
	});

	it("rejects an oversized body", async () => {
		const big = JSON.stringify({ pad: "x".repeat(1_100_000) });
		expect((await raw({ headers: auth, body: big })).status).toBe(400);
	});
});

describe("http MCP", () => {
	const connect = async () => {
		const client = new Client({ name: "t", version: "1" });
		await client.connect(
			new StreamableHTTPClientTransport(
				new URL(`http://127.0.0.1:${port}/mcp`),
				{
					requestInit: { headers: auth },
				},
			),
		);
		return client;
	};

	it("lists the four tools and runs them like stdio does", async () => {
		const client = await connect();
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"describe_table",
			"list_connections",
			"list_tables",
			"run_query",
		]);
		const list = await client.callTool({
			name: "list_connections",
			arguments: {},
		});
		const text = (list.content as { text: string }[])[0]?.text ?? "";
		expect(JSON.parse(text)).toEqual([
			{ name: "pg", type: "postgres", database: "app", mode: "read-only" },
		]);
		expect(text).not.toContain("s3cret-pw");

		const write = await client.callTool({
			name: "run_query",
			arguments: { connection: "pg", sql: "delete from t" },
		});
		expect(write.isError).toBe(true);
		expect((write.content as { text: string }[])[0]?.text).toMatch(
			/^QUERY_REJECTED_READONLY/,
		);
		await client.close();
	});
});

describe("listenOnFirstFree", () => {
	it("falls through to the next port when one is taken", async () => {
		const blocker = createServer();
		const taken = await listenOnFirstFree(blocker, [0]);
		const other = createServer();
		const free = await listenOnFirstFree(other, [taken, 0]);
		expect(free).not.toBe(taken);
		blocker.close();
		other.close();
	});

	it("errors when every port is taken", async () => {
		const blocker = createServer();
		const taken = await listenOnFirstFree(blocker, [0]);
		await expect(listenOnFirstFree(createServer(), [taken])).rejects.toThrow(
			/no free port/,
		);
		blocker.close();
	});
});
