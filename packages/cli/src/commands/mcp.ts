import type { Registry } from "@deebeebridge/core";
import { serveStdio } from "../mcp/server.js";

export const mcpCommand = (registry: Registry) => serveStdio(registry);
