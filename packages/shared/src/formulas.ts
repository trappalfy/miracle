import { riskWeightOf } from "./assets";

/**
 * Season economics.
 *
 * Every player starts a season with the same virtual capital, so placement is
 * decided by trading, not by wallet size. Leverage is the one thing that
 * carries over: it is earned from the score of past seasons.
 *
 * These formulas mirror the contract. The contract is authoritative — use the
 * values it returns wherever you have them, and use these only to preview a
 * trade before it is signed.
 */
export const MIN_LEVERAGE = 3;
export const MAX_LEVERAGE = 10;
export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

/** Leverage gained per point of score: spans MIN_LEVERAGE..MAX_LEVERAGE across the score range. */
export const LEVERAGE_PER_SCORE_POINT =
  (MAX_LEVERAGE - MIN_LEVERAGE) / (MAX_SCORE - MIN_SCORE);

export type PositionSide = "long" | "short";

export interface WeightedPosition {
  readonly symbol: string;
  readonly notional: number;
}

export interface PricedPosition {
  readonly side: PositionSide;
  readonly notional: number;
  readonly entryPrice: number;
}

export function leverageFromScore(score: number): number {
  const clamped = Math.min(MAX_SCORE, Math.max(MIN_SCORE, score));
  return MIN_LEVERAGE + clamped * LEVERAGE_PER_SCORE_POINT;
}

export function riskWeightedAum(positions: readonly WeightedPosition[]): number {
  let total = 0;
  for (const position of positions) {
    total += position.notional * riskWeightOf(position.symbol);
  }
  return total;
}

export function aumCapacity(capital: number, leverage: number): number {
  return capital * leverage;
}

export function positionPnl(position: PricedPosition, currentPrice: number): number {
  if (!(position.entryPrice > 0)) {
    throw new Error(`Entry price must be positive, got ${position.entryPrice}`);
  }
  if (currentPrice === position.entryPrice) return 0;

  const move = currentPrice / position.entryPrice - 1;
  const pnl = position.notional * move;
  return position.side === "short" ? -pnl : pnl;
}

export function isCapitalAdequate(riskWeighted: number, capacity: number): boolean {
  return riskWeighted <= capacity;
}
