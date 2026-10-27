import {
	BridgeError,
	createRegistry,
	redact,
	serverStore,
} from "@deebeebridge/core";
import { Command } from "commander";
import pkg from "../package.json";
import { type AddFlags, addCommand } from "./commands/add";
import { listCommand } from "./commands/list";
import {
	mcpCommand,
	mcpLogsCommand,
	mcpServeCommand,
	mcpStartCommand,
	mcpStatusCommand,
	mcpStopCommand,
} from "./commands/mcp";
import { testCommand } from "./commands/test";

const program = new Command()
	.name("deebeebridge")
	.version(pkg.version)
	.description(
		"Register database connections once; let AI agents use them by name.",
	);
const registry = createRegistry();
const server = serverStore();

program
	.command("add")
	.description("Add a connection (interactive; flags skip prompts)")
	.option("--type <type>")
	.option("--name <name>")
	.option("--host <host>")
	.option("--port <port>")
	.option("--database <database>")
	.option("--user <user>")
	.option("--ssl", "use SSL")
	.option("--no-ssl", "do not use SSL")
	.option("--mode <mode>", "read-only | read-write")
	.option("--row-limit <n>")
	.option(
		"--url <url>",
		"connection URL, e.g. postgres://user:pass@host:5432/db?sslmode=require ('-' reads it from stdin; or set DEEBEEBRIDGE_URL)",
	)
	.option(
		"--password-stdin",
		"read the password from stdin (or set DEEBEEBRIDGE_PASSWORD)",
	)
	.action((flags: AddFlags) => addCommand(registry, flags));

program
	.command("list")
	.description("List connections (no secrets)")
	.option("--json")
	.action((flags) => listCommand(registry, flags));

program
	.command("test <name>")
	.description("Connect and report latency")
	.action((name: string) => testCommand(registry, name));

const mcp = program
	.command("mcp")
	.description(
		"MCP server: stdio when run bare (Claude Code, Cursor launch it), or a background HTTP server via start/stop",
	)
	.action(() => mcpCommand(registry));

mcp
	.command("start")
	.description(
		"Start the MCP server in the background and print how to connect",
	)
	.option("--port <n>", "listen on this port instead of the defaults")
	.action((flags) => mcpStartCommand(server, flags));

mcp
	.command("stop")
	.description("Stop the background MCP server")
	.action(() => mcpStopCommand(server));

mcp
	.command("status")
	.description("Show whether the background MCP server is running")
	.action(() => mcpStatusCommand(server));

mcp
	.command("logs")
	.description("Show the end of the background server's log")
	.option("-n, --lines <n>", "number of lines", "50")
	.action((flags) => mcpLogsCommand(server, flags));

mcp
	.command("serve")
	.description("Run the HTTP MCP server in the foreground (what `start` runs)")
	.option("--port <n>", "listen on this port instead of the defaults")
	.action((flags) => mcpServeCommand(registry, server, flags));

program.parseAsync().catch((err: unknown) => {
	// ExitPromptError = user pressed Ctrl+C in a prompt.
	if (err instanceof Error && err.name === "ExitPromptError") process.exit(130);
	console.error(
		err instanceof BridgeError
			? String(err)
			: redact(err instanceof Error ? err.message : String(err)),
	);
	process.exit(1);
});
