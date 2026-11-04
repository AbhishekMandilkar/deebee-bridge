"use client";

import { Button } from "@deebeebridge/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label="Toggle light and dark theme"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			className="text-text-subtle hover:text-foreground"
		>
			<Sun aria-hidden className="hidden dark:block" />
			<Moon aria-hidden className="dark:hidden" />
		</Button>
	);
}
