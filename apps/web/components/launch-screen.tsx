"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FIRST_SEASON,
  announcedSchedule,
  placePrizes,
  platformFee,
} from "@miracle/shared";
import { useGame } from "./game-provider";
import { eth, fullDate, usd } from "@/lib/format";

/**
 * The screen where a season would be, before there is one.
 *
 * It has three states and they are driven by data, not by editing this file:
 * the announcement in `FIRST_SEASON` decides whether there is a date at all,
 * and once a season exists on-chain its own phase decides whether entry is
 * actually open. A browser clock reaching zero is not permission to play.
 *
 * While no date is announced it says exactly that. It never counts down to a
 * placeholder — a countdown is a promise, and an invented one is a lie that
 * gets found out at the moment it matters most.
 */

const SCHEDULE = announcedSchedule(FIRST_SEASON);

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingUntil(target: Date, now: number): Remaining | null {
  const ms = target.getTime() - now;
  if (ms <= 0) return null;

  const seconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor(seconds / 3_600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-panel border border-ivory/12 bg-panel px-3 py-3 sm:px-5 sm:py-4">
        <span className="tabular block text-[clamp(2rem,8vw,4rem)] font-light leading-none tracking-[-0.04em] text-ivory">
          {value}
        </span>
      </div>
      <span className="mt-2.5 text-[0.7rem] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  );
}

/**
 * A clock that only exists in the browser.
 *
 * The server has no idea what time it is where the reader is, and rendering a
 * number there would hydrate into a mismatch. Null until mounted.
 */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}

function Countdown({ to, now }: { to: Date; now: number | null }) {
  const remaining = now === null ? null : remainingUntil(to, now);

  // Before the clock mounts, and at zero, the cells hold their shape so the
  // page does not jump when the numbers arrive or run out.
  const pad = (value: number) => String(value).padStart(2, "0");
  const cells = remaining
    ? [
        { value: pad(remaining.days), label: "days" },
        { value: pad(remaining.hours), label: "hours" },
        { value: pad(remaining.minutes), label: "minutes" },
        { value: pad(remaining.seconds), label: "seconds" },
      ]
    : [
        { value: "––", label: "days" },
        { value: "––", label: "hours" },
        { value: "––", label: "minutes" },
        { value: "––", label: "seconds" },
      ];

  return (
    <div>
      {/* Coarse for screen readers: being interrupted every second is unusable. */}
      <p className="sr-only">
        {remaining
          ? `${remaining.days} days and ${remaining.hours} hours remaining.`
          : "Counting down."}
      </p>
      <div aria-hidden="true" className="flex gap-3 sm:gap-5">
        {cells.map((cell) => (
          <Cell key={cell.label} value={cell.value} label={cell.label} />
        ))}
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-ivory/8 pb-4">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="tabular mt-1.5 text-base text-text">{value}</dd>
    </div>
  );
}

/** The announced terms, read from the same object the season is created with. */
function Terms() {
  const pool = FIRST_SEASON.entryFee * BigInt(FIRST_SEASON.maxParticipants);
  const distributable = pool - platformFee(pool, FIRST_SEASON.feeBps);
  const prizes = placePrizes(
    distributable,
    FIRST_SEASON.payoutBps,
    FIRST_SEASON.maxParticipants,
  );
  const topPrize = prizes.length > 0 ? prizes[0] : null;

  return (
    <div>
      <h2 className="text-sm text-muted">What has been decided</h2>

      <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Term label="Entry" value={`${eth(FIRST_SEASON.entryFee)} ETH`} />
        <Term label="Places" value={`${FIRST_SEASON.maxParticipants} players`} />
        <Term
          label="Starting capital"
          value={`$${usd(FIRST_SEASON.startingCapital, 0)} each`}
        />
        <Term
          label="Entry stays open"
          value={`${FIRST_SEASON.entryDurationSeconds / 86_400} days`}
        />
        <Term
          label="Trading runs"
          value={`${FIRST_SEASON.tradingDurationSeconds / 86_400} days`}
        />
        <Term
          label="Platform fee"
          value={FIRST_SEASON.feeBps === 0 ? "None" : `${FIRST_SEASON.feeBps / 100}%`}
        />
      </dl>

      {topPrize !== null && (
        <p className="mt-6 max-w-xl text-xs leading-relaxed text-faint">
          The top {FIRST_SEASON.payoutBps.length} places are paid. If all{" "}
          {FIRST_SEASON.maxParticipants} places fill, the pool is{" "}
          <span className="tabular text-muted">{eth(pool, 2)} ETH</span> and first place
          takes <span className="tabular text-muted">{eth(topPrize, 3)} ETH</span> — a
          figure that falls with the turnout, not a guaranteed prize.
        </p>
      )}
    </div>
  );
}

