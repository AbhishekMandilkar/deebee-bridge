import {
	CONNECTION_NAME_PATTERN,
	type ConnectionConfig,
	DEFAULTS,
	drivers,
	getDriverDefinition,
	probe,
	type Registry,
	toBridgeError,
} from "@deebeebridge/core";
import {
	password as askPassword,
	confirm,
	input,
	select,
} from "@inquirer/prompts";
import { readStdin } from "../io";

export interface AddFlags {
	type?: string;
	name?: string;
	host?: string;
	port?: string;
	database?: string;
	user?: string;
	ssl?: boolean;
	mode?: string;
	rowLimit?: string;
	passwordStdin?: boolean;
}

type Answers = Omit<ConnectionConfig, "createdAt" | "timeoutMs"> & {
	password: string;
};

/** Each field: use the flag if given, otherwise prompt (defaulting to the previous answer). */
async function collect(
	flags: AddFlags,
	prev?: Answers,
	envPassword?: string,
): Promise<Answers> {
	const type =
		flags.type ??
		(await select({
			message: "Database type",
			default: prev?.type,
			choices: Object.entries(drivers).map(([value, d]) => ({
				value,
				name: d.label,
			})),
		}));
	const def = getDriverDefinition(type);
	const name =
		flags.name ??
		(await input({
			message: "Connection name",
			default: prev?.name,
			validate: (v) =>
				CONNECTION_NAME_PATTERN.test(v) || "lowercase letters, digits, - or _",
		}));
	const host =
		flags.host ??
		(await input({ message: "Host", default: prev?.host ?? "localhost" }));
	const port = flags.port
		? Number(flags.port)
		: Number(
				await input({
					message: "Port",
					default: String(prev?.port ?? def.defaultPort),
					validate: (v) => Number.isInteger(Number(v)) || "must be a number",
				}),
			);
	const database =
		flags.database ??
		(await input({ message: "Database", default: prev?.database }));
	const user =
		flags.user ?? (await input({ message: "User", default: prev?.user }));
	const secret =
		envPassword ?? (await askPassword({ message: "Password", mask: "*" }));
	const ssl =
		flags.ssl ??
		(await confirm({ message: "Use SSL?", default: prev?.ssl ?? false }));
	const mode = (flags.mode ??
		(await select({
			message: "Mode (use a database user with read-only grants either way)",
			default: prev?.mode ?? DEFAULTS.mode,
			choices: [
				{ value: "read-only", name: "read-only (recommended)" },
				{ value: "read-write", name: "read-write" },
			],
		}))) as Answers["mode"];
	const rowLimit = flags.rowLimit
		? Number(flags.rowLimit)
		: Number(
				await input({
					message: "Row limit",
					default: String(prev?.rowLimit ?? DEFAULTS.rowLimit),
				}),
			);
	return {
		type,
		name,
		host,
		port,
		database,
		user,
		password: secret,
		ssl,
		mode,
		rowLimit,
	};
}

export async function addCommand(
	registry: Registry,
	flags: AddFlags,
): Promise<void> {
	// Non-interactive password sources, in order: --password-stdin, env.
	let envPassword: string | undefined;
	if (flags.passwordStdin)
		envPassword = (await readStdin()).replace(/\r?\n$/, "");
	else if (process.env.DEEBEEBRIDGE_PASSWORD)
		envPassword = process.env.DEEBEEBRIDGE_PASSWORD;
	const interactive = process.stdin.isTTY && !flags.passwordStdin;

	let answers = await collect(flags, undefined, envPassword);
	for (;;) {
		const { password, ...rest } = answers;
		const conn: ConnectionConfig = {
			...rest,
			timeoutMs: DEFAULTS.timeoutMs,
			createdAt: new Date().toISOString(),
		};
		try {
			// Fail on a taken name before spending a network round trip.
			await registry.ensureNameFree(conn.name);
			const ms = await probe(conn, password);
			await registry.add(conn, password);
			console.log(
				`Connected in ${ms}ms. Saved "${conn.name}" (password stored in the OS keychain).`,
			);
			return;
		} catch (err) {
			const e = toBridgeError(err, [password]);
			if (!interactive) throw e;
			console.error(String(e));
			const action = await select({
				message: "What now?",
				choices: [
					{ value: "retry", name: "Retry" },
					{ value: "edit", name: "Edit fields" },
					{ value: "cancel", name: "Cancel" },
				],
			});
			if (action === "cancel") return;
			if (action === "edit") answers = await collect({}, answers);
		}
	}
}
