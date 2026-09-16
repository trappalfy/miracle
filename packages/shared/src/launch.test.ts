import { describe, expect, test } from "vitest";
import { FIRST_SEASON, announcedSchedule } from "./launch";

describe("announcedSchedule", () => {
  test("has no dates to show before the opening is announced", () => {
    expect(announcedSchedule({ ...FIRST_SEASON, opensAt: null })).toBeNull();
  });

  test("runs three days of entry, then fourteen days of trading", () => {
    const schedule = announcedSchedule({ ...FIRST_SEASON, opensAt: new Date("2026-10-01T12:00:00Z") });

    expect(schedule).toEqual({
      entryOpensAt: new Date("2026-10-01T12:00:00Z"),
      tradingStartsAt: new Date("2026-10-04T12:00:00Z"),
      tradingEndsAt: new Date("2026-10-18T12:00:00Z"),
    });
  });
});

describe("FIRST_SEASON", () => {
  test("carries the announced terms", () => {
    expect(FIRST_SEASON.entryFee).toBe(10n ** 16n); // 0.01 ETH
    expect(FIRST_SEASON.maxParticipants).toBe(100);
    expect(FIRST_SEASON.feeBps).toBe(0);
    expect(FIRST_SEASON.payoutBps.reduce((sum, bps) => sum + bps, 0)).toBe(10_000);
  });
});
