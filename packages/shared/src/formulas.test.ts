import { describe, expect, test } from "vitest";
import { ASSETS, ASSET_SYMBOLS } from "./assets";
import {
  aumCapacity,
  isCapitalAdequate,
  leverageFromScore,
  positionPnl,
  riskWeightedAum,
} from "./formulas";

describe("leverageFromScore", () => {
  test("a player with no score gets the 3x floor", () => {
    expect(leverageFromScore(0)).toBe(3);
  });

  test("a perfect score gets the 10x ceiling", () => {
    expect(leverageFromScore(100)).toBe(10);
  });

  test("scales linearly between the floor and the ceiling", () => {
    expect(leverageFromScore(50)).toBeCloseTo(6.5, 10);
  });

  test("clamps scores outside 0..100 instead of returning absurd leverage", () => {
    expect(leverageFromScore(-25)).toBe(3);
    expect(leverageFromScore(140)).toBe(10);
  });
});

describe("riskWeightedAum", () => {
  test("a player with no positions carries no risk", () => {
    expect(riskWeightedAum([])).toBe(0);
  });

  test("weights each position by its asset risk factor", () => {
    // SPY 1.0x, BTC 2.0x, MSTR 2.5x
    const positions = [
      { symbol: "SPY", notional: 5000 },
      { symbol: "BTC", notional: 46 },
      { symbol: "MSTR", notional: 100 },
    ];
    expect(riskWeightedAum(positions)).toBeCloseTo(5000 + 92 + 250, 10);
  });

  test("treasuries count for far less than their notional", () => {
    expect(riskWeightedAum([{ symbol: "SGOV", notional: 1000 }])).toBeCloseTo(500, 10);
  });

  test("every listed asset has a Chainlink feed behind it", () => {
    // Guards against listing an asset we cannot actually price — the exact
    // failure that leaves a competitor quoting a hardcoded constant.
    for (const symbol of ASSET_SYMBOLS) {
      expect(ASSETS[symbol].feed, `${symbol} has no feed address`).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  test("rejects an unknown ticker rather than silently weighting it at zero", () => {
    expect(() => riskWeightedAum([{ symbol: "DOGE", notional: 100 }])).toThrow(/DOGE/);
  });
});

describe("aumCapacity", () => {
  test("capacity is capital multiplied by leverage", () => {
    expect(aumCapacity(100_000, 7.17)).toBeCloseTo(717_000, 6);
  });

  test("no capital means no capacity", () => {
    expect(aumCapacity(0, 10)).toBe(0);
  });
});

describe("positionPnl", () => {
  test("a long gains proportionally when price rises", () => {
    // +10% on a 1000 notional long
    expect(positionPnl({ side: "long", notional: 1000, entryPrice: 100 }, 110)).toBeCloseTo(100, 10);
  });

  test("a long loses proportionally when price falls", () => {
    expect(positionPnl({ side: "long", notional: 1000, entryPrice: 100 }, 90)).toBeCloseTo(-100, 10);
  });

  test("a short mirrors the long", () => {
    expect(positionPnl({ side: "short", notional: 1000, entryPrice: 100 }, 90)).toBeCloseTo(100, 10);
    expect(positionPnl({ side: "short", notional: 1000, entryPrice: 100 }, 110)).toBeCloseTo(-100, 10);
  });

  test("an unmoved price produces exactly zero, not float dust", () => {
    expect(positionPnl({ side: "long", notional: 1234.56, entryPrice: 764.29 }, 764.29)).toBe(0);
  });

  test("refuses a zero entry price instead of returning Infinity", () => {
    expect(() => positionPnl({ side: "long", notional: 100, entryPrice: 0 }, 50)).toThrow();
  });
});

describe("isCapitalAdequate", () => {
  test("risk below capacity is adequate", () => {
    expect(isCapitalAdequate(5_000, 358_500)).toBe(true);
  });

  test("risk above capacity is not adequate", () => {
    expect(isCapitalAdequate(400_000, 358_500)).toBe(false);
  });

  test("sitting exactly at capacity still counts as adequate", () => {
    expect(isCapitalAdequate(358_500, 358_500)).toBe(true);
  });
});
