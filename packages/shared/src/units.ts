/**
 * Fixed-point conversion between the chain's units and display numbers.
 *
 * The contract holds capital, notional, equity, profit and loss and prices as
 * WAD — integers scaled by 1e18. The interface shows them as numbers. These
 * two functions are the only place that crossing happens, so the rounding
 * behaviour is written down once and tested rather than improvised at each
 * call site.
 *
 * Neither direction is safe to use on money that will be compared for equality
 * or summed into a payout: do that arithmetic in `bigint`, and convert only to
 * put a figure on the screen.
 */

/** One whole unit, scaled. */
export const WAD = 10n ** 18n;

const WAD_DECIMALS = 18;

/**
 * Number to WAD, by shifting the decimal point rather than by multiplying.
 *
 * `0.1 * 1e18` is 100000000000000005 in binary floating point, and asking for
 * `toFixed(18)` only exposes the same thing. `toString` gives the shortest
 * decimal that reads back as this exact double — which is the number the
 * player was shown — and the point is moved on the digits themselves.
 */
export function toWad(value: number): bigint {
  if (!Number.isFinite(value)) throw new Error(`Cannot scale ${value} to WAD`);

  const text = value.toString();
  const negative = text.startsWith("-");

  const [mantissa = "0", exponentText] = (negative ? text.slice(1) : text).split("e");
  const [whole = "0", fraction = ""] = mantissa.split(".");
  const digits = BigInt(whole + fraction);

  // value = digits × 10^(exponent − fraction.length), and we want it × 10^18.
  const shift = WAD_DECIMALS + Number(exponentText ?? 0) - fraction.length;

  let magnitude: bigint;
  if (shift >= 0) {
    magnitude = digits * 10n ** BigInt(shift);
  } else {
    // More precision than WAD can hold: round half up rather than drop it.
    const divisor = 10n ** BigInt(-shift);
    const remainder = digits % divisor;
    magnitude = digits / divisor + (remainder * 2n >= divisor ? 1n : 0n);
  }

  return negative ? -magnitude : magnitude;
}

/**
 * WAD to number, splitting the whole part from the fraction.
 *
 * `Number(value) / 1e18` loses dollars once the integer passes 2^53, which a
 * prize pool in wei does easily.
 */
export function fromWad(value: bigint): number {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;

  const result = Number(magnitude / WAD) + Number(magnitude % WAD) / 1e18;
  return negative ? -result : result;
}
