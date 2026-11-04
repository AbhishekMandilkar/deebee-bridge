import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { installSkill, missingSkillTargets, SKILL_TARGETS } from "../src/index";

let home: string;
beforeEach(async () => {
	home = await mkdtemp(join(tmpdir(), "dbb-skill-"));
});

describe("installSkill", () => {
	it("installs for the tools whose config directory exists", async () => {
		await mkdir(join(home, ".claude"));
		await mkdir(join(home, ".codex"));
		const done = await installSkill("# skill", { home });

		expect(done.map((d) => d.target)).toEqual(["claude", "codex"]);
		expect(
			await readFile(join(home, ".claude/skills/dbb/SKILL.md"), "utf8"),
		).toBe("# skill");
		expect(
			await readFile(join(home, ".agents/skills/dbb/SKILL.md"), "utf8"),
		).toBe("# skill");
	});

	it("installs nothing when no tool is detected", async () => {
		expect(await installSkill("# skill", { home })).toEqual([]);
	});

	it("creates directories for an explicitly named tool", async () => {
		const done = await installSkill("# skill", { home, only: ["cursor"] });
		expect(done).toHaveLength(1);
		expect(done[0]?.file).toBe(join(home, ".cursor/skills/dbb/SKILL.md"));
		expect(done[0]?.invoke).toBe("/dbb");
		expect(await readFile(done[0]?.file ?? "", "utf8")).toBe("# skill");
	});

	it("makes the Codex copy manual-only and uses $dbb", async () => {
		const [codex] = await installSkill("# skill", { home, only: ["codex"] });
		expect(codex?.invoke).toBe("$dbb");
		const yaml = await readFile(
			join(home, ".agents/skills/dbb/agents/openai.yaml"),
			"utf8",
		);
		expect(yaml).toContain("allow_implicit_invocation: false");
	});

	it("overwrites an earlier copy and leaves sibling skills alone", async () => {
		const other = join(home, ".claude/skills/other");
		await mkdir(other, { recursive: true });
		await writeFile(join(other, "SKILL.md"), "keep me");
		await installSkill("old", { home, only: ["claude"] });
		await installSkill("new", { home, only: ["claude"] });

		expect(
			await readFile(join(home, ".claude/skills/dbb/SKILL.md"), "utf8"),
		).toBe("new");
		expect(await readFile(join(other, "SKILL.md"), "utf8")).toBe("keep me");
	});

	it("knows the three tools", () => {
		expect(Object.keys(SKILL_TARGETS)).toEqual(["claude", "cursor", "codex"]);
	});
});

describe("missingSkillTargets", () => {
	it("lists detected tools without the skill, and nothing once installed", async () => {
		expect(missingSkillTargets(home)).toEqual([]);
		await mkdir(join(home, ".claude"));
		await mkdir(join(home, ".codex"));
		expect(missingSkillTargets(home)).toEqual(["claude", "codex"]);

		await installSkill("# skill", { home, only: ["claude"] });
		expect(missingSkillTargets(home)).toEqual(["codex"]);
		await installSkill("# skill", { home });
		expect(missingSkillTargets(home)).toEqual([]);
	});
});
