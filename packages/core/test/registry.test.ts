import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
	BridgeError,
	type ConnectionConfig,
	configStore,
	createRegistry,
	DEFAULTS,
	memorySecrets,
	redact,
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