/**
 * This screen only renders when there is no season to play, so it never has to
 * describe an open one — `PlayGate` sends those to the board instead. What it
 * does have to handle is the gap in between: the announced moment has passed
 * but the season has not appeared on-chain yet.
 */
export function LaunchScreen() {
  const { season, refresh } = useGame();
  const now = useNow();

  const opensAt = FIRST_SEASON.opensAt;
  const due = opensAt !== null && now !== null && now >= opensAt.getTime();

  /*
    The moment the clock runs out, ask the chain — do not sit through the rest
    of the polling interval. Access is still granted by the contract's phase
    and never by this timer; reaching zero only means it is worth looking.
  */
  useEffect(() => {
    if (due) refresh();
  }, [due, refresh]);

  return (
    <>
      <section
        className="led-section"
        style={{ "--bloom-x": "76%", "--bloom-y": "26%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-12">
          {opensAt === null ? (
            <>
              <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
                The first season has not opened yet.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
                The date has not been announced, so there is no countdown to show you.
                When it is set it appears here, and the season is created on-chain with
                the same date — nothing about it is decided in a web page.
              </p>
            </>
          ) : due ? (
            <>
              <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
                Entry is due to open.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
                The announced moment has passed
                {season === null
                  ? ", and the season has not appeared on-chain yet."
                  : `, and the season is ${season.phase === "upcoming" ? "created but not taking entries yet" : "no longer taking entries"}.`}{" "}
                This page follows the contract, not this clock, so it waits rather than
                letting anyone in early.
              </p>
              <p className="mt-6 text-sm text-muted">
                It refreshes on its own. Nothing is lost by waiting.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
                The first season opens soon.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
                Entry opens {fullDate(opensAt)}.
              </p>
              <div className="mt-10">
                <Countdown to={opensAt} now={now} />
                <p className="mt-4 text-xs text-faint">until entry opens</p>
              </div>
              <p className="mt-8 max-w-xl text-xs leading-relaxed text-faint">
                Entry opens when the contract says it does. If this clock reaches zero
                first, the page waits for the chain rather than letting you in early.
              </p>
            </>
          )}
        </div>
      </section>

      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "14%", "--bloom-y": "24%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 py-16">
          <Terms />

          {SCHEDULE && (
            <dl className="mt-12 grid gap-x-10 gap-y-5 sm:grid-cols-3">
              <Term label="Entry opens" value={fullDate(SCHEDULE.entryOpensAt)} />
              <Term
                label="Entry closes, trading starts"
                value={fullDate(SCHEDULE.tradingStartsAt)}
              />
              <Term label="Trading ends" value={fullDate(SCHEDULE.tradingEndsAt)} />
            </dl>
          )}

          <p className="mt-12 max-w-xl text-sm leading-relaxed text-muted">
            In the meantime you can{" "}
            <Link href="/rules" className="text-text underline-offset-4 hover:underline">
              read the rules
            </Link>{" "}
            the season runs on, or{" "}
            <Link href="/demo" className="text-text underline-offset-4 hover:underline">
              try the interface
            </Link>{" "}
            against live Chainlink prices with nothing at stake.
          </p>
        </div>
      </section>
    </>
  );
}
