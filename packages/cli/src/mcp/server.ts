import { type Bridge, createBridge, type Registry } from "@deebeebridge/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../../package.json";
import { registerTools } from "./tools";

export function createMcpServer(bridge: Bridge): McpServer {
	const server = new McpServer({ name: "deebeebridge", version: pkg.version });
	registerTools(server, bridge);
	return server;
}

/** Serve over stdio until the client disconnects. stdout carries MCP protocol only. */
export async function serveStdio(registry: Registry): Promise<void> {
	const bridge = createBridge(registry);
	const server = createMcpServer(bridge);
	const shutdown = async () => {
		await bridge.close();
		process.exit(0);
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
	process.stdin.once("end", shutdown);
	await server.connect(new StdioServerTransport());
}
