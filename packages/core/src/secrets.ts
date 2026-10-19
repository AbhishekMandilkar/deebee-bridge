import { Entry } from "@napi-rs/keyring";

export interface SecretStore {
	get(account: string): Promise<string | null>;
	set(account: string, secret: string): Promise<void>;
	delete(account: string): Promise<void>;
}

export const KEYCHAIN_SERVICE = "deebeebridge";

export function keychainSecrets(service = KEYCHAIN_SERVICE): SecretStore {
	const entry = (account: string) => new Entry(service, account);
	return {
		async get(account) {
			return entry(account).getPassword();
		},
		async set(account, secret) {
			entry(account).setPassword(secret);
		},
		async delete(account) {
			entry(account).deletePassword();
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
