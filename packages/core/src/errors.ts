export const ERROR_CODES = [
	"CONNECTION_NOT_FOUND",
	"CONNECTION_EXISTS",
	"INVALID_CONNECTION",
	"SECRET_MISSING",
	"AUTH_FAILED",
	"CONNECTION_FAILED",
	"QUERY_REJECTED_READONLY",
	"QUERY_PARSE_FAILED",
	"TIMEOUT",
	"QUERY_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class BridgeError extends Error {
	constructor(
		readonly code: ErrorCode,
		message: string,
	) {
		super(message);
		this.name = "BridgeError";
	}

	override toString() {
		return `${this.code}: ${this.message}`;
	}
}

/** Strip secrets and credentialed URLs from text that may reach a user, log or MCP client. */
export function redact(text: string, secrets: readonly string[] = []): string {
	let out = text.replace(
		/\b([a-z][a-z0-9+.-]*:\/\/[^:/\s@]*):[^@\s]*@/gi,
		"$1:***@",
	);
	for (const secret of secrets) {
		if (secret) out = out.split(secret).join("***");
	}
	return out;
}

/** Turn anything thrown into a BridgeError whose message is safe to display. */
export function toBridgeError(
	err: unknown,
	secrets: readonly string[] = [],
	fallback: ErrorCode = "CONNECTION_FAILED",
): BridgeError {
	if (err instanceof BridgeError) {
		return new BridgeError(err.code, redact(err.message, secrets));
	}
	const message = err instanceof Error ? err.message : String(err);
	return new BridgeError(fallback, redact(message || "unknown error", secrets));
}
