import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const SKILL_NAME = "dbb";

type Target = {
	label: string;
	/** Directory under home whose presence means the tool is installed. */
	detect: string;
	/** User-level skills directory under home. */
	skillsDir: string;
	/** How the user invokes the skill in that tool. */
	invoke: string;
	/** Extra files written beside SKILL.md, keyed by path inside the skill directory. */
	extra?: Record<string, string>;
};

/** Where each tool reads user-level skills. Adding a tool is one entry. */
export const SKILL_TARGETS = {
	claude: {
		label: "Claude Code",
		detect: ".claude",
		skillsDir: ".claude/skills",
		invoke: `/${SKILL_NAME}`,
	},
	cursor: {
		label: "Cursor",
		detect: ".cursor",
		skillsDir: ".cursor/skills",
		invoke: `/${SKILL_NAME}`,
	},
	codex: {
		label: "Codex",
		detect: ".codex",
		skillsDir: ".agents/skills",
		invoke: `$${SKILL_NAME}`,
		// Codex ignores `disable-model-invocation`; this is its equivalent (manual `$dbb` only).
		extra: {
			"agents/openai.yaml": "policy:\n  allow_implicit_invocation: false\n",
		},
	},
} as const satisfies Record<string, Target>;

export type SkillTarget = keyof typeof SKILL_TARGETS;

export interface InstalledSkill {
	target: SkillTarget;
	label: string;
	file: string;
	invoke: string;
}

/** Detected tools that do not have the skill yet (empty when none are detected or all have it). */
export function missingSkillTargets(home = homedir()): SkillTarget[] {
	return (Object.keys(SKILL_TARGETS) as SkillTarget[]).filter(
		(n) =>
			existsSync(join(home, SKILL_TARGETS[n].detect)) &&
			!existsSync(
				join(home, SKILL_TARGETS[n].skillsDir, SKILL_NAME, "SKILL.md"),
			),
	);
}

/**
 * Write the skill into each tool's user-level (global) skills directory, overwriting any
 * earlier copy. With no `only`, installs for every tool whose config directory exists.
 */
export async function installSkill(
	content: string,
	opts: { home?: string; only?: readonly SkillTarget[] } = {},
): Promise<InstalledSkill[]> {
	const home = opts.home ?? homedir();
	const names = Object.keys(SKILL_TARGETS) as SkillTarget[];
	const chosen =
		opts.only ??
		names.filter((n) => existsSync(join(home, SKILL_TARGETS[n].detect)));

	const done: InstalledSkill[] = [];
	for (const target of chosen) {
		const spec: Target = SKILL_TARGETS[target];
		const dir = join(home, spec.skillsDir, SKILL_NAME);
		const files = { "SKILL.md": content, ...spec.extra };
		for (const [rel, text] of Object.entries(files)) {
			await mkdir(join(dir, rel, ".."), { recursive: true });
			await writeFile(join(dir, rel), text);
		}
		done.push({
			target,
			label: spec.label,
			file: join(dir, "SKILL.md"),
			invoke: spec.invoke,
		});
	}
	return done;
}
