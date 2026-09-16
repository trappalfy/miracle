import { describe, expect, test } from "vitest";
import { DEFAULT_PAYOUT_BPS, placePrizes, platformFee, seasonPlaces } from "./payouts";

/** The curve the beta season ships with: 25/18/13/10/8/7/6/5/4/4 percent. */
const TOP_TEN = DEFAULT_PAYOUT_BPS;

describe("platformFee", () => {
  test("takes its share in basis points", () => {
    expect(platformFee(1_000n, 2_000)).toBe(200n);
  });

  test("is nothing at all when the season charges nothing", () => {
    expect(platformFee(1_000n, 0)).toBe(0n);
  });
});

describe("placePrizes", () => {
  test("hands each place its slice of the curve", () => {
    expect(placePrizes(1_000n, [6_000, 3_000, 1_000], 3)).toEqual([600n, 300n, 100n]);
  });

  test("offers no place a season cannot fill", () => {
    expect(placePrizes(1_000n, TOP_TEN, 2)).toHaveLength(2);
  });

  test("has no prizes to describe before anyone enters", () => {
    expect(placePrizes(1_000n, TOP_TEN, 0)).toEqual([]);
  });
});

describe("seasonPlaces", () => {
  test("pays the curve when there are as many players as paid places", () => {
    const places = seasonPlaces([120n, 110n, 100n], [6_000, 3_000, 1_000], 1_000n);

    expect(places.map((p) => p.payout)).toEqual([600n, 300n, 100n]);
    expect(places.map((p) => p.place)).toEqual([1, 2, 3]);
  });

  test("renormalises the curve when fewer players than paid places turn up", () => {
    // Three players share the top three weights: 2500 + 1800 + 1300 = 5600.
    const places = seasonPlaces([120n, 110n, 100n], TOP_TEN, 1_000n);

    expect(places.map((p) => p.payout)).toEqual([446n, 321n, 232n]);
  });

  test("leaves unpaid places ranked but empty-handed", () => {
    const places = seasonPlaces([120n, 110n, 100n, 90n], [6_000, 4_000], 1_000n);

    expect(places.map((p) => p.payout)).toEqual([600n, 400n, 0n, 0n]);
    expect(places.map((p) => p.place)).toEqual([1, 2, 3, 4]);
  });

  test("splits the places a tie spans equally between the tied players", () => {
    // Two players tied at the top divide first and second prize.
    const places = seasonPlaces([100n, 100n, 90n, 80n], [6_000, 4_000], 1_000n);

    expect(places.map((p) => p.payout)).toEqual([500n, 500n, 0n, 0n]);
  });

  test("gives everyone in a tie the same place, and skips the ones it swallowed", () => {
    const places = seasonPlaces([100n, 90n, 90n, 90n, 80n], [5_000, 3_000, 2_000], 1_000n);

    expect(places.map((p) => p.place)).toEqual([1, 2, 2, 2, 5]);
  });

  test("a tie that runs off the end of the curve still splits what it reached", () => {
    // Places 2 and 3 are tied; only place 2 pays. They halve it.
    const places = seasonPlaces([100n, 90n, 90n], [6_000, 4_000], 1_000n);

    expect(places.map((p) => p.payout)).toEqual([600n, 200n, 200n]);
  });

  test("a single wei between two players is not a tie", () => {
    // The whole reason equities are bigint: rounded to a double these two are
    // the same number, and both players would be shown the wrong prize.
    const nearlyEqual = 100_000_000_000_000_000_000_000n;
    const places = seasonPlaces(
      [nearlyEqual + 1n, nearlyEqual],
      [6_000, 4_000],
      1_000n,
    );

    expect(places.map((p) => p.place)).toEqual([1, 2]);
    expect(places.map((p) => p.payout)).toEqual([600n, 400n]);
  });

  test("never hands out more than there is to give", () => {
    const distributable = 1_000n;
    const places = seasonPlaces([9n, 8n, 7n, 6n, 5n, 4n, 3n], TOP_TEN, distributable);
    const paid = places.reduce((total, place) => total + place.payout, 0n);

    expect(paid).toBeLessThanOrEqual(distributable);
  });

  test("has nothing to say about a season nobody entered", () => {
    expect(seasonPlaces([], TOP_TEN, 1_000n)).toEqual([]);
  });

  test("pays the only player the whole pool", () => {
    expect(seasonPlaces([100n], TOP_TEN, 1_000n)).toEqual([
      { place: 1, payout: 1_000n },
    ]);
  });
});
