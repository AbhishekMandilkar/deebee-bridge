import { z } from "zod";
import { drivers } from "./drivers/index";

export const CONNECTION_NAME_PATTERN = /^[a-z0-9][a-z0-9-_]{0,62}$/;

export const connectionSchema = z.object({
	name: z
		.string()
		.regex(
			CONNECTION_NAME_PATTERN,
			"use lowercase letters, digits, '-' or '_' (max 63 chars)",
		),
	type: z.string().refine((t) => t in drivers, {
		message: `unsupported type; supported: ${Object.keys(drivers).join(", ")}`,
	}),
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	/** Default database; optional because tools can pick one per call (see `list_databases`). */
	database: z.string().min(1).optional(),
	user: z.string().min(1),
	ssl: z.boolean(),
	mode: z.enum(["read-only", "read-write"]),
	rowLimit: z.number().int().min(1),
	timeoutMs: z.number().int().min(1),
	createdAt: z.string(),
});

export type ConnectionConfig = z.infer<typeof connectionSchema>;
export type ConnectionMode = ConnectionConfig["mode"];

export const configFileSchema = z.object({
	version: z.literal(1),
	connections: z.array(connectionSchema),
});

export const DEFAULTS = {
	mode: "read-only",
	rowLimit: 500,
	timeoutMs: 15000,
} as const;
