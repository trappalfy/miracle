import type { Metadata } from "next";
import { GameProvider } from "@/components/game-provider";
import { PlayGate } from "@/components/play-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Play",
  description:
    "Enter the Miracle season: same starting capital for everyone, Chainlink prices, and a leaderboard nobody can edit.",
};

export default function PlayPage() {
  return (
    <main className="relative min-h-dvh">
      <div className="relative h-20">
        <SiteHeader />
      </div>

      <GameProvider>
        <PlayGate />
      </GameProvider>

      <SiteFooter />
    </main>
  );
}
