import type { Registry, ServerStore } from "@deebeebridge/core";
import * as daemon from "../mcp/daemon";
import { serveStdio } from "../mcp/server";

export const mcpCommand = (registry: Registry) => serveStdio(registry);

export const mcpServeCommand = (
	registry: Registry,
	store: ServerStore,
	flags: { port?: string },
) => daemon.serve(registry, store, { port: portFlag(flags.port) });

export const mcpStartCommand = (store: ServerStore, flags: { port?: string }) =>
	daemon.start(store, { port: portFlag(flags.port) });

export const mcpStopCommand = (store: ServerStore) => daemon.stop(store);
export const mcpStatusCommand = (store: ServerStore) => daemon.status(store);
export const mcpLogsCommand = (store: ServerStore, flags: { lines?: string }) =>
	daemon.logs(store, Number(flags.lines ?? 50));

function portFlag(raw: string | undefined): number | undefined {
	if (raw === undefined) return undefined;
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`invalid port "${raw}"`);
	}
	return port;
}
