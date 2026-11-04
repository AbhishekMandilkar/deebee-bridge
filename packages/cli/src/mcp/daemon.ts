import { spawn } from "node:child_process";
import {
	mkdirSync,
	openSync,
	readFileSync,
	statSync,
	truncateSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import {
	createBridge,
	newToken,
	type Registry,
	type ServerState,
	type ServerStore,
} from "@deebeebridge/core";
import { skillTip } from "../skill-tip";
import {
	createHttpServer,
	DEFAULT_PORTS,
	HOST,
	listenOnFirstFree,
} from "./http";

const MAX_LOG_BYTES = 1_000_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const urlFor = (port: number) => `http://${HOST}:${port}/mcp`;

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "EPERM";
	}
}

async function healthy(port: number): Promise<boolean> {
	try {
		const res = await fetch(`http://${HOST}:${port}/health`, {
			signal: AbortSignal.timeout(1000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

/** The running background server's state, or null if none is alive and answering. */
async function running(
	store: ServerStore,
): Promise<(ServerState & { pid: number; port: number }) | null> {
	const state = await store.read();
	if (!state?.pid || !state.port) return null;
	if (!isAlive(state.pid) || !(await healthy(state.port))) return null;
	return state as ServerState & { pid: number; port: number };
}

/** Copy-paste lines for the clients; the token is the only thing that unlocks the server. */
function connectHelp(port: number, token: string): string {
	const url = urlFor(port);
	const cursor = JSON.stringify({
		mcpServers: {
			deebeebridge: { url, headers: { Authorization: `Bearer ${token}` } },
		},
	});
	return [
		"",
		"Claude Code:",
		`  claude mcp add --transport http deebeebridge ${url} --header "Authorization: Bearer ${token}"`,
		"Cursor (~/.cursor/mcp.json):",
		`  ${cursor}`,
	].join("\n");
}

/** Foreground HTTP server (what `mcp start` runs in the background). Runs until signalled. */
export async function serve(
	registry: Registry,
	store: ServerStore,
	opts: { port?: number } = {},
): Promise<void> {
	const prior = await store.read();
	const token = prior?.token ?? newToken();
	const bridge = createBridge(registry);
	const server = createHttpServer(bridge, token);
	const ports = opts.port
		? [opts.port]
		: [...new Set([...(prior?.port ? [prior.port] : []), ...DEFAULT_PORTS])];
	const port = await listenOnFirstFree(server, ports);
	await store.write({ token, port, pid: process.pid });
	console.error(
		`${new Date().toISOString()} listening on ${urlFor(port)} (pid ${process.pid})`,
	);

	const shutdown = async () => {
		server.close();
		await bridge.close();
		await store.write({ token, port });
		console.error(`${new Date().toISOString()} stopped`);
		process.exit(0);
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
}

export async function start(
	store: ServerStore,
	opts: { port?: number } = {},
): Promise<void> {
	const live = await running(store);
	if (live) {
		console.log(
			`MCP server already running at ${urlFor(live.port)} (pid ${live.pid})`,
		);
		console.log(connectHelp(live.port, live.token));
		return;
	}

	// Clear a stale pid so the poll below only accepts the child we are about to spawn.
	const prior = await store.read();
	if (prior) await store.write({ token: prior.token, port: prior.port });
	mkdirSync(store.home, { recursive: true, mode: 0o700 });
	try {
		if (statSync(store.logFile).size > MAX_LOG_BYTES)
			truncateSync(store.logFile);
	} catch {}
	const log = openSync(store.logFile, "a", 0o600);

	const args = [fileURLToPath(import.meta.url), "mcp", "serve"];
	if (opts.port) args.push("--port", String(opts.port));
	const child = spawn(process.execPath, args, {
		detached: true,
		stdio: ["ignore", log, log],
		windowsHide: true,
	});
	let exited = false;
	child.once("exit", () => {
		exited = true;
	});
	child.unref();

	for (let i = 0; i < 80 && !exited; i++) {
		await sleep(100);
		const state = await store.read();
		if (
			state?.pid &&
			state.pid === child.pid &&
			state.port &&
			(await healthy(state.port))
		) {
			console.log(
				`MCP server running at ${urlFor(state.port)} (pid ${state.pid})`,
			);
			console.log(connectHelp(state.port, state.token));
			console.log(
				"\nStop it with `deebeebridge mcp stop`; logs: `deebeebridge mcp logs`.",
			);
			skillTip();
			return;
		}
	}
	console.error(
		`The MCP server did not start. Last log lines:\n${tail(store, 10)}`,
	);
	process.exitCode = 1;
}

export async function stop(store: ServerStore): Promise<void> {
	// Require a live health answer too: after a reboot a stale pid may belong to another program.
	const live = await running(store);
	if (!live) {
		const stale = await store.read();
		if (stale?.pid) await store.write({ token: stale.token, port: stale.port });
		console.log("MCP server is not running.");
		return;
	}
	process.kill(live.pid, "SIGTERM");
	for (let i = 0; i < 50 && isAlive(live.pid); i++) await sleep(100);
	if (isAlive(live.pid)) {
		console.error(`pid ${live.pid} did not exit; stop it manually.`);
		process.exitCode = 1;
		return;
	}
	await store.write({ token: live.token, port: live.port });
	console.log("MCP server stopped.");
}

export async function status(store: ServerStore): Promise<void> {
	const live = await running(store);
	if (!live) {
		console.log(
			"MCP server is not running. Start it with `deebeebridge mcp start`.",
		);
		return;
	}
	console.log(`MCP server running at ${urlFor(live.port)} (pid ${live.pid})`);
	console.log(connectHelp(live.port, live.token));
}

function tail(store: ServerStore, lines: number): string {
	try {
		return readFileSync(store.logFile, "utf8")
			.trimEnd()
			.split("\n")
			.slice(-lines)
			.join("\n");
	} catch {
		return "(no log yet)";
	}
}

export function logs(store: ServerStore, lines: number): void {
	console.log(tail(store, lines));
}
