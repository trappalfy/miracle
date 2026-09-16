/**
 * How a season's prize pool is divided, mirroring `_distribute` in
 * `MiracleGame.sol` exactly.
 *
 * The interface needs these numbers before the chain has them: to show what a
 * place is worth while a season is still running, and to explain the split on
 * the rules page without anyone retyping percentages that could drift from the
 * season actually deployed. Every season carries its own curve, so nothing
 * here is hardcoded except the default the beta ships with.
 *
 * Money is `bigint` wei throughout and divides the way Solidity divides —
 * truncating — so these figures match the contract to the last wei rather than
 * merely being close.
 *
 * Equities are `bigint` WAD for the same reason. The contract decides a tie by
 * comparing two `uint256` exactly; two equities that differ on-chain can land
 * on the same `number` once rounded, which would invent a tie here that the
 * contract will not honour and show the wrong prize to both players.
 */

/** Basis points: 10 000 = 100%. */
export const BPS = 10_000;

/** The beta season's curve: 25/18/13/10/8/7/6/5/4/4 percent of the pool. */
export const DEFAULT_PAYOUT_BPS: readonly number[] = [
  2_500, 1_800, 1_300, 1_000, 800, 700, 600, 500, 400, 400,
];

export interface RankedPlace {
  /** 1-based place. Tied players share the first place of their group. */
  readonly place: number;
  /** Payout in wei. Zero for places the curve does not reach. */
  readonly payout: bigint;
}

/** The platform's cut, taken off the top before anything is distributed. */
export function platformFee(prizePool: bigint, feeBps: number): bigint {
  return (prizePool * BigInt(feeBps)) / BigInt(BPS);
}

/**
 * The prize attached to each paid place. With fewer players than paid places
 * the curve is renormalised over the places that exist, so a thin season still
 * pays out its whole pool.
 */
export function placePrizes(
  distributable: bigint,
  payoutBps: readonly number[],
  players: number,
): bigint[] {
  const curve = payoutBps.slice(0, Math.max(0, players));
  let totalBps = 0n;
  for (const bps of curve) totalBps += BigInt(bps);
  if (totalBps === 0n) return [];

  return curve.map((bps) => (distributable * BigInt(bps)) / totalBps);
}

/**
 * Place and payout for every player, given the ranking in order and the
 * equities it was sorted by.
 *
 * Players on equal equity form a group that pools the prizes of the places it
 * spans and splits them evenly, which is what makes the ranking safe to let
 * anyone submit: the order chosen inside a tie changes nobody's money.
 */
export function seasonPlaces(
  rankedEquities: readonly bigint[],
  payoutBps: readonly number[],
  distributable: bigint,
): RankedPlace[] {
  const n = rankedEquities.length;
  if (n === 0) return [];

  const prizes = placePrizes(distributable, payoutBps, n);
  const result: RankedPlace[] = [];

  let groupStart = 0;
  for (let i = 0; i < n; i += 1) {
    if (i + 1 < n && rankedEquities[i + 1] === rankedEquities[i]) continue;

    const groupEnd = i + 1;
    let groupPrize = 0n;
    for (const prize of prizes.slice(groupStart, groupEnd)) groupPrize += prize;
    const each = groupPrize / BigInt(groupEnd - groupStart);

    for (let j = groupStart; j < groupEnd; j += 1) {
      result.push({ place: groupStart + 1, payout: each });
    }
    groupStart = groupEnd;
  }

  return result;
}
