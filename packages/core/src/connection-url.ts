import { drivers } from "./drivers/index";
import { BridgeError } from "./errors";

/** The connection fields a URL can carry. Name, mode and limits are not part of a URL. */
export interface ParsedConnectionUrl {
	type: string;
	host: string;
	port?: number;
	database?: string;
	user?: string;
	password?: string;
	ssl: boolean;
}

// libpq `sslmode`, MySQL `ssl-mode` and the plain `ssl=true` spelling. Only values that
// demand TLS turn it on; the drivers cannot fall back to plaintext mid-handshake.
const SSL_ON = new Set([
	"require",
	"required",
	"verify-ca",
	"verify_ca",
	"verify-full",
	"verify_identity",
	"true",
	"1",
]);

const invalid = (why: string) =>
	new BridgeError("INVALID_CONNECTION", `invalid connection URL: ${why}`);

/**
 * postgres://user:pass@host:5432/db?sslmode=require → connection fields.
 * Error messages never repeat any part of the URL, since it carries the password.
 */
export function parseConnectionUrl(input: string): ParsedConnectionUrl {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		throw invalid(
			"expected scheme://user:password@host:port/database (percent-encode special characters in the password)",
		);
	}
	const scheme = url.protocol.replace(/:$/, "");
	const type = Object.entries(drivers).find(([, d]) =>
		d.urlSchemes.includes(scheme),
	)?.[0];
	if (!type) {
		const known = Object.values(drivers).flatMap((d) => d.urlSchemes);
		throw invalid(`unsupported scheme "${scheme}"; use ${known.join(", ")}`);
	}
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (!host) throw invalid("missing host");

	const decode = (s: string) => (s ? decodeURIComponent(s) : undefined);
	const param = (...keys: string[]) =>
		keys.map((k) => url.searchParams.get(k)).find((v) => v !== null);
	try {
		return {
			type,
			host,
			port: url.port ? Number(url.port) : undefined,
			database: decode(url.pathname.replace(/^\//, "")),
			user: decode(url.username),
			password: decode(url.password),
			ssl: SSL_ON.has(
				(param("sslmode", "ssl-mode", "sslMode", "ssl") ?? "").toLowerCase(),
			),
		};
	} catch {
		throw invalid("user, password or database has an invalid % escape");
	}
}
