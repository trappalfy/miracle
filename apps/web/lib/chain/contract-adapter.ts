import {
  BaseError,
  ContractFunctionRevertedError,
  hexToString,
  stringToHex,
  type Address,
  type Hash,
  type WalletClient,
} from "viem";
import {
  findFirstRoundAfter,
  fromWad,
  isAssetSymbol,
  miracleGameAbi,
  toWad,
  type AssetSymbol,
  type RoundReader,
  type RoundReading,
  type SettlementHint,
  type LeaderboardEntry,
  type MiracleAdapter,
  type OpenPositionInput,
  type PlayerState,
  type Position,
  type PositionStatus,
  type SeasonPhase,
  type SeasonState,
  type TxResult,
} from "@miracle/shared";
import { publicClient } from "./client";
import {
  ensureChain,
  requestAccounts,
  silentAccounts,
  walletClientFor,
} from "./wallet";

/**
 * The real thing: `MiracleAdapter` over the deployed MiracleGame contract.
 *
 * Every number on screen is read from the chain by the visitor's own browser.
 * Nothing is cached on a server of ours, because there is no server of ours.
 *
 * Money crosses into display units exactly once, here at the boundary — the
 * contract's WAD integers stay integers wherever they are compared or ranked.
 */

const AGGREGATOR_ABI = [
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
  {
    name: "getRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint80" }],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

/** One transaction settles at most this many positions. */
const SETTLE_BATCH = 50;

/** The contract's `Phase` enum, in its own order. */
const PHASES: readonly SeasonPhase[] = [
  "upcoming",
  "entry",
  "live",
  "settling",
  "settled",
];

const POSITION_STATUSES: readonly PositionStatus[] = ["open", "closing", "settled"];

/** Participants come back in pages; the season cap is 100, so one page does it. */
const PARTICIPANT_PAGE = 200;

function toDate(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}

function symbolToBytes32(symbol: string): `0x${string}` {
  return stringToHex(symbol, { size: 32 });
}

function bytes32ToSymbol(value: `0x${string}`): string {
  return hexToString(value, { size: 32 }).replace(/\0+$/, "");
}

/**
 * Turns a revert into something a player can act on.
 *
 * The ABI carries the contract's own errors, so a refusal can say which rule
 * was broken instead of showing a hex selector.
 */
export function describeContractError(error: unknown): string {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      const messages: Record<string, string> = {
        AlreadyJoined: "You are already in this season.",
        CapitalInadequate: "That position is larger than your remaining capacity.",
        SeasonFull: "The season is full.",
        WrongEntryFee: "The entry fee sent did not match the season's fee.",
        WrongPhase: "The season is not in a phase that allows this.",
        NotParticipant: "You are not in this season.",
        NothingToClaim: "There is nothing to claim.",
        TooManyUnsettledPositions:
          "You have twenty positions waiting to settle. Wait for some to settle before opening another.",
        PositionNotOpen: "That position is already closing or settled.",
        PositionNotFound: "That position does not exist.",
        AssetNotListed: "That asset is not listed in this season.",
        ZeroNotional: "Enter an amount above zero.",
        SeasonNotFound: "That season does not exist.",
        TransferFailed: "The payout transfer failed.",
      };
      if (name && messages[name]) return messages[name];
      if (name) return `The contract refused this: ${name}.`;
    }
    return error.shortMessage || error.message;
  }
  return error instanceof Error ? error.message : "The transaction failed.";
}

export class ContractAdapter implements MiracleAdapter {
  readonly kind = "chain" as const;

  private wallet: WalletClient | null = null;
  private account: Address | null = null;

  /** Listed feeds, read once. A symbol's feed cannot change mid-season. */
  private feeds: Map<string, Address> | null = null;

  /** Published rounds never change, so they are cached for the whole session. */
  private rounds = new Map<string, RoundReading | null>();

  constructor(private readonly address: Address) {}

  /** Prices are read straight from Chainlink elsewhere; nothing to hold here. */
  setQuotes(): void {}

  get connectedAddress(): Address | null {
    return this.account;
  }

  private async adopt(accounts: readonly Address[]): Promise<Address | null> {
    const [account] = accounts;
    if (!account) return null;

    await ensureChain();
    this.account = account;
    this.wallet = walletClientFor(account);
    return account;
  }

  /** Reconnects silently if the wallet already granted this site an account. */
  async restore(): Promise<Address | null> {
    return this.adopt(await silentAccounts());
  }

