import { describe, expect, test } from "vitest";
import { classifyFeed, isUsMarketOpen } from "./feeds";

// 2026-09-16T18:00Z is Wednesday 14:00 EDT; 2026-09-19T18:00Z is Saturday.
const WED_MIDDAY = new Date("2026-09-16T18:00:00Z");
const SATURDAY = new Date("2026-09-19T18:00:00Z");

describe("isUsMarketOpen", () => {
  test("midday on a weekday is open", () => {
    expect(isUsMarketOpen(WED_MIDDAY)).toBe(true);
  });

  test("weekends are closed", () => {
    expect(isUsMarketOpen(SATURDAY)).toBe(false);
  });

  test("before the opening bell is closed", () => {
    // 09:29 EDT
    expect(isUsMarketOpen(new Date("2026-09-16T13:29:00Z"))).toBe(false);
  });

  test("the opening bell itself is open", () => {
    // 09:30 EDT
    expect(isUsMarketOpen(new Date("2026-09-16T13:30:00Z"))).toBe(true);
  });

  test("the closing bell ends the session", () => {
    // 16:00 EDT
    expect(isUsMarketOpen(new Date("2026-09-16T20:00:00Z"))).toBe(false);
  });

  test("follows New York across daylight saving, not a fixed offset", () => {
    // January: 14:00 EST is 19:00Z. A fixed summer offset would place this
    // an hour out and misjudge the session near the bells.
    expect(isUsMarketOpen(new Date("2026-01-14T19:00:00Z"))).toBe(true);
    // 09:00 EST — still shut.
    expect(isUsMarketOpen(new Date("2026-01-14T14:00:00Z"))).toBe(false);
  });
});

const HEARTBEAT = 86_400;

function feed(overrides: Partial<Parameters<typeof classifyFeed>[0]> = {}) {
  return {
    answer: 100_00000000n,
    roundId: 42n,
    answeredInRound: 42n,
    updatedAt: new Date(WED_MIDDAY.getTime() - 60_000),
    heartbeatSeconds: HEARTBEAT,
    tradesAroundTheClock: false,
    ...overrides,
  };
}

describe("classifyFeed", () => {
  test("a recent round during market hours is live", () => {
    expect(classifyFeed(feed(), WED_MIDDAY)).toBe("live");
  });

  test("a non-positive answer means the feed is not usable", () => {
    expect(classifyFeed(feed({ answer: 0n }), WED_MIDDAY)).toBe("paused");
  });

  test("an unanswered round is stale, however recent it looks", () => {
    expect(classifyFeed(feed({ roundId: 43n, answeredInRound: 42n }), WED_MIDDAY)).toBe(
      "stale",
    );
  });

  test("an equity feed on a Saturday reports the market as closed, not merely stale", () => {
    // The price is only minutes old, but nothing can be traded against it.
    const justUpdated = new Date(SATURDAY.getTime() - 60_000);
    expect(classifyFeed(feed({ updatedAt: justUpdated }), SATURDAY)).toBe("market-closed");
  });

  test("crypto keeps trading at the weekend", () => {
    const justUpdated = new Date(SATURDAY.getTime() - 60_000);
    expect(
      classifyFeed(
        feed({ updatedAt: justUpdated, tradesAroundTheClock: true }),
        SATURDAY,
      ),
    ).toBe("live");
  });

  test("a price older than the heartbeat is stale even while the market is open", () => {
    const ancient = new Date(WED_MIDDAY.getTime() - (HEARTBEAT + 60) * 1000);
    expect(classifyFeed(feed({ updatedAt: ancient }), WED_MIDDAY)).toBe("stale");
  });

  test("crypto that has gone quiet past its heartbeat is stale", () => {
    const ancient = new Date(SATURDAY.getTime() - (HEARTBEAT + 60) * 1000);
    expect(
      classifyFeed(feed({ updatedAt: ancient, tradesAroundTheClock: true }), SATURDAY),
    ).toBe("stale");
  });
});
