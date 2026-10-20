import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Problem } from "@/components/landing/problem";
import { Setup } from "@/components/landing/setup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function Home() {
	return (
		<>
			<SiteHeader />
			<main>
				<Hero />
				<Problem />
				<Setup />
				<HowItWorks />
			</main>
			<SiteFooter />
		</>
	);
}