  async connect(): Promise<Address | null> {
    return this.adopt(await requestAccounts());
  }

  disconnect(): void {
    this.wallet = null;
    this.account = null;
  }

  private requireWallet(): { wallet: WalletClient; account: Address } {
    if (!this.wallet || !this.account) {
      throw new Error("Connect a wallet first.");
    }
    return { wallet: this.wallet, account: this.account };
  }

  private read<T>(functionName: string, args: readonly unknown[]): Promise<T> {
    return publicClient.readContract({
      address: this.address,
      abi: miracleGameAbi,
      functionName,
      args,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as Promise<T>;
  }

  private async send(
    functionName: string,
    args: readonly unknown[],
    value?: bigint,
  ): Promise<TxResult> {
    const { wallet, account } = this.requireWallet();

    // Simulated first: a refusal arrives as a named error before the wallet
    // ever asks anyone to sign, rather than as a failed transaction they paid for.
    const { request } = await publicClient.simulateContract({
      address: this.address,
      abi: miracleGameAbi,
      functionName,
      args,
      account,
      value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = (await wallet.writeContract(request as any)) as Hash;

    // This transaction is about to change the season; do not serve the old one.
    this.seasonCache.clear();

    const confirmed = publicClient
      .waitForTransactionReceipt({ hash })
      .then((receipt) => {
        if (receipt.status !== "success") {
          throw new Error("The transaction was reverted by the chain.");
        }
      });

    return { hash, confirmed };
  }

  async getCurrentSeason(): Promise<SeasonState | null> {
    const count = await this.read<bigint>("seasonCount", []);
    if (count === 0n) return null;
    return this.getSeason(Number(count));
  }

  /**
   * One refresh asks for the season three times — once directly, and once
   * inside each of `getPlayer` and `getLeaderboard`, which need its phase and
   * starting capital. A short cache turns that back into one request, which
   * matters on an endpoint that cuts callers off for asking too often.
   *
   * Writes clear it, so an action never reads back a season from before it.
   */
  private seasonCache = new Map<number, { at: number; value: SeasonState | null }>();

  private static readonly SEASON_TTL_MS = 10_000;

  async getSeason(seasonId: number): Promise<SeasonState | null> {
    if (seasonId < 1) return null;

    const cached = this.seasonCache.get(seasonId);
    if (cached && Date.now() - cached.at < ContractAdapter.SEASON_TTL_MS) {
      return cached.value;
    }

    const value = await this.readSeason(seasonId);
    this.seasonCache.set(seasonId, { at: Date.now(), value });
    return value;
  }

  private async readSeason(seasonId: number): Promise<SeasonState | null> {
    try {
      const view = await this.read<{
        id: bigint;
        phase: number;
        entryFee: bigint;
        prizePool: bigint;
        paidOut: bigint;
        startingCapital: bigint;
        entryOpensAt: bigint;
        entryClosesAt: bigint;
        tradingEndsAt: bigint;
        participants: number;
        maxParticipants: number;
        feeBps: number;
        payoutBps: readonly number[];
      }>("getSeason", [BigInt(seasonId)]);

      return {
        id: Number(view.id),
        phase: PHASES[view.phase] ?? "upcoming",
        entryFee: view.entryFee,
        prizePool: view.prizePool,
        startingCapital: fromWad(view.startingCapital),
        participants: view.participants,
        maxParticipants: view.maxParticipants,
        feeBps: view.feeBps,
        payoutBps: [...view.payoutBps],
        entryOpensAt: toDate(view.entryOpensAt),
        entryClosesAt: toDate(view.entryClosesAt),
        // Trading starts the instant entry closes; the contract holds one date.
        tradingStartsAt: toDate(view.entryClosesAt),
        tradingEndsAt: toDate(view.tradingEndsAt),
      };
    } catch {
      return null; // SeasonNotFound
    }
  }

  private toPosition(
    raw: {
      symbol: `0x${string}`;
      isLong: boolean;
      status: number;
      voided: boolean;
      notional: bigint;
      openedAt: bigint;
      closedAt: bigint;
      entryRoundId: bigint;
      exitRoundId: bigint;
      entryPrice: bigint;
      exitPrice: bigint;
      pnl: bigint;
    },
    index: number,
  ): Position | null {
    const symbol = bytes32ToSymbol(raw.symbol);
    // An asset the interface does not know about is not one it can draw.
    if (!isAssetSymbol(symbol)) return null;

    const status = POSITION_STATUSES[raw.status] ?? "open";

    return {
      id: String(index),
      symbol: symbol as AssetSymbol,
      side: raw.isLong ? "long" : "short",
      status,
      notional: fromWad(raw.notional),
      // Zero means the round has not been resolved yet, not a price of zero.
      entryPrice: raw.entryPrice === 0n ? null : fromWad(raw.entryPrice),
      entryRoundId: raw.entryRoundId === 0n ? null : raw.entryRoundId,
      openedAt: toDate(raw.openedAt),
      closedAt: raw.closedAt === 0n ? null : toDate(raw.closedAt),
      exitPrice: raw.exitPrice === 0n ? null : fromWad(raw.exitPrice),
      exitRoundId: raw.exitRoundId === 0n ? null : raw.exitRoundId,
      pnl: status === "settled" ? fromWad(raw.pnl) : null,
      voided: raw.voided,
    };
  }

  async getPlayer(seasonId: number, address: Address): Promise<PlayerState | null> {
    const [view, season] = await Promise.all([
      this.read<{ joined: boolean; score: number; realisedPnl: bigint }>("getPlayer", [
        BigInt(seasonId),
        address,
      ]),
      this.getSeason(seasonId),
    ]);

    if (!view.joined || !season) return null;

    const raw = await this.read<
      readonly Parameters<ContractAdapter["toPosition"]>[0][]
    >("getPositions", [BigInt(seasonId), address]);

    return {
      address,
      seasonId,
      capital: season.startingCapital,
      positions: raw
        .map((position, index) => this.toPosition(position, index))
        .filter((position): position is Position => position !== null),
      score: view.score,
      realisedPnl: fromWad(view.realisedPnl),
    };
  }

  private async participantsOf(
    seasonId: number,
    total: number,
  ): Promise<readonly Address[]> {
    const pages: Promise<readonly Address[]>[] = [];
    for (let offset = 0; offset < total; offset += PARTICIPANT_PAGE) {
      pages.push(
        this.read<readonly Address[]>("getParticipants", [
          BigInt(seasonId),
          BigInt(offset),
          BigInt(PARTICIPANT_PAGE),
        ]),
      );
    }
    return (await Promise.all(pages)).flat();
  }

  async getLeaderboard(
    seasonId: number,
    limit = 100,
  ): Promise<readonly LeaderboardEntry[]> {
    const season = await this.getSeason(seasonId);
    if (!season || season.participants === 0) return [];

    // Once a ranking is accepted it is the order, ties and all. Before that,
    // sort by the same equity the contract will rank on.
    const accepted =
      season.phase === "settled"
        ? await this.read<readonly Address[]>("getRanking", [BigInt(seasonId)])
        : null;

    const addresses =
      accepted ?? (await this.participantsOf(seasonId, season.participants));

    const players = await Promise.all(
      addresses.map((address) =>
        this.read<{ score: number; equity: bigint }>("getPlayer", [
          BigInt(seasonId),
          address,
        ]),
      ),
    );

    const entries = addresses.map((address, index) => ({
      address,
      equity: players[index]?.equity ?? 0n,
      score: players[index]?.score ?? 0,
    }));

    const ordered = accepted
      ? entries
      : [...entries].sort((a, b) =>
          b.equity > a.equity ? 1 : b.equity < a.equity ? -1 : 0,
        );

    return ordered
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async getClaimable(seasonId: number, address: Address): Promise<bigint> {
    return this.read<bigint>("claimableOf", [BigInt(seasonId), address]);
  }

  /**
   * Feed addresses as the contract holds them, not as the interface believes
   * them to be. A symbol's feed is written once at listing and cannot be
   * swapped mid-season, so reading this once is enough.
   */
  private async feedAddresses(): Promise<Map<string, Address>> {
    if (!this.feeds) {
      const assets = await this.read<
        readonly { symbol: `0x${string}`; feed: Address }[]
      >("getAssets", []);
      this.feeds = new Map(
        assets.map((asset) => [bytes32ToSymbol(asset.symbol), asset.feed]),
      );
    }
    return this.feeds;
  }

  /**
   * A reader over one Chainlink proxy, caching rounds.
   *
   * A published round never changes, so every one fetched during a hint search
   * can be answered from memory next time. Without this, each refresh would
   * walk the same binary search again against an endpoint that rate limits.
   */
  private feedReader(feed: Address): RoundReader {
    return {
      latestRound: async () => {
        const [roundId, , , updatedAt] = await publicClient.readContract({
          address: feed,
          abi: AGGREGATOR_ABI,
          functionName: "latestRoundData",
        });
        return { roundId, updatedAt };
      },
      getRound: async (roundId: bigint) => {
        const key = `${feed}:${roundId}`;
        const cached = this.rounds.get(key);
        if (cached !== undefined) return cached;

        let reading: RoundReading | null = null;
        try {
          const [returned, , , updatedAt] = await publicClient.readContract({
            address: feed,
            abi: AGGREGATOR_ABI,
            functionName: "getRoundData",
            args: [roundId],
          });
          // The proxy answers an unknown round with zeros and a different id
          // rather than reverting, so both have to be treated as "no round".
          if (returned === roundId && updatedAt !== 0n) {
            reading = { roundId, updatedAt };
          }
        } catch {
          reading = null;
        }

        this.rounds.set(key, reading);
        return reading;
      },
    };
  }

  async getSettlements(
    seasonId: number,
    address: Address,
  ): Promise<readonly SettlementHint[]> {
    const [player, season] = await Promise.all([
      this.getPlayer(seasonId, address),
      this.getSeason(seasonId),
    ]);
    if (!player || !season) return [];

    const tradingOver = season.phase === "settling" || season.phase === "settled";

    // A position still open settles only once trading has ended, against the
    // moment it ended. One that is closing settles against its close.
    const waiting = player.positions.filter(
      (position) =>
        position.status === "closing" ||
        (position.status === "open" && tradingOver),
    );
    if (waiting.length === 0) return [];

    // The contract voids a silent feed by block time, so the search has to ask
    // the chain what time it is rather than trusting this device's clock.
    const [block, feeds] = await Promise.all([
      publicClient.getBlock(),
      this.feedAddresses(),
    ]);
    const now = block.timestamp;

    const exitMoment = (position: Position): bigint =>
      position.closedAt
        ? BigInt(Math.floor(position.closedAt.getTime() / 1000))
        : BigInt(Math.floor(season.tradingEndsAt.getTime() / 1000));

    const found = await Promise.all(
      waiting.map(async (position) => {
        const feed = feeds.get(position.symbol);
        if (!feed) return null;

        const reader = this.feedReader(feed);
        const [entry, exit] = await Promise.all([
          findFirstRoundAfter(
            reader,
            BigInt(Math.floor(position.openedAt.getTime() / 1000)),
            now,
          ),
          findFirstRoundAfter(reader, exitMoment(position), now),
        ]);

        // "pending" means the oracle simply has not spoken yet. A dead feed is
        // still settleable: the contract voids the position at zero.
        if (entry.kind === "pending" || exit.kind === "pending") return null;

        return {
          positionId: position.id,
          entryRoundId: entry.roundId,
          exitRoundId: exit.roundId,
        };
      }),
    );

    return found.filter((hint): hint is SettlementHint => hint !== null);
  }

  async settlePositions(
    seasonId: number,
    address: Address,
    hints: readonly SettlementHint[],
  ): Promise<TxResult> {
    if (hints.length === 0) throw new Error("Nothing is ready to settle yet.");

    // The batch call skips positions somebody else already settled, where the
    // single call reverts. With a keeper running too, that race is routine.
    const requests = hints.slice(0, SETTLE_BATCH).map((hint) => ({
      player: address,
      positionId: BigInt(hint.positionId),
      entryRoundHint: hint.entryRoundId,
      exitRoundHint: hint.exitRoundId,
    }));

    return this.send("settlePositions", [BigInt(seasonId), requests]);
  }

  async joinSeason(seasonId: number): Promise<TxResult> {
    const season = await this.getSeason(seasonId);
    if (!season) throw new Error("That season does not exist.");
    return this.send("joinSeason", [BigInt(seasonId)], season.entryFee);
  }

  async openPosition(
    seasonId: number,
    input: OpenPositionInput,
  ): Promise<TxResult> {
    return this.send("openPosition", [
      BigInt(seasonId),
      symbolToBytes32(input.symbol),
      input.side === "long",
      toWad(input.notional),
    ]);
  }

  async closePosition(seasonId: number, positionId: string): Promise<TxResult> {
    return this.send("closePosition", [BigInt(seasonId), BigInt(positionId)]);
  }

  async claimPayout(seasonId: number): Promise<TxResult> {
    return this.send("claim", [BigInt(seasonId)]);
  }
}
