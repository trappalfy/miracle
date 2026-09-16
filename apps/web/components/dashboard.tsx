"use client";

import { useState } from "react";
import {
  ASSETS,
  ASSET_SYMBOLS,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
  feedStatusLabel,
  fromWad,
  isTradeable,
  riskWeightOf,
  toWad,
  type AssetSymbol,
  type PositionSide,
} from "@miracle/shared";
import { AssetBoard } from "./asset-board";
import { LedBar, fractionOf } from "./led-bar";
import { PriceBoard } from "./price-board";
import { useGame, type PositionView } from "./game-provider";
import { eth, shortAddress, signedUsd, timeLeft, usd, wadUsd } from "@/lib/format";
import { PHASE_LABEL, phaseTone } from "@/lib/season";

/** Dots in a row's swing bar. Fits a 400px screen; the capacity meter fills its row. */
const ROW_DOTS = 14;

/**
 * Direction carries its own colour, on hover and once chosen.
 *
 * Colouring only the hover would be worse than not colouring at all: the
 * button would turn green under the pointer and back to neutral on the click,
 * which reads as the click having failed. Long is the gain colour and short
 * the loss colour because that is what each one is betting on.
 */
const SIDE_STYLE: Record<PositionSide, { idle: string; active: string }> = {
  long: {
    idle: "border-ivory/15 text-muted hover:border-gain/50 hover:bg-gain/5 hover:text-gain",
    active: "border-gain/60 bg-gain/10 text-gain",
  },
  short: {
    idle: "border-ivory/15 text-muted hover:border-loss/50 hover:bg-loss/5 hover:text-loss",
    active: "border-loss/60 bg-loss/10 text-loss",
  },
};

/**
 * A headline number with the comparison that makes it mean something.
 *
 * A bar appears only where a real scale exists — leverage runs 3× to 10×
 * because the contract says so. Equity and profit have no ceiling, so they get
 * a sentence instead of an invented range.
 */
