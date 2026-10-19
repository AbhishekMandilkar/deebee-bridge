import { type ConfigStore, configStore } from "./config.js";
import { type ConnectionConfig, connectionSchema } from "./connection.js";
import { createDriver } from "./drivers/index.js";
import type { Driver } from "./drivers/types.js";
import { BridgeError } from "./errors.js";
import { keychainSecrets, type SecretStore } from "./secrets.js";

/**
 * Connection CRUD over config (non-secret) + secrets (password). Callers never
 * handle the two halves separately, so they cannot drift apart.
 */
export function createRegistry(
	deps: { config?: ConfigStore; secrets?: SecretStore } = {},
) {
	const config = deps.config ?? configStore();
	const secrets = deps.secrets ?? keychainSecrets();

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
				`no password in the keychain for "${name}"; re-create it with \`deebeebridge edit ${name}\``,
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

		/** Save password to the keychain, then config; undo the keychain entry if config fails. */
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
