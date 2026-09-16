import type { AssetSymbol } from "./assets";
import type { PositionSide } from "./formulas";

/**
 * The boundary between the web app and the contracts.
 *
 * Both sides code against these shapes. The UI never touches a contract
 * directly — it goes through an adapter implementing `MiracleAdapter`, of
 * which there are two: a mock (in memory, on live Chainlink prices) and the
 * real one (viem + ABIs). Swapping them is an env var.
 *
 * Amounts that the chain stores as integers are exposed here as `bigint` in
 * their raw on-chain units. Amounts that only exist for display are `number`.
 * Never round a bigint into a number before doing math on it.
 */

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

/** Where a season is in its lifecycle. Drives most of the UI's empty states. */
export type SeasonPhase =
  | "upcoming" // created, entry not open yet
  | "entry" // accepting entries, trading not started
  | "live" // trading
  | "settling" // trading closed, ranking not yet submitted
  | "settled"; // ranking accepted, payouts claimable

export interface SeasonState {
  readonly id: number;
  readonly phase: SeasonPhase;
  /** Entry fee in wei. */
  readonly entryFee: bigint;
  /** Accumulated prize pool in wei. */
  readonly prizePool: bigint;
  /** Virtual trading capital each player starts with, in display units. */
  readonly startingCapital: number;
  readonly participants: number;
  /** Entry is refused past this many players, which caps what a season can lose. */
  readonly maxParticipants: number;
  /** Platform cut of the pool, in basis points. Zero on the beta season. */
  readonly feeBps: number;
  /**
   * Prize weights by place, in basis points, summing to 10 000. Every season
   * carries its own, so the interface reads the curve rather than assuming one.
   */
  readonly payoutBps: readonly number[];
  readonly entryOpensAt: Date;
  readonly entryClosesAt: Date;
  readonly tradingStartsAt: Date;
  readonly tradingEndsAt: Date;
}

/**
 * Closing is two steps, so a position has three states rather than two.
 *
 * `closing` is a real state a player will sit in and watch: the close is
 * recorded but the exit round has not been published yet, and on a slow feed
 * that can be most of a day. It still occupies risk capacity while it waits.
 */
export type PositionStatus = "open" | "closing" | "settled";

export interface Position {
  readonly id: string;
  readonly symbol: AssetSymbol;
  readonly side: PositionSide;
  readonly status: PositionStatus;
  readonly notional: number;
  /**
   * Resolved from the first oracle round after the open transaction landed,
   * never from the price shown on screen — see the anti-latency-arbitrage
   * rule. Null while the entry round has not been resolved yet.
   */
  readonly entryPrice: number | null;
  readonly entryRoundId: bigint | null;
  readonly openedAt: Date;
  /**
   * When the player asked to close. Null while open, and for positions that
   * ran to the end of trading — those exit against `tradingEndsAt` instead.
   */
  readonly closedAt: Date | null;
  /** Known only once settled, from the first round after the exit moment. */
  readonly exitPrice: number | null;
  readonly exitRoundId: bigint | null;
  /** Realised result. Null until settled; zero if the position was voided. */
  readonly pnl: number | null;
  /**
   * The feed went silent for a week, so the position settles at zero rather
   * than at a guessed price. Nothing the player did causes this.
   */
  readonly voided: boolean;
}

export interface PlayerState {
  readonly address: Address;
  readonly seasonId: number;
  /** Virtual capital, equal for every player at season start. */
  readonly capital: number;
  readonly positions: readonly Position[];
  /** Score carried from past seasons; the only thing that differs between players at the start. */
  readonly score: number;
  readonly realisedPnl: number;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly address: Address;
  /**
   * Equity in WAD, exactly as `equityOf` returns it.
   *
   * This one is `bigint` and not a display number because the contract decides
   * a tie by comparing two `uint256` for equality, and tied players split the
   * prizes of the places they span. Two equities that differ on-chain can
   * round to the same double, which would invent a tie the contract will not
   * honour and quote both players the wrong prize.
   */
  readonly equity: bigint;
  readonly score: number;
}

/**
 * Why a price may not be usable right now.
 *
 * Equity feeds run 24/5 and hold their last value outside market hours with
 * no heartbeat, so "the number is positive" is never enough to trade on.
 */
export type FeedStatus = "live" | "stale" | "market-closed" | "paused";

export interface PriceQuote {
  readonly symbol: AssetSymbol;
  readonly price: number;
  readonly roundId: bigint;
  readonly updatedAt: Date;
  readonly status: FeedStatus;
}

export interface OpenPositionInput {
  readonly symbol: AssetSymbol;
  readonly side: PositionSide;
  readonly notional: number;
}

/**
 * A position whose entry and exit rounds have both been found, so it can be
 * settled now.
 *
 * Settling is what turns a closed position into a realised result and gives
 * the player their capacity back. Anyone may do it, and the contract checks
 * the hints rather than trusting them, so there is nothing to gain by being
 * the one who submits — which is why the player can do it for themselves
 * instead of waiting for a keeper to come round.
 */
export interface SettlementHint {
  readonly positionId: string;
  readonly entryRoundId: bigint;
  readonly exitRoundId: bigint;
}

/** A submitted transaction. `confirmed` resolves when the chain accepts it. */
export interface TxResult {
  readonly hash: Hash;
  readonly confirmed: Promise<void>;
}

export interface MiracleAdapter {
  getCurrentSeason(): Promise<SeasonState | null>;
  getSeason(seasonId: number): Promise<SeasonState | null>;
  getPlayer(seasonId: number, address: Address): Promise<PlayerState | null>;
  getLeaderboard(seasonId: number, limit?: number): Promise<readonly LeaderboardEntry[]>;
  /** Payout owed to this address for a settled season, in wei. Zero if none. */
  getClaimable(seasonId: number, address: Address): Promise<bigint>;

  /**
   * Which of this player's positions can be settled right now, with the round
   * hints the contract needs. Empty while the oracle has not published a round
   * past the moment a position needs.
   */
  getSettlements(
    seasonId: number,
    address: Address,
  ): Promise<readonly SettlementHint[]>;

  joinSeason(seasonId: number): Promise<TxResult>;
  openPosition(seasonId: number, input: OpenPositionInput): Promise<TxResult>;
  closePosition(seasonId: number, positionId: string): Promise<TxResult>;
  /** Books the results of positions whose rounds are known. Anyone may call it. */
  settlePositions(
    seasonId: number,
    address: Address,
    hints: readonly SettlementHint[],
  ): Promise<TxResult>;
  claimPayout(seasonId: number): Promise<TxResult>;
}
