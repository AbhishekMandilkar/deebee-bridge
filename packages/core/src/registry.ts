import { type ConfigStore, configStore, defaultHome } from "./config";
import { type ConnectionConfig, connectionSchema } from "./connection";
import { createDriver } from "./drivers/index";
import type { Driver } from "./drivers/types";
import { BridgeError } from "./errors";
import { fileSecrets, type SecretStore } from "./secrets";

/**
 * Connection CRUD over config (non-secret) + secrets (password). Callers never
 * handle the two halves separately, so they cannot drift apart.
 */
export function createRegistry(
	deps: { config?: ConfigStore; secrets?: SecretStore } = {},
) {
	const home = defaultHome();
	const config = deps.config ?? configStore(home);
	const secrets = deps.secrets ?? fileSecrets(home);

	async function get(name: string): Promise<ConnectionConfig> {
		const found = (await config.read()).find((c) => c.name === name);
		if (!found)
			throw new BridgeError(
				"CONNECTION_NOT_FOUND",
				`no connection named "${name}"`,
			);
		return found;
	}

	async function password(name: string): Promise<string> {
		const secret = await secrets.get(name);
		if (secret === null) {
			throw new BridgeError(
				"SECRET_MISSING",
				`no stored password for "${name}"; add the connection again`,
			);
		}
		return secret;
	}

	/** Throws CONNECTION_EXISTS if taken; returns the current connections. */
	async function ensureNameFree(name: string): Promise<ConnectionConfig[]> {
		const existing = await config.read();
		if (existing.some((c) => c.name === name)) {
			throw new BridgeError(
				"CONNECTION_EXISTS",
				`a connection named "${name}" already exists`,
			);
		}
		return existing;
	}

	return {
		list: () => config.read(),
		ensureNameFree: async (name: string): Promise<void> => {
			await ensureNameFree(name);
		},
		get,
		password,

		/** Save the password, then config; undo the password if config fails. */
		async add(input: ConnectionConfig, secret: string): Promise<void> {
			const conn = connectionSchema.parse(input);
			const existing = await ensureNameFree(conn.name);
			await secrets.set(conn.name, secret);
			try {
				await config.write([...existing, conn]);
			} catch (err) {
				await secrets.delete(conn.name).catch(() => {});
				throw err;
			}
		},

		async remove(name: string): Promise<void> {
			const all = await config.read();
			if (!all.some((c) => c.name === name)) {
				throw new BridgeError(
					"CONNECTION_NOT_FOUND",
					`no connection named "${name}"`,
				);
			}
			await config.write(all.filter((c) => c.name !== name));
			await secrets.delete(name).catch(() => {});
		},

		/** A ready-to-use driver for a stored connection. Caller closes it. */
		async open(
			name: string,
		): Promise<{ config: ConnectionConfig; driver: Driver }> {
			const conn = await get(name);
			return { config: conn, driver: createDriver(conn, await password(name)) };
		},
	};
}

export type Registry = ReturnType<typeof createRegistry>;