function Kpi({
  label,
  value,
  tone,
  note,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className={`tabular mt-1.5 text-xl ${tone ?? "text-text"}`}>{value}</div>
      {children}
      {note && <div className="tabular mt-1.5 text-xs text-faint">{note}</div>}
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`module p-5 ${className}`}>
      <h2 className="text-sm text-muted">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TradeForm() {
  const { quotes, open, busy, capacity, riskUsed, player } = useGame();
  const [symbol, setSymbol] = useState<AssetSymbol>("SPY");
  const [side, setSide] = useState<PositionSide>("long");
  const [notional, setNotional] = useState("");

  const quote = quotes.find((q) => q.symbol === symbol);
  const amount = Number(notional);
  const weight = riskWeightOf(symbol);
  const riskAfter = riskUsed + (Number.isFinite(amount) ? amount * weight : 0);

  const blocker = !player
    ? "Join the season first"
    : !quote
      ? "Waiting for a price"
      : !isTradeable(quote.status)
        ? feedStatusLabel(quote.status)
        : !Number.isFinite(amount) || amount <= 0
          ? "Enter a notional"
          : riskAfter > capacity
            ? "Exceeds your risk capacity"
            : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocker) return;
    await open({ symbol, side, notional: amount });
    setNotional("");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-faint">Asset</span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as AssetSymbol)}
            className="mt-1.5 w-full rounded-control border border-ivory/15 bg-void px-3 py-2 text-sm"
          >
            {ASSET_SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s} · risk {ASSETS[s].riskWeight.toFixed(1)}×
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-xs text-faint">Direction</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["long", "short"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSide(option)}
                aria-pressed={side === option}
                className={`rounded-control border px-3 py-2 text-sm capitalize transition-colors ${
                  side === option
                    ? SIDE_STYLE[option].active
                    : SIDE_STYLE[option].idle
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-xs text-faint">Notional (USD)</span>
        <input
          inputMode="decimal"
          value={notional}
          onChange={(e) => setNotional(e.target.value)}
          placeholder="5000"
          className="tabular mt-1.5 w-full rounded-control border border-ivory/15 bg-void px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={!!blocker || busy}
        className="w-full rounded-control bg-ivory px-4 py-2.5 text-sm font-medium text-void transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-ivory/20 disabled:text-faint"
      >
        {busy ? "Submitting…" : (blocker ?? "Open position")}
      </button>

      <p className="text-xs leading-relaxed text-faint">
        Your entry price is the first oracle round after the transaction lands, not the
        price shown above.
      </p>
    </form>
  );
}

/**
 * What a row is waiting for, in the player's words.
 *
 * Both ends of a trade wait for an oracle round published *strictly* after the
 * moment they were recorded — a round stamped in the same second does not
 * count. A feed publishes when the price moves half a percent or once a day,
 * so this wait is routinely hours and on Treasuries over a weekend can be two
 * days. Long enough that an unexplained blank reads as a broken screen, which
 * is why each state says what it is waiting for.
 */
function PositionState({ position }: { position: PositionView }) {
  if (position.voided) {
    return (
      <span
        className="text-warn"
        title="The feed published nothing for a week, so this settles at zero rather than at a guessed price."
      >
        voided
      </span>
    );
  }
  if (position.status === "settled") return <span className="text-faint">settled</span>;
  if (position.status === "closing") {
    return (
      <span
        className="text-warn"
        title="Closed. Your exit is the first oracle round published after that moment — hours on most feeds, up to a day on Treasuries and longer over a weekend. It still uses capacity until it is settled."
      >
        closing
      </span>
    );
  }
  if (position.entryPrice === null) {
    return (
      <span
        className="text-warn"
        title="Your entry is the first oracle round published after your transaction, never the price that was on screen. A round stamped in the same second does not count."
      >
        opening
      </span>
    );
  }
  return <span className="text-faint">open</span>;
}

function Positions() {
  const { positions, close, busy } = useGame();

  if (positions.length === 0) {
    return <p className="text-sm text-faint">No positions yet.</p>;
  }

  // Scaled to the biggest swing on this board, so the bars say which trade is
  // doing the most rather than repeating the number beside them.
  const peak = Math.max(0, ...positions.map((p) => Math.abs(p.pnl ?? 0)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="pb-2 font-normal">Asset</th>
            <th className="pb-2 font-normal">State</th>
            <th className="pb-2 text-right font-normal">Notional</th>
            <th className="pb-2 text-right font-normal">Entry</th>
            <th className="pb-2 text-right font-normal">Exit</th>
            <th className="hidden pb-2 sm:table-cell">
              <span className="sr-only">Swing</span>
            </th>
            <th className="pb-2 text-right font-normal">PnL</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ivory/8">
          {positions.map((position) => (
            <tr key={position.id}>
              <td className="py-3">
                {position.symbol}
                <span className="ml-2 text-xs text-faint capitalize">{position.side}</span>
              </td>
              <td className="py-3 text-xs">
                <PositionState position={position} />
              </td>
              <td className="tabular py-3 text-right">${usd(position.notional)}</td>
              <td className="tabular py-3 text-right text-muted">
                {position.entryPrice === null ? "—" : `$${usd(position.entryPrice)}`}
              </td>
              <td className="tabular py-3 text-right text-muted">
                {/* An open position has no exit yet, so it shows where it stands. */}
                {position.status === "settled"
                  ? position.exitPrice === null
                    ? "—"
                    : `$${usd(position.exitPrice)}`
                  : position.currentPrice === null
                    ? "—"
                    : `$${usd(position.currentPrice)}`}
              </td>
              <td className="hidden py-3 pl-4 sm:table-cell">
                <LedBar
                  fraction={fractionOf(Math.abs(position.pnl ?? 0), peak)}
                  total={ROW_DOTS}
                  tone={
                    position.pnl === null ? "ivory" : position.pnl >= 0 ? "gain" : "loss"
                  }
                />
              </td>
              <td
                className={`tabular py-3 pl-4 text-right ${
                  position.pnl === null
                    ? "text-faint"
                    : position.pnl >= 0
                      ? "text-gain"
                      : "text-loss"
                }`}
              >
                {position.pnl === null ? "—" : signedUsd(position.pnl)}
              </td>
              <td className="py-3 text-right">
                {position.status === "open" && (
                  <button
                    onClick={() => close(position.id)}
                    disabled={busy}
                    className="text-xs text-muted transition-colors hover:text-text disabled:text-faint"
                  >
                    Close
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Leaderboard() {
  const { leaderboard, address, season } = useGame();

  // Distance from the starting capital, scaled to whoever has moved furthest.
  const start = season ? toWad(season.startingCapital) : 0n;
  const peak = leaderboard.reduce((most, entry) => {
    const swing = entry.equity - start;
    const size = swing < 0n ? -swing : swing;
    return size > most ? size : most;
  }, 0n);

  if (leaderboard.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-faint">
        Nobody has entered yet. The board fills as players join, and the standings
        become final when the season settles on-chain.
      </p>
    );
  }

  return (
    <ol className="space-y-2.5">
      {leaderboard.map((entry) => {
        const isYou = address !== null && entry.address.toLowerCase() === address.toLowerCase();
        return (
          <li
            key={entry.address}
            className={`flex items-start justify-between gap-4 text-sm ${
              isYou ? "text-ivory" : "text-muted"
            }`}
          >
            <span className="tabular w-6 shrink-0 text-faint">
              {String(entry.rank).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {shortAddress(entry.address)}
              {isYou && <span className="ml-2 text-xs text-faint">you</span>}
              <LedBar
                fraction={fractionOf(
                  Math.abs(fromWad(entry.equity - start)),
                  fromWad(peak),
                )}
                total={ROW_DOTS}
                tone={entry.equity >= start ? "gain" : "loss"}
                className="mt-1.5"
              />
            </span>
            <span className="tabular">${wadUsd(entry.equity, 0)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Dashboard() {
  const {
    address,
    season,
    player,
    positions,
    equity,
    unrealisedPnl,
    leverage,
    capacity,
    riskUsed,
    adequate,
    quotesError,
    actionError,
    adapterKind,
    claimable,
    settlements,
    connect,
    disconnect,
    join,
    claim,
    settle,
    busy,
  } = useGame();

  const usage = capacity > 0 ? Math.min(100, (riskUsed / capacity) * 100) : 0;
  const openCount = positions.filter((p) => p.status !== "settled").length;

  return (
    /*
      The board continues here. Without the minimum height it would stop
      wherever the content does and leave the bottom of the screen flat black,
      which is the whole reason this screen looked unfinished.
    */
    <section
      className="led-section min-h-[calc(100dvh-5rem)]"
      style={
        {
          "--bloom-x": "88%",
          "--bloom-y": "8%",
          // Cool light from the lower left, warm from the upper right — the
          // temperature split the logo sets up, and the reason the left of a
          // wide board no longer falls away into flat black.
          "--bloom2-x": "4%",
          "--bloom2-y": "94%",
          "--bloom2-color": "rgba(110, 140, 168, 0.16)",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Shown only when the numbers really are local. The screen asks the
          adapter rather than carrying a claim of its own. */}
      {adapterKind === "mock" && (
        <div className="rounded-panel border border-warn/25 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-warn">
          A practice board. This season, your positions and your identity live only in
          this browser and nothing is at stake. Prices are real, read from Chainlink.
        </div>
      )}

      {quotesError && (
        <p className="mt-4 rounded-panel border border-loss/25 bg-loss/5 px-4 py-3 text-xs leading-relaxed text-loss">
          {quotesError}
        </p>
      )}

      {actionError && (
        <p className="mt-4 rounded-panel border border-loss/25 bg-loss/5 px-4 py-3 text-xs leading-relaxed text-loss">
          {actionError}
        </p>
      )}

      {settlements.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-ivory/25 bg-ivory/5 px-4 py-3.5">
          <p className="max-w-xl text-sm leading-relaxed text-text">
            {settlements.length === 1
              ? "One closed position has its exit round."
              : `${settlements.length} closed positions have their exit rounds.`}{" "}
            <span className="text-muted">
              Book the result to realise the profit or loss and free the capacity it is
              still holding. Anyone can do this; doing it yourself means not waiting.
            </span>
          </p>
          <button
            onClick={settle}
            disabled={busy}
            className="rounded-control bg-ivory px-4 py-2 text-xs font-medium text-void transition-colors hover:bg-white disabled:bg-ivory/20 disabled:text-faint"
          >
            {busy ? "Settling…" : "Settle"}
          </button>
        </div>
      )}

      {claimable > 0n && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-gain/30 bg-gain/5 px-4 py-3.5">
          <p className="text-sm text-gain">
            You finished in the money.{" "}
            <span className="tabular">{eth(claimable, 4)} ETH</span> is waiting for you.
          </p>
          <button
            onClick={claim}
            disabled={busy}
            className="rounded-control bg-gain px-4 py-2 text-xs font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Claiming…" : "Claim"}
          </button>
        </div>
      )}

      <header className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-light tracking-[-0.02em]">
              Season {season?.id ?? "—"}
            </h1>
            {season && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs ${phaseTone(season.phase)}`}
              >
                {PHASE_LABEL[season.phase]}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {season
              ? `Entry ${eth(season.entryFee)} ETH · pool ${eth(season.prizePool)} ETH · ${season.participants} of ${season.maxParticipants} players`
              : "Reading the season…"}
          </p>
          {season && (
            <p className="mt-1 text-xs text-faint">
              {season.phase === "entry"
                ? `Entry closes in ${timeLeft(season.entryClosesAt)}, and trading starts the same moment.`
                : season.phase === "live"
                  ? `Trading ends in ${timeLeft(season.tradingEndsAt)}.`
                  : season.phase === "settling"
                    ? "Trading has ended. Positions are settling against their exit rounds."
                    : season.phase === "settled"
                      ? "The ranking is on-chain. Prizes are claimable."
                      : "Entry has not opened yet."}
            </p>
          )}
        </div>

        {address ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="tabular text-muted">{shortAddress(address)}</span>
            <button onClick={disconnect} className="text-muted hover:text-text">
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            className="rounded-control bg-ivory px-5 py-2.5 text-sm font-medium text-void hover:bg-white"
          >
            Connect
          </button>
        )}
      </header>

      {/*
        The tape, as at the base of the hero. On a trading screen the movement
        is not decoration: these are the prices every position settles against,
        and they are read by this browser straight from Chainlink.
      */}
      <div className="mt-6 rounded-panel border border-ivory/10 bg-void/50 px-4 py-2.5 backdrop-blur-sm">
        <PriceBoard />
      </div>

      {!address ? (
        <>
          <p className="mt-10 max-w-md text-sm leading-relaxed text-muted">
            {adapterKind === "chain"
              ? "Connect a wallet to enter the season. It signs your transactions and nothing else — we never ask for a seed phrase and cannot move anything you hold."
              : "Connect to take a practice board. Nothing is signed and nothing is at stake."}
          </p>
          <AssetBoard className="mt-12" />
        </>
      ) : !player ? (
        <div className="mt-10">
          <p className="max-w-md text-sm leading-relaxed text-muted">
            You have not entered this season yet. Everyone starts with the same{" "}
            <span className="tabular text-text">
              ${usd(season?.startingCapital ?? 0, 0)}
            </span>{" "}
            of virtual capital, so the best trader wins rather than the biggest wallet.
          </p>
          {season?.phase === "entry" ? (
            <button
              onClick={join}
              disabled={busy}
              className="mt-5 rounded-control bg-ivory px-5 py-2.5 text-sm font-medium text-void hover:bg-white disabled:bg-ivory/20 disabled:text-faint"
            >
              {busy ? "Entering…" : `Enter for ${eth(season?.entryFee ?? 0n)} ETH`}
            </button>
          ) : (
            // Entry is a phase, not a button. Offering it outside that phase
            // would send someone to a transaction the contract will refuse.
            <p className="mt-5 text-sm text-warn">
              Entry for this season has closed. The next season starts fresh.
            </p>
          )}
          <AssetBoard className="mt-12" />
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            <Kpi
              label="Equity"
              value={equity === null ? "—" : `$${usd(equity)}`}
              note={
                equity === null || !season
                  ? undefined
                  : `${signedUsd(equity - season.startingCapital)} since the start`
              }
            />
            <Kpi
              label="Capacity"
              value={`$${usd(capacity, 0)}`}
              note={`$${usd(riskUsed, 0)} of it in use`}
            />
            <Kpi label="Leverage" value={`${leverage.toFixed(2)}×`}>
              {/* The one figure here with real bounds: the contract caps it. */}
              <LedBar
                fraction={fractionOf(
                  leverage - MIN_LEVERAGE,
                  MAX_LEVERAGE - MIN_LEVERAGE,
                )}
                total={8}
                className="mt-2.5"
              />
              <span className="mt-1.5 block text-xs text-faint">
                {MIN_LEVERAGE}× → {MAX_LEVERAGE}×
              </span>
            </Kpi>
            <Kpi
              label="Unrealised"
              value={signedUsd(unrealisedPnl)}
              tone={unrealisedPnl >= 0 ? "text-gain" : "text-loss"}
              note={
                openCount === 0
                  ? "nothing open"
                  : `across ${openCount} open position${openCount === 1 ? "" : "s"}`
              }
            />
          </div>

          <div className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs">
              <span className="text-faint">Risk-weighted exposure</span>
              <span className="tabular text-faint">
                ${usd(riskUsed, 0)} / ${usd(capacity, 0)} · {usage.toFixed(0)}%
              </span>
            </div>
            {/* No fixed count: it fills the row and remeasures if the window does. */}
            <LedBar
              fraction={fractionOf(usage, 100)}
              tone={adequate ? "ivory" : "loss"}
              className="mt-2.5"
              label={`${usage.toFixed(0)} percent of capacity in use`}
            />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-5">
              <Panel title="Open a position">
                <TradeForm />
              </Panel>
              <Panel title="Positions">
                <Positions />
              </Panel>
            </div>
            <Panel title="Leaderboard" className="h-fit">
              <Leaderboard />
            </Panel>
          </div>
        </>
      )}
      </div>
    </section>
  );
}
