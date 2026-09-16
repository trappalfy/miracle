"use client";

import { Dashboard } from "./dashboard";
import { LaunchScreen } from "./launch-screen";
import { useGame } from "./game-provider";

/**
 * Decides whether there is a game to show.
 *
 * The adapter is the only authority on that: if it reports a season that is
 * taking entries or trading, the board goes up; otherwise this is the screen
 * before the first season, and it says so. Nothing here checks a date — the
 * chain's phase decides, so a clock running fast on someone's laptop cannot
 * let them in early or lock them out late.
 */
export function PlayGate() {
  const { season, seasonLoaded } = useGame();

  // Until the chain has answered, say nothing. Rendering the pre-launch screen
  // while the read is in flight would announce that there is no season to
  // someone about to be shown one.
  if (!seasonLoaded) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-sm text-faint">Reading the season from the chain…</p>
      </div>
    );
  }

  const playable =
    season !== null && (season.phase === "entry" || season.phase === "live");

  return playable ? <Dashboard /> : <LaunchScreen />;
}
