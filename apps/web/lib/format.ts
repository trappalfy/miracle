/** Display helpers. Money is formatted for reading, never for arithmetic. */

import { fromWad } from "@miracle/shared";

export function usd(value: number, fractionDigits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function signedUsd(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}$${usd(Math.abs(value))}`;
}

/**
 * The same, for money the chain holds as WAD. Converting happens here, at the
 * point of display, so the exact integer survives every comparison before it.
 */
export function wadUsd(value: bigint, fractionDigits = 2): string {
  return usd(fromWad(value), fractionDigits);
}

export function signedWadUsd(value: bigint): string {
  return signedUsd(fromWad(value));
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * How long is left, in the coarsest unit that still says something useful.
 * Deadlines here are days away, so seconds would be noise.
 */
export function timeLeft(deadline: Date, now: Date = new Date()): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "closed";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  return `${minutes}m left`;
}

/** A date written out in full, for deadlines people may want to diarise. */
export function fullDate(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Wei to ETH, for entry fees and prize pools. */
export function eth(wei: bigint, fractionDigits = 3): string {
  const whole = Number(wei) / 1e18;
  return whole.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
