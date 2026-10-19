import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type ConnectionConfig, configFileSchema } from "./connection";
import { BridgeError } from "./errors";

export function defaultHome(): string {
	return process.env.DEEBEEBRIDGE_HOME ?? join(homedir(), ".deebeebridge");
}

/** Reads and atomically writes connections.json (file 0600, dir 0700). Holds no secrets. */
export function configStore(home = defaultHome()) {
	const file = join(home, "connections.json");
	return {
		file,
		async read(): Promise<ConnectionConfig[]> {
			let raw: string;
			try {
				raw = await readFile(file, "utf8");
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
				throw err;
			}
			let json: unknown;
			try {
				json = JSON.parse(raw);
			} catch {
				throw new BridgeError(
					"INVALID_CONNECTION",
					`${file} is not valid JSON`,
				);
			}
			const parsed = configFileSchema.safeParse(json);
			if (!parsed.success) {
				throw new BridgeError(
					"INVALID_CONNECTION",
					`${file} is invalid: ${parsed.error.message}`,
				);
			}
			return parsed.data.connections;
		},
		async write(connections: ConnectionConfig[]): Promise<void> {
			await mkdir(dirname(file), { recursive: true, mode: 0o700 });
			await chmod(dirname(file), 0o700);
			const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
			await writeFile(
				tmp,
				`${JSON.stringify({ version: 1, connections }, null, 2)}\n`,
				{
					mode: 0o600,
				},
			);
			await rename(tmp, file);
		},
	};
}

export type ConfigStore = ReturnType<typeof configStore>;
