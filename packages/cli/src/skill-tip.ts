import { missingSkillTargets } from "@deebeebridge/core";

/** One-line nudge after `add` and `mcp start`; silent in scripts and once the skill is installed. */
export function skillTip(): void {
	if (!process.stdout.isTTY || missingSkillTargets().length === 0) return;
	console.log(
		"\n⚡ Tip: run `dbb skill install`, then just type `/dbb last logged in user` in your agent. No more spelling out connections and tables.",
	);
}
