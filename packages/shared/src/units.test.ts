import { describe, expect, test } from "vitest";
import { WAD, fromWad, toWad } from "./units";

describe("toWad", () => {
  test("scales a whole number by 1e18", () => {
    expect(toWad(1)).toBe(WAD);
    expect(toWad(100_000)).toBe(100_000n * WAD);
  });

  test("keeps the fractional part", () => {
    expect(toWad(0.5)).toBe(WAD / 2n);
    expect(toWad(1.25)).toBe(WAD + WAD / 4n);
  });

  test("does not let binary floating point leak into the integer", () => {
    // 0.1 is not exactly representable; multiplying by 1e18 in floating point
    // gives 100000000000000005 or similar. Money must not do that.
    expect(toWad(0.1)).toBe(100_000_000_000_000_000n);
    expect(toWad(0.3)).toBe(300_000_000_000_000_000n);
  });

  test("carries the sign, because a loss is a negative number", () => {
    expect(toWad(-2.5)).toBe(-(WAD * 5n) / 2n);
  });

  test("handles the exponent notation JavaScript switches to on its own", () => {
    // Below 1e-6 and at or above 1e21, `toString` gives "1e-7" and "1e+21".
    expect(toWad(1e-7)).toBe(100_000_000_000n);
    expect(toWad(1e21)).toBe(10n ** 39n);
  });

  test("rounds rather than truncates below the last representable place", () => {
    // 19 decimal places: the last one cannot be held and must round, not vanish.
    expect(toWad(1.0000000000000000009)).toBe(WAD);
    expect(toWad(1.5e-18)).toBe(2n);
  });

  test("is zero at zero", () => {
    expect(toWad(0)).toBe(0n);
  });
});

describe("fromWad", () => {
  test("turns a scaled integer back into a number", () => {
    expect(fromWad(WAD)).toBe(1);
    expect(fromWad(100_000n * WAD)).toBe(100_000);
  });

  test("keeps the fractional part", () => {
    expect(fromWad(WAD / 2n)).toBe(0.5);
  });

  test("carries the sign", () => {
    expect(fromWad(-WAD)).toBe(-1);
  });

  test("stays accurate on sums far larger than a season's capital", () => {
    // Number(bigint) alone loses precision past 2^53; splitting the whole part
    // from the fraction keeps the dollars exact.
    expect(fromWad(1_000_000_000n * WAD)).toBe(1_000_000_000);
  });

  test("survives a round trip", () => {
    expect(fromWad(toWad(12_345.67))).toBeCloseTo(12_345.67, 10);
  });
});
