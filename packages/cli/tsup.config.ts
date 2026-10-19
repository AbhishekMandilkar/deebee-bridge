import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/cli.ts"],
	format: ["esm"],
	target: "node20",
	platform: "node",
	clean: true,
	sourcemap: true,
	// Inline the private workspace packages; real deps stay external.
	noExternal: [/^@deebeebridge\//],
	banner: { js: "#!/usr/bin/env node" },
});
