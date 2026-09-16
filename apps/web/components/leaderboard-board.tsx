"use client";

import Link from "next/link";
import { fromWad, placePrizes, platformFee, seasonPlaces, toWad } from "@miracle/shared";
import { useGame } from "./game-provider";
import { LedBar, fractionOf } from "./led-bar";
import {
  eth,
  fullDate,
  shortAddress,
  signedWadUsd,
  timeLeft,
  wadUsd,
} from "@/lib/format";
import { PHASE_LABEL, PHASE_NOTE, phaseTone } from "@/lib/season";

/** Dots in a row's swing bar, on the 7px grid the whole board uses. */
const DOTS = 14;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className="tabular mt-1.5 text-xl font-light text-text">{value}</div>
      {note && <div className="mt-1 text-xs text-faint">{note}</div>}
    </div>
  );
}

/**
 * How far this player has moved from the starting capital, drawn as LEDs.
 * Scaled to the biggest swing in the season, so the bars say who moved most
 * rather than restating the number beside them.
 */
function SwingBar({ pnl, peak }: { pnl: number; peak: number }) {
  return (
    <LedBar
      fraction={fractionOf(Math.abs(pnl), peak)}
      total={DOTS}
      tone={pnl >= 0 ? "gain" : "loss"}
    />
  );
}

