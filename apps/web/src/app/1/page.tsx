import type { Metadata } from "next";

import { Closing, Footer } from "@/components/variants/v1/closing";
import { Faq } from "@/components/variants/v1/faq";
import { Header } from "@/components/variants/v1/header";
import { Hero } from "@/components/variants/v1/hero";
import { Locks } from "@/components/variants/v1/locks";
import { Numbers } from "@/components/variants/v1/numbers";
import { Setup } from "@/components/variants/v1/setup";

export const metadata: Metadata = {
	title: "deebeebridge: your agent queries prod, never the password",
	description:
		"deebeebridge keeps database credentials in your OS keychain and gives AI agents a connection name instead.",
};

export default function VariantOne() {
	return (
		<>
			<Header />
			<main>
				<Hero />
				<Setup />
				<Locks />
				<Numbers />
				<Faq />
				<Closing />
			</main>
			<Footer />
		</>
	);
}
