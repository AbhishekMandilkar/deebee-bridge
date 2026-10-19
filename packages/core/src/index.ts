export { type ConfigStore, configStore, defaultHome } from "./config.js";
export {
	CONNECTION_NAME_PATTERN,
	type ConnectionConfig,
	connectionSchema,
	DEFAULTS,
} from "./connection.js";
export { drivers, getDriverDefinition, probe } from "./drivers/index.js";
export type { Driver, DriverDefinition } from "./drivers/types.js";
export {
	BridgeError,
	type ErrorCode,
	redact,
	toBridgeError,
} from "./errors.js";
export { createRegistry, type Registry } from "./registry.js";
export { keychainSecrets, memorySecrets, type SecretStore } from "./secrets.js";
