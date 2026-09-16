import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { GameProvider } from "@/components/game-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "The Miracle trading interface running on live Chainlink prices, with a season that exists only in your browser.",
  // Nothing here is the real game; it should not be the page people find.
  robots: { index: false, follow: true },
};

/**
 * The interface, playable before there is a season.
 *
 * This is the only screen that asks the mock adapter to present a season, and
 * the dashboard it renders carries its own banner saying the season, positions
 * and identity live in this browser alone. Prices are real.
 */
export default function DemoPage() {
  return (
    <main className="relative min-h-dvh">
      <div className="relative h-20">
        <SiteHeader />
      </div>

      <GameProvider mode="demo">
        <Dashboard />
      </GameProvider>
    </main>
  );
}
