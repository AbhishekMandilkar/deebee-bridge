import { BridgeError, createRegistry, redact } from "@deebeebridge/core";
import { Command } from "commander";
import { type AddFlags, addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { mcpCommand } from "./commands/mcp.js";
import { testCommand } from "./commands/test.js";

const program = new Command()
	.name("deebeebridge")
	.description(
		"Register database connections once; let AI agents use them by name.",
	);
const registry = createRegistry();

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

program
	.command("mcp")
	.description(
		"Start the MCP server on stdio (used by Claude Code, Cursor, ...)",
	)
	.action(() => mcpCommand(registry));

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
