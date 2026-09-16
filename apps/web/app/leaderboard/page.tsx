import type { Metadata } from "next";
import { GameProvider } from "@/components/game-provider";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Standings for the current Miracle season: equity, swing and what each place pays.",
};

export default function LeaderboardPage() {
  return (
    <main className="relative min-h-dvh">
      {/* The header is absolute, so the page opens with room for it. */}
      <div className="relative h-20">
        <SiteHeader />
      </div>

      <GameProvider>
        <LeaderboardBoard />
      </GameProvider>

      <SiteFooter />
    </main>
  );
}
