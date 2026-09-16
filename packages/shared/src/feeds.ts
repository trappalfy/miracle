import type { FeedStatus } from "./types";

/**
 * Deciding whether a Chainlink quote can be traded against.
 *
 * Equity and ETF feeds run 24/5 with a 24-hour heartbeat: outside market hours
 * they simply hold Friday's last price and stop publishing. A contract that
 * only checks `answer > 0` will happily trade that stale close all weekend, so
 * freshness and market hours are two separate questions and both must be asked.
 *
 * Known gap: US market holidays are not modelled here. On a holiday the clock
 * says open while the feed quietly stops moving. The contract's own staleness
 * bound is the authority; this classification exists so the interface can
 * explain itself rather than silently refusing a trade.
 */

const MARKET_TIMEZONE = "America/New_York";
const OPENING_BELL_MINUTES = 9 * 60 + 30;
const CLOSING_BELL_MINUTES = 16 * 60;

const newYorkParts = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(at: Date): { weekday: string; minutes: number } {
  const parts = newYorkParts.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: read("weekday"),
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

/** True during regular US equity trading hours, daylight saving included. */
export function isUsMarketOpen(at: Date): boolean {
  const { weekday, minutes } = partsOf(at);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return minutes >= OPENING_BELL_MINUTES && minutes < CLOSING_BELL_MINUTES;
}

export interface FeedReading {
  /** Raw `answer` from `latestRoundData()`, in the feed's own decimals. */
  readonly answer: bigint;
  readonly roundId: bigint;
  readonly answeredInRound: bigint;
  readonly updatedAt: Date;
  readonly heartbeatSeconds: number;
  readonly tradesAroundTheClock: boolean;
}

export function classifyFeed(reading: FeedReading, now: Date): FeedStatus {
  if (reading.answer <= 0n) return "paused";
  if (reading.answeredInRound < reading.roundId) return "stale";

  if (!reading.tradesAroundTheClock && !isUsMarketOpen(now)) {
    return "market-closed";
  }

  const ageSeconds = (now.getTime() - reading.updatedAt.getTime()) / 1000;
  return ageSeconds > reading.heartbeatSeconds ? "stale" : "live";
}

/** Whether a quote in this state may be opened or closed against. */
export function isTradeable(status: FeedStatus): boolean {
  return status === "live";
}

/** Plain-language reason a quote cannot be traded, for the interface to show. */
export function feedStatusLabel(status: FeedStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "stale":
      return "Price stale";
    case "market-closed":
      return "Market closed";
    case "paused":
      return "Feed paused";
  }
}
