import {
  ASSETS,
  ASSET_SYMBOLS,
  classifyFeed,
  type AssetSymbol,
  type PriceQuote,
} from "@miracle/shared";
import { publicClient } from "@/lib/chain/client";

/**
 * Reading prices straight from Chainlink.
 *
 * This runs in the visitor's browser against the chain, with no server of ours
 * in between — which is the whole claim the product makes. We never hold a
 * price, so we could not alter one.
 */

export const AGGREGATOR_V3_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export class PriceFeedUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      "Could not reach the price feeds. The public Robinhood Chain RPC is rate limited — set NEXT_PUBLIC_RPC_URL to an Alchemy endpoint.",
    );
    this.name = "PriceFeedUnavailableError";
    this.cause = cause;
  }
}

function toQuote(
  symbol: AssetSymbol,
  round: readonly [bigint, bigint, bigint, bigint, bigint],
  now: Date,
): PriceQuote {
  const spec = ASSETS[symbol];
  const [roundId, answer, , updatedAtSeconds, answeredInRound] = round;
  const updatedAt = new Date(Number(updatedAtSeconds) * 1000);

  return {
    symbol,
    price: Number(answer) / 10 ** spec.decimals,
    roundId,
    updatedAt,
    status: classifyFeed(
      {
        answer,
        roundId,
        answeredInRound,
        updatedAt,
        heartbeatSeconds: spec.heartbeatSeconds,
        tradesAroundTheClock: spec.tradesAroundTheClock,
      },
      now,
    ),
  };
}

/**
 * Reads every listed feed in one batched JSON-RPC request.
 * Throws PriceFeedUnavailableError if the chain cannot be reached at all —
 * the caller is expected to show that state rather than invent numbers.
 */
export async function readAllPrices(now: Date = new Date()): Promise<PriceQuote[]> {
  try {
    const rounds = await Promise.all(
      ASSET_SYMBOLS.map((symbol) =>
        publicClient.readContract({
          address: ASSETS[symbol].feed,
          abi: AGGREGATOR_V3_ABI,
          functionName: "latestRoundData",
        }),
      ),
    );

    return ASSET_SYMBOLS.map((symbol, index) =>
      toQuote(symbol, rounds[index]!, now),
    );
  } catch (cause) {
    throw new PriceFeedUnavailableError(cause);
  }
}