export function LeaderboardBoard() {
  const { season, seasonLoaded, leaderboard, address, quotesError } = useGame();

  if (!season) {
    return (
      <section
        className="led-section"
        style={{ "--bloom-x": "80%", "--bloom-y": "30%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-12">
          {!seasonLoaded ? (
            <p className="text-sm text-faint">Reading the season…</p>
          ) : (
            <>
              <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
                No season has been played yet.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
                There is nothing to rank until the first season runs. When it does, the
                standings appear here and the final order is settled on-chain.
              </p>
              <Link
                href="/play"
                className="mt-9 inline-block text-sm text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
              >
                See the first season →
              </Link>
            </>
          )}
        </div>
      </section>
    );
  }

  const distributable = season.prizePool - platformFee(season.prizePool, season.feeBps);
  const places = seasonPlaces(
    leaderboard.map((entry) => entry.equity),
    season.payoutBps,
    distributable,
  );

  // The prize table is worth showing before anyone has traded, so it is sized
  // by the field the season can hold rather than by who has turned up.
  const prizeTable = placePrizes(
    distributable,
    season.payoutBps,
    Math.max(leaderboard.length, season.payoutBps.length),
  );
  const curveTotalBps = season.payoutBps
    .slice(0, prizeTable.length)
    .reduce((total, bps) => total + bps, 0);

  // Equity is exact WAD all the way through the ranking and the payout split;
  // it becomes a display number only inside the row that prints it.
  const startingCapital = toWad(season.startingCapital);
  const peakSwing = Math.max(
    0,
    ...leaderboard.map((entry) => Math.abs(fromWad(entry.equity - startingCapital))),
  );
  const settled = season.phase === "settled";

  return (
    <>
      <section
        className="led-section"
        style={{ "--bloom-x": "84%", "--bloom-y": "18%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Season {season.id}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${phaseTone(season.phase)}`}
            >
              {PHASE_LABEL[season.phase]}
            </span>
          </div>

          <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
            Leaderboard
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">
            {PHASE_NOTE[season.phase]}
          </p>

          <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
            <Stat
              label="Prize pool"
              value={`${eth(season.prizePool)} ETH`}
              note={season.feeBps === 0 ? "No platform fee" : `${season.feeBps / 100}% fee`}
            />
            <Stat label="Entry" value={`${eth(season.entryFee)} ETH`} />
            <Stat
              label="Players"
              value={String(season.participants)}
              note={`of ${season.maxParticipants} places`}
            />
            <Stat
              label={settled ? "Trading ended" : "Trading ends"}
              value={settled ? "—" : timeLeft(season.tradingEndsAt)}
              note={fullDate(season.tradingEndsAt)}
            />
          </div>
        </div>
      </section>

      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "8%", "--bloom-y": "30%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 py-16">
          {quotesError && (
            <p className="mb-8 rounded-panel border border-warn/25 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-warn">
              Standings are stale: {quotesError}
            </p>
          )}

          {leaderboard.length === 0 ? (
            <p className="text-sm text-faint">
              Nobody has entered this season yet. The first player to join takes first
              place by default — and keeps it until someone trades better.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-sm text-muted">
                  {settled ? "Final standings" : "Standings"}
                </h2>
                <span className="text-xs text-faint">
                  {settled ? "Final, accepted on-chain" : "Settled results only"}
                </span>
              </div>

              {/* Genuinely tabular, so it is a table — and scrolls sideways on a
                  phone rather than folding into something unreadable. */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-faint">
                      <th scope="col" className="pb-3 font-normal">
                        #
                      </th>
                      <th scope="col" className="pb-3 font-normal">
                        Player
                      </th>
                      <th scope="col" className="hidden pb-3 font-normal md:table-cell">
                        <span className="sr-only">Swing</span>
                      </th>
                      <th scope="col" className="pb-3 text-right font-normal">
                        Change
                      </th>
                      <th scope="col" className="pb-3 text-right font-normal">
                        Equity
                      </th>
                      <th scope="col" className="pb-3 text-right font-normal">
                        Prize
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory/8">
                    {leaderboard.map((entry, index) => {
                      const place = places[index];
                      const pnl = entry.equity - startingCapital;
                      const isYou =
                        address !== null &&
                        entry.address.toLowerCase() === address.toLowerCase();

                      return (
                        <tr key={entry.address} className={isYou ? "text-ivory" : ""}>
                          <td className="tabular w-8 py-3.5 text-faint">
                            {String(place?.place ?? index + 1).padStart(2, "0")}
                          </td>

                          <td className="tabular py-3.5 text-text">
                            {shortAddress(entry.address)}
                            {isYou && (
                              <span className="ml-2 text-xs text-faint">you</span>
                            )}
                          </td>

                          <td className="hidden py-3.5 pl-4 md:table-cell">
                            <SwingBar pnl={fromWad(pnl)} peak={peakSwing} />
                          </td>

                          <td
                            className={`tabular py-3.5 pl-4 text-right ${
                              pnl >= 0n ? "text-gain" : "text-loss"
                            }`}
                          >
                            {signedWadUsd(pnl)}
                          </td>

                          <td className="tabular py-3.5 pl-4 text-right text-text">
                            ${wadUsd(entry.equity, 0)}
                          </td>

                          <td className="tabular py-3.5 pl-4 text-right text-muted">
                            {place && place.payout > 0n
                              ? `${eth(place.payout, 4)} ETH`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!settled && (
                <p className="mt-6 max-w-2xl text-xs leading-relaxed text-faint">
                  These are settled results: starting capital plus the profit and loss of
                  trades that have closed and found their exit round. An open position
                  counts for nothing here however well it is doing, which is exactly how
                  the contract ranks — so a player sitting on a large open gain can climb
                  sharply the moment it settles.
                </p>
              )}

              {!address && season.phase !== "settled" && (
                <Link
                  href="/play"
                  className="mt-8 inline-block text-sm text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
                >
                  Not on this board yet? Enter the season →
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "70%", "--bloom-y": "70%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-sm text-muted">What each place pays</h2>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-faint">
            Read from this season&rsquo;s own curve. Players who finish on equal equity
            pool the places they span and split them evenly.
          </p>

          <ul className="mt-7 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {prizeTable.map((prize, index) => (
              <li
                key={index}
                className="flex items-baseline gap-3 border-b border-ivory/8 pb-2.5 text-sm"
              >
                <span className="tabular w-7 shrink-0 text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="tabular flex-1 text-text">
                  {eth(prize, 4)} <span className="text-faint">ETH</span>
                </span>
                <span className="tabular text-xs text-muted">
                  {curveTotalBps > 0
                    ? ((season.payoutBps[index] / curveTotalBps) * 100).toFixed(0)
                    : "0"}
                  %
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
