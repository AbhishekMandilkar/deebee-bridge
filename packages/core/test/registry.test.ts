import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
	BridgeError,
	type ConnectionConfig,
	configStore,
	createRegistry,
	DEFAULTS,
	fileSecrets,
	memorySecrets,
	newToken,
	redact,
	serverStore,
	toBridgeError,
} from "../src/index";

const conn = (over: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
	name: "local-pg",
	type: "postgres",
	host: "localhost",
	port: 5432,
	database: "app",
	user: "ro",
	ssl: false,
	...DEFAULTS,
	createdAt: "2026-10-19T00:00:00Z",
	...over,
});

let home: string;
beforeEach(async () => {
	home = await mkdtemp(join(tmpdir(), "dbb-"));
});

describe("registry", () => {
	it("stores config without the password and the password in the secret store", async () => {
		const secrets = memorySecrets();
		const reg = createRegistry({ config: configStore(home), secrets });
		await reg.add(conn(), "hunter2");

		expect(await reg.list()).toHaveLength(1);
		expect(await secrets.get("local-pg")).toBe("hunter2");
		const raw = await readFile(join(home, "connections.json"), "utf8");
		expect(raw).not.toContain("hunter2");
		expect((await stat(join(home, "connections.json"))).mode & 0o777).toBe(
			0o600,
		);
		expect((await stat(home)).mode & 0o777).toBe(0o700);
	});

	it("rejects duplicates, bad names and unknown types", async () => {
		const reg = createRegistry({
			config: configStore(home),
			secrets: memorySecrets(),
		});
		await reg.add(conn(), "x");
		await expect(reg.add(conn(), "x")).rejects.toMatchObject({
			code: "CONNECTION_EXISTS",
		});
		await expect(reg.add(conn({ name: "Bad Name" }), "x")).rejects.toThrow();
		await expect(
			reg.add(conn({ name: "a", type: "oracle" }), "x"),
		).rejects.toThrow(/unsupported/);
	});

	it("reports an unreadable config as INVALID_CONNECTION", async () => {
		const { writeFile } = await import("node:fs/promises");
		await writeFile(join(home, "connections.json"), "{nope");
		const reg = createRegistry({
			config: configStore(home),
			secrets: memorySecrets(),
		});
		await expect(reg.list()).rejects.toMatchObject({
			code: "INVALID_CONNECTION",
		});
	});

	it("rolls back the secret when the config write fails", async () => {
		const secrets = memorySecrets();
		const config = configStore(home);
		config.write = async () => {
			throw new Error("disk full");
		};
		const reg = createRegistry({ config, secrets });
		await expect(reg.add(conn(), "x")).rejects.toThrow("disk full");
		expect(await secrets.get("local-pg")).toBeNull();
	});

	it("remove deletes config and secret", async () => {
		const secrets = memorySecrets();
		const reg = createRegistry({ config: configStore(home), secrets });
		await reg.add(conn(), "x");
		await reg.remove("local-pg");
		expect(await reg.list()).toEqual([]);
		expect(await secrets.get("local-pg")).toBeNull();
		await expect(reg.remove("local-pg")).rejects.toMatchObject({
			code: "CONNECTION_NOT_FOUND",
		});
	});

	it("open reports missing secrets and unknown names", async () => {
		const secrets = memorySecrets();
		const reg = createRegistry({ config: configStore(home), secrets });
		await expect(reg.open("nope")).rejects.toMatchObject({
			code: "CONNECTION_NOT_FOUND",
		});
		await reg.add(conn(), "x");
		await secrets.delete("local-pg");
		await expect(reg.open("local-pg")).rejects.toMatchObject({
			code: "SECRET_MISSING",
		});
	});
});

describe("redact", () => {
	it("removes secrets and URL passwords", () => {
		expect(redact("auth failed for hunter2", ["hunter2"])).toBe(
			"auth failed for ***",
		);
		expect(redact("postgres://u:hunter2@h/db failed")).toBe(
			"postgres://u:***@h/db failed",
		);
	});
	it("keeps BridgeError codes while redacting", () => {
		const e = toBridgeError(new BridgeError("AUTH_FAILED", "bad hunter2"), [
			"hunter2",
		]);
		expect(e.toString()).toBe("AUTH_FAILED: bad ***");
	});
});

describe("fileSecrets", () => {
	it("round-trips, overwrites and deletes per account", async () => {
		const secrets = fileSecrets(home);
		expect(await secrets.get("a")).toBeNull();
		await secrets.set("a", "one");
		await secrets.set("b", "two");
		await secrets.set("a", "three");
		expect(await secrets.get("a")).toBe("three");
		expect(await secrets.get("b")).toBe("two");
		await secrets.delete("a");
		expect(await secrets.get("a")).toBeNull();
		expect(await secrets.get("b")).toBe("two");
	});

	it("writes a private file, separate from connections.json", async () => {
		const reg = createRegistry({
			config: configStore(home),
			secrets: fileSecrets(home),
		});
		await reg.add(conn(), "hunter2");

		const file = join(home, "secrets.json");
		expect((await stat(file)).mode & 0o777).toBe(0o600);
		expect(await readFile(file, "utf8")).toContain("hunter2");
		expect(
			await readFile(join(home, "connections.json"), "utf8"),
		).not.toContain("hunter2");
		expect(await reg.password("local-pg")).toBe("hunter2");
		await reg.remove("local-pg");
		expect(await readFile(file, "utf8")).not.toContain("hunter2");
	});

	it("refuses a corrupt file instead of dropping the passwords in it", async () => {
		await writeFile(join(home, "secrets.json"), "not json");
		await expect(fileSecrets(home).set("a", "x")).rejects.toMatchObject({
			code: "INVALID_CONNECTION",
		});
		expect(await readFile(join(home, "secrets.json"), "utf8")).toBe("not json");
	});
});

describe("serverStore", () => {
	it("round-trips state privately and ignores a corrupt file", async () => {
		const store = serverStore(home);
		expect(await store.read()).toBeNull();
		const token = newToken();
		expect(token.length).toBeGreaterThanOrEqual(32);
		await store.write({ token, port: 43117, pid: 42 });
		expect(await store.read()).toEqual({
			version: 1,
			token,
			port: 43117,
			pid: 42,
		});
		expect((await stat(store.file)).mode & 0o777).toBe(0o600);
		await writeFile(store.file, "not json");
		expect(await store.read()).toBeNull();
	});
});
