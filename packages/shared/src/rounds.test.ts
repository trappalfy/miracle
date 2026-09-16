import { describe, expect, test } from "vitest";
import {
  DEAD_FEED_AFTER_SECONDS,
  aggregatorRoundOf,
  findFirstRoundAfter,
  lastRoundInPhase,
  phaseOf,
  roundIdOf,
  type RoundReader,
} from "./rounds";

/**
 * An in-memory Chainlink proxy. `phases[i]` lists the `updatedAt` of every
 * round in phase i + 1; the last phase is the current one. Like the real
 * proxy, a missing round reads as absent and an unknown phase too.
 */
function fakeFeed(phases: readonly (readonly number[])[]): RoundReader & { reads: number } {
  const feed = {
    reads: 0,
    async latestRound() {
      const phase = BigInt(phases.length);
      const rounds = phases[phases.length - 1] ?? [];
      const last = rounds.length;
      return {
        roundId: roundIdOf(phase, BigInt(last)),
        updatedAt: BigInt(rounds[last - 1] ?? 0),
      };
    },
    async getRound(roundId: bigint) {
      feed.reads++;
      const rounds = phases[Number(phaseOf(roundId)) - 1];
      const index = Number(aggregatorRoundOf(roundId)) - 1;
      const updatedAt = rounds?.[index];
      return updatedAt === undefined ? null : { roundId, updatedAt: BigInt(updatedAt) };
    },
  };
  return feed;
}

const NOW = 1_000_000n;

describe("round ids", () => {
  test("split a real proxy round id into phase and aggregator round", () => {
    // SPY on Robinhood Chain mainnet, phase 1 round 131.
    const id = 18446744073709551747n;
    expect(phaseOf(id)).toBe(1n);
    expect(aggregatorRoundOf(id)).toBe(131n);
    expect(roundIdOf(1n, 131n)).toBe(id);
  });
});

describe("findFirstRoundAfter", () => {
  test("finds the first round published after the moment", async () => {
    const feed = fakeFeed([[100, 200, 300]]);
    expect(await findFirstRoundAfter(feed, 150n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(1n, 2n) });
  });

  test("a round in the same second does not count", async () => {
    const feed = fakeFeed([[100, 200, 300]]);
    expect(await findFirstRoundAfter(feed, 200n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(1n, 3n) });
  });

  test("a moment before the feed's first round resolves to round 1", async () => {
    const feed = fakeFeed([[100, 200, 300]]);
    expect(await findFirstRoundAfter(feed, 50n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(1n, 1n) });
  });

  test("is pending while nothing has been published after the moment", async () => {
    const feed = fakeFeed([[100, 200, 300]]);
    expect(await findFirstRoundAfter(feed, 350n, 400n)).toEqual({ kind: "pending" });
  });

  test("declares the feed dead once the grace period has passed", async () => {
    const feed = fakeFeed([[100, 200, 300]]);
    expect(await findFirstRoundAfter(feed, 350n, 350n + DEAD_FEED_AFTER_SECONDS)).toEqual({
      kind: "dead-feed",
      roundId: roundIdOf(1n, 3n),
    });
    expect(await findFirstRoundAfter(feed, 350n, 349n + DEAD_FEED_AFTER_SECONDS)).toEqual({ kind: "pending" });
  });

  test("crosses into a new phase when the old one ended before the moment", async () => {
    const feed = fakeFeed([
      [100, 200],
      [400, 500],
    ]);
    expect(await findFirstRoundAfter(feed, 300n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(2n, 1n) });
  });

  test("stays in the old phase when it published after the moment", async () => {
    const feed = fakeFeed([[100, 200, 350], [400]]);
    expect(await findFirstRoundAfter(feed, 300n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(1n, 3n) });
  });

  test("skips a phase that never published", async () => {
    const feed = fakeFeed([[100, 350], [], [400]]);
    expect(await findFirstRoundAfter(feed, 300n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(1n, 2n) });
    expect(await findFirstRoundAfter(feed, 360n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(3n, 1n) });
  });

  test("searches a long history in logarithmic reads", async () => {
    const feed = fakeFeed([Array.from({ length: 5_000 }, (_, i) => (i + 1) * 10)]);
    expect(await findFirstRoundAfter(feed, 4_321n, NOW)).toEqual({ kind: "round", roundId: roundIdOf(1n, 433n) });
    expect(feed.reads).toBeLessThan(20);
  });

  test("agrees with a linear scan on random histories", async () => {
    let state = 42;
    const random = (limit: number) => {
      state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
      return state % limit;
    };

    for (let run = 0; run < 300; run++) {
      let clock = 100;
      const phases = Array.from({ length: 1 + random(4) }, () =>
        Array.from({ length: random(6) }, () => (clock += 1 + random(50))),
      );
      if (phases[phases.length - 1]!.length === 0) phases[phases.length - 1]!.push((clock += 10));

      const flat = phases.flatMap((rounds, p) => rounds.map((updatedAt, i) => ({ p, i, updatedAt })));
      const timestamp = random(clock + 20);
      const expected = flat.find((round) => round.updatedAt > timestamp);

      const hint = await findFirstRoundAfter(fakeFeed(phases), BigInt(timestamp), BigInt(clock + 30));
      if (expected) {
        expect(hint).toEqual({ kind: "round", roundId: roundIdOf(BigInt(expected.p + 1), BigInt(expected.i + 1)) });
      } else {
        expect(hint.kind).toBe("pending");
      }
    }
  });
});

describe("lastRoundInPhase", () => {
  test("counts rounds exactly across galloping boundaries", async () => {
    for (const count of [1, 2, 3, 37, 64, 65, 1_000]) {
      const feed = fakeFeed([Array.from({ length: count }, (_, i) => i + 1)]);
      expect(await lastRoundInPhase(feed, 1n)).toBe(BigInt(count));
    }
  });

  test("is zero for an empty or unknown phase", async () => {
    const feed = fakeFeed([[], [100]]);
    expect(await lastRoundInPhase(feed, 1n)).toBe(0n);
    expect(await lastRoundInPhase(feed, 7n)).toBe(0n);
  });
});
