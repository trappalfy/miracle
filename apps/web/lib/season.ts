import type { SeasonPhase } from "@miracle/shared";

/**
 * What each phase is called, and what it means for someone looking at it.
 *
 * The order matches the contract's `Phase` enum, so a season read from the
 * chain lands here without translation.
 */
export const PHASE_LABEL: Record<SeasonPhase, string> = {
  upcoming: "Opening soon",
  entry: "Entry open",
  live: "Trading",
  settling: "Settling",
  settled: "Finished",
};

export const PHASE_NOTE: Record<SeasonPhase, string> = {
  upcoming: "Entry has not opened yet. Nothing has been staked and nothing has moved.",
  entry: "Players are entering. Trading begins when entry closes, so nobody is ahead yet.",
  live: "Positions are open. Standings move with the market until trading closes.",
  settling:
    "Trading is closed and positions are being settled against their exit rounds. The final ranking has not been accepted yet.",
  settled: "The ranking is on-chain and the prizes are claimable.",
};

/** Green only once the result is real; amber while it is still in motion. */
export function phaseTone(phase: SeasonPhase): string {
  if (phase === "settled") return "border-gain/30 bg-gain/10 text-gain";
  if (phase === "live" || phase === "entry") return "border-ivory/25 bg-ivory/10 text-ivory";
  return "border-warn/30 bg-warn/10 text-warn";
}
