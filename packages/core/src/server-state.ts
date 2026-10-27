import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { defaultHome, writePrivateJson } from "./config";

const stateSchema = z.object({
	version: z.literal(1),
	/** Bearer token clients send; kept across restarts so client configs stay valid. */
	token: z.string().min(16),
	/** Last port bound; tried first on the next start so the URL stays stable. */
	port: z.number().int().optional(),
	/** Set only while the background server runs. */
	pid: z.number().int().optional(),
});

export type ServerState = z.infer<typeof stateSchema>;

/** `server.json` (file 0600): the HTTP server's token, port and pid. `server.log` sits beside it. */
export function serverStore(home = defaultHome()) {
	const file = join(home, "server.json");
	return {
		file,
		logFile: join(home, "server.log"),
		home,
		async read(): Promise<ServerState | null> {
			try {
				return stateSchema.parse(JSON.parse(await readFile(file, "utf8")));
			} catch {
				return null; // missing or unreadable: start fresh with a new token
			}
		},
		write: (state: Omit<ServerState, "version">): Promise<void> =>
			writePrivateJson(file, { version: 1, ...state }),
	};
}

export type ServerStore = ReturnType<typeof serverStore>;

export const newToken = (): string => randomBytes(24).toString("base64url");
