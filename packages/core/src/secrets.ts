import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultHome, writePrivateJson } from "./config";
import { BridgeError } from "./errors";

export interface SecretStore {
	get(account: string): Promise<string | null>;
	set(account: string, secret: string): Promise<void>;
	delete(account: string): Promise<void>;
}

/**
 * Passwords in `secrets.json` next to connections.json (file 0600, dir 0700), plain text:
 * access is the user's file permissions. Kept apart from connections.json so that file stays
 * safe to look at and share.
 */
export function fileSecrets(home = defaultHome()): SecretStore {
	const file = join(home, "secrets.json");

	async function read(): Promise<Record<string, string>> {
		let raw: string;
		try {
			raw = await readFile(file, "utf8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
			throw err;
		}
		try {
			const json = JSON.parse(raw) as { secrets?: Record<string, string> };
			if (json.secrets && typeof json.secrets === "object") return json.secrets;
		} catch {}
		throw new BridgeError("INVALID_CONNECTION", `${file} is not valid`);
	}

	const write = (secrets: Record<string, string>) =>
		writePrivateJson(file, { version: 1, secrets });

	return {
		async get(account) {
			return (await read())[account] ?? null;
		},
		async set(account, secret) {
			await write({ ...(await read()), [account]: secret });
		},
		async delete(account) {
			const { [account]: _gone, ...rest } = await read();
			await write(rest);
		},
	};
}

export function memorySecrets(): SecretStore {
	const map = new Map<string, string>();
	return {
		async get(account) {
			return map.get(account) ?? null;
		},
		async set(account, secret) {
			map.set(account, secret);
		},
		async delete(account) {
			map.delete(account);
		},
	};
}
