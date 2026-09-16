/**
 * Finding the oracle round a position settles against.
 *
 * The contract never prices a position at "now". Entry is the first Chainlink
 * round published after the position was opened; exit is the first round after
 * it was closed, or after trading ended for positions still open. Settling a
 * position means handing the contract those two round ids as hints — it checks
 * them, it does not search. This module does the searching.
 *
 * Round ids from a Chainlink proxy are `(phaseId << 64) | aggregatorRound`.
 * Aggregator rounds start at 1 and are contiguous within a phase, and the round
 * before the first one of a phase lives at the end of the previous phase — so
 * a search that runs off the front of a phase has to keep walking back.
 *
 * Mirrors `ChainlinkLib.resolveFirstRoundAfter` in packages/contracts: if this
 * returns a round, the contract accepts it.
 */

export const PHASE_OFFSET = 64n;
const AGGREGATOR_ROUND_MASK = (1n << PHASE_OFFSET) - 1n;

/** After this long with no round past a moment, the contract voids positions that depend on it. */
export const DEAD_FEED_AFTER_SECONDS = 604_800n;

export interface RoundReading {
  readonly roundId: bigint;
  /** Unix seconds. */
  readonly updatedAt: bigint;
}

/**
 * Read access to one Chainlink proxy.
 *
 * Implement `getRound` over `getRoundData`, returning null both when the call
 * reverts (unknown phase) and when it returns an empty round (`updatedAt` 0 —
 * what the proxy does for a round past the end of a known phase).
 */
export interface RoundReader {
  latestRound(): Promise<RoundReading>;
  getRound(roundId: bigint): Promise<RoundReading | null>;
}

export type RoundHint =
  /** Pass this round id to the contract. */
  | { readonly kind: "round"; readonly roundId: bigint }
  /** The feed has gone silent past the grace period; the contract voids the position when given this latest round id. */
  | { readonly kind: "dead-feed"; readonly roundId: bigint }
  /** No round has been published after the moment yet. Try again later. */
  | { readonly kind: "pending" };

export function roundIdOf(phase: bigint, aggregatorRound: bigint): bigint {
  return (phase << PHASE_OFFSET) | aggregatorRound;
}

export function phaseOf(roundId: bigint): bigint {
  return roundId >> PHASE_OFFSET;
}

export function aggregatorRoundOf(roundId: bigint): bigint {
  return roundId & AGGREGATOR_ROUND_MASK;
}

/**
 * The first round published strictly after `timestamp` (unix seconds).
 * `now` decides whether a silent feed is merely pending or dead.
 */
export async function findFirstRoundAfter(
  reader: RoundReader,
  timestamp: bigint,
  now: bigint,
): Promise<RoundHint> {
  const latest = await reader.latestRound();
  if (latest.updatedAt <= timestamp) {
    return now >= timestamp + DEAD_FEED_AFTER_SECONDS
      ? { kind: "dead-feed", roundId: latest.roundId }
      : { kind: "pending" };
  }

  let phase = phaseOf(latest.roundId);
  let candidate = roundIdOf(
    phase,
    await firstInPhaseAfter(reader, phase, aggregatorRoundOf(latest.roundId), timestamp),
  );

  // Landing on round 1 means the answer may sit at the end of an earlier phase.
  while (aggregatorRoundOf(candidate) === 1n && phase > 1n) {
    phase -= 1n;
    const last = await lastRoundInPhase(reader, phase);
    if (last === 0n) continue;

    const lastRound = await reader.getRound(roundIdOf(phase, last));
    if (!lastRound || lastRound.updatedAt <= timestamp) break;

    candidate = roundIdOf(phase, await firstInPhaseAfter(reader, phase, last, timestamp));
  }

  return { kind: "round", roundId: candidate };
}

/** Last aggregator round of `phase`, or 0 if it has none. O(log n) reads. */
export async function lastRoundInPhase(reader: RoundReader, phase: bigint): Promise<bigint> {
  const exists = async (aggregatorRound: bigint) =>
    (await reader.getRound(roundIdOf(phase, aggregatorRound))) !== null;

  if (!(await exists(1n))) return 0n;

  let lo = 1n;
  let hi = 2n;
  while (await exists(hi)) {
    lo = hi;
    hi <<= 1n;
  }
  while (hi - lo > 1n) {
    const mid = lo + (hi - lo) / 2n;
    if (await exists(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Smallest aggregator round in `phase` published after `timestamp`, given that round `last` is. */
async function firstInPhaseAfter(
  reader: RoundReader,
  phase: bigint,
  last: bigint,
  timestamp: bigint,
): Promise<bigint> {
  let lo = 1n;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const round = await reader.getRound(roundIdOf(phase, mid));
    if (round && round.updatedAt > timestamp) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}
