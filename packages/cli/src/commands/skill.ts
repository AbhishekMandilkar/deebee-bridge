import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	installSkill,
	SKILL_TARGETS,
	type SkillTarget,
} from "@deebeebridge/core";

const SKILL_FILE = fileURLToPath(
	new URL("../skills/dbb/SKILL.md", import.meta.url),
);

export async function skillInstallCommand(targets: string[]): Promise<void> {
	const known = Object.keys(SKILL_TARGETS);
	const bad = targets.filter((t) => !known.includes(t));
	if (bad.length > 0) {
		throw new Error(
			`unknown target "${bad[0]}"; choose from ${known.join(", ")}`,
		);
	}

	const only = targets.length > 0 ? (targets as SkillTarget[]) : undefined;
	const done = await installSkill(readFileSync(SKILL_FILE, "utf8"), { only });
	if (done.length === 0) {
		console.error(
			`No supported tool found. Name one explicitly: deebeebridge skill install ${known.join("|")}`,
		);
		process.exitCode = 1;
		return;
	}
	for (const d of done) {
		console.log(`${d.label}: ${d.file}  (use ${d.invoke} <question>)`);
	}
	console.log(
		"\nRestart open sessions to pick it up. Add a `.dbb.md` to a project to name its default connection and tables (docs/skill.md).",
	);
}
