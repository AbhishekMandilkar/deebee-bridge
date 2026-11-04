import { createHash, timingSafeEqual } from "node:crypto";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import type { Bridge } from "@deebeebridge/core";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";

export const HOST = "127.0.0.1";
/** Uncommon dev ports, tried in order (the last-used port goes first). */
export const DEFAULT_PORTS = [43117, 38207, 29417];
const MAX_BODY_BYTES = 1_000_000;

const digest = (s: string) => createHash("sha256").update(s).digest();

function send(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		size += (chunk as Buffer).length;
		if (size > MAX_BODY_BYTES) throw new Error("request body too large");
		chunks.push(chunk as Buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * Stateless streamable-HTTP MCP endpoint at /mcp, plus an unauthenticated /health.
 * Guards, because any local process or web page can reach a localhost port: Host must be
 * loopback on our port (DNS rebinding), any Origin header is refused (browsers always send
 * one; MCP clients do not), and every /mcp call needs the bearer token.
 */
export function createHttpServer(bridge: Bridge, token: string): Server {
	const expected = digest(token);
	const handle = async (req: IncomingMessage, res: ServerResponse) => {
		const port = (req.socket.address() as { port: number } | null)?.port;
		const host = req.headers.host;
		if (host !== `${HOST}:${port}` && host !== `localhost:${port}`) {
			return send(res, 403, { error: "forbidden host" });
		}
		if (req.headers.origin !== undefined) {
			return send(res, 403, { error: "browser origins are not allowed" });
		}
		const path = new URL(req.url ?? "/", "http://x").pathname;
		if (path === "/health" && req.method === "GET") {
			return send(res, 200, { name: "deebeebridge", ok: true });
		}
		if (path !== "/mcp") return send(res, 404, { error: "not found" });

		const auth = req.headers.authorization ?? "";
		const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
		if (!timingSafeEqual(digest(given), expected)) {
			res.setHeader("www-authenticate", "Bearer");
			return send(res, 401, { error: "missing or invalid token" });
		}
		if (req.method !== "POST") {
			res.setHeader("allow", "POST");
			return send(res, 405, { error: "use POST" });
		}

		let body: unknown;
		try {
			body = await readJson(req);
		} catch (err) {
			return send(res, 400, { error: (err as Error).message });
		}
		// Stateless: a fresh MCP server per request; the bridge (and its drivers) is shared.
		const server = createMcpServer(bridge);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		res.on("close", () => {
			void transport.close();
			void server.close();
		});
		await server.connect(transport);
		await transport.handleRequest(req, res, body);
	};
	return createServer((req, res) => {
		handle(req, res).catch(() => {
			if (!res.headersSent) send(res, 500, { error: "internal error" });
			else res.end();
		});
	});
}

/** Listen on the first free port of `ports`; returns the port actually bound. */
export async function listenOnFirstFree(
	server: Server,
	ports: readonly number[],
): Promise<number> {
	for (const port of ports) {
		const bound = await new Promise<number | null>((resolve, reject) => {
			const onError = (err: NodeJS.ErrnoException) =>
				err.code === "EADDRINUSE" ? resolve(null) : reject(err);
			server.once("error", onError);
			server.listen(port, HOST, () => {
				server.off("error", onError);
				resolve((server.address() as { port: number }).port);
			});
		});
		if (bound !== null) return bound;
	}
	throw new Error(`no free port among ${ports.join(", ")}; pass --port <n>`);
}
