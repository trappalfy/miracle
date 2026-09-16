"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  leverageFromScore,
  positionPnl,
  riskWeightedAum,
  aumCapacity,
  isCapitalAdequate,
  type Address,
  type LeaderboardEntry,
  type OpenPositionInput,
  type PlayerState,
  type PositionStatus,
  type PriceQuote,
  type SeasonState,
  type SettlementHint,
} from "@miracle/shared";
import { adapterFor, type AdapterMode, type GameAdapter } from "@/lib/chain/adapter";
import { mockAdapter } from "@/lib/chain/mock-adapter";
import { describeContractError } from "@/lib/chain/contract-adapter";
import { isUserRejection, onAccountsChanged } from "@/lib/chain/wallet";
import { readAllPrices } from "@/lib/prices/chainlink";

const POLL_INTERVAL_MS = 15_000;

/**
 * Everything the game screens need, in one place.
 *
 * Prices come from Chainlink; game state comes from whichever adapter is
 * active — the deployed contract when one is configured, the mock only on the
 * demo screen. Screens ask `adapterKind` rather than assuming, so none of them
 * can claim to be live while reading a mock.
 */

export interface PositionView {
  id: string;
  symbol: string;
  side: "long" | "short";
  status: PositionStatus;
  notional: number;
  entryPrice: number | null;
  exitPrice: number | null;
  currentPrice: number | null;
  /**
   * Realised once settled, a live estimate before that, and null while the
   * entry round is still unknown. `status` says which of the three it is.
   */
  pnl: number | null;
  voided: boolean;
}

interface GameContextValue {
  quotes: PriceQuote[];
  quotesError: string | null;
  priceOf: (symbol: string) => number | null;

  address: Address | null;
  season: SeasonState | null;
  /** False only before the first read returns. A null season after this is an answer. */
  seasonLoaded: boolean;
  player: PlayerState | null;
  leaderboard: readonly LeaderboardEntry[];
  /** Prize owed to the connected address for this season, in wei. Zero if none. */
  claimable: bigint;
  /** Closed positions whose rounds have arrived and can be booked now. */
  settlements: readonly SettlementHint[];

  positions: PositionView[];
  equity: number | null;
  unrealisedPnl: number;
  leverage: number;
  capacity: number;
  riskUsed: number;
  adequate: boolean;

  /** What the screens are actually reading, so none of them has to assume. */
  adapterKind: GameAdapter["kind"];
  busy: boolean;
  /** The last action's failure, in the contract's own words. */
  actionError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  join: () => Promise<void>;
  open: (input: OpenPositionInput) => Promise<void>;
  close: (positionId: string) => Promise<void>;
  claim: () => Promise<void>;
  /** Books every settleable position in one transaction. */
  settle: () => Promise<void>;
  /** Re-read the season now, rather than waiting for the next poll. */
  refresh: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside <GameProvider>");
  return value;
}

export function GameProvider({
  children,
  mode = "live",
}: {
  children: React.ReactNode;
  /** Where game state comes from. Only the demo screen sets this. */
  mode?: AdapterMode;
}) {
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [season, setSeason] = useState<SeasonState | null>(null);
  const [seasonLoaded, setSeasonLoaded] = useState(false);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [leaderboard, setLeaderboard] = useState<readonly LeaderboardEntry[]>([]);
  const [claimable, setClaimable] = useState(0n);
  const [settlements, setSettlements] = useState<readonly SettlementHint[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const adapter = useMemo(() => adapterFor(mode), [mode]);

  // Reconnect without prompting if permission was already given.
  useEffect(() => {
    let cancelled = false;
    void adapter.restore().then((existing) => {
      if (!cancelled && existing) setAddress(existing);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  /*
    Switching account in the wallet has to move the page with it. Without this
    the board would keep showing the previous account's season — and the next
    transaction would be signed by someone else than the screen is describing.
  */
  useEffect(() => {
    if (adapter.kind !== "chain") return;

    return onAccountsChanged((accounts) => {
      const [next] = accounts;
      if (next) {
        void adapter.restore().then(() => setAddress(next));
      } else {
        adapter.disconnect();
        setAddress(null);
        setPlayer(null);
      }
    });
  }, [adapter]);

  // Price polling. Quotes feed the adapter so PnL tracks the real market.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await readAllPrices();
        if (cancelled) return;
        adapter.setQuotes(next);
        setQuotes(next);
        setQuotesError(null);
      } catch (error) {
        if (!cancelled) {
          setQuotesError(
            error instanceof Error ? error.message : "Could not reach the price feeds.",
          );
        }
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adapter]);

  /*
    Game state polls on its own clock, deliberately not on the price poll's.

    They used to share one: prices came back, and the season was re-read on the
    way past. That coupling fails at the worst possible moment — if the feeds
    are unreachable when a season opens, the page would never notice the phase
    had changed and would keep telling people to wait.
  */
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Game state, re-read on that clock and after every action.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (adapter.kind === "mock") mockAdapter.setDemoSeason(mode === "demo");

      const current = await adapter.getCurrentSeason();
      if (cancelled) return;
      setSeason(current);
      setSeasonLoaded(true);

      // No season means there is nothing to be a player in and nobody to rank.
      if (!current) {
        setPlayer(null);
        setLeaderboard([]);
        return;
      }

      const [nextPlayer, board, owed] = await Promise.all([
        address ? adapter.getPlayer(current.id, address) : Promise.resolve(null),
        adapter.getLeaderboard(current.id),
        address ? adapter.getClaimable(current.id, address) : Promise.resolve(0n),
      ]);

      if (cancelled) return;
      setPlayer(nextPlayer);
      setLeaderboard(board);
      setClaimable(owed);

      // Searching for round hints costs several reads per position, so it only
      // runs when the player actually has something waiting on a round.
      const waiting =
        nextPlayer?.positions.some((position) => position.status !== "settled") ?? false;

      if (!address || !waiting) {
        setSettlements([]);
        return;
      }

      const ready = await adapter.getSettlements(current.id, address);
      if (!cancelled) setSettlements(ready);
    }

    void load().catch((error) => {
      if (!cancelled) setActionError(describeContractError(error));
    });
    return () => {
      cancelled = true;
    };
  }, [address, tick, mode, adapter]);

  const priceOf = useCallback(
    (symbol: string) => quotes.find((q) => q.symbol === symbol)?.price ?? null,
    [quotes],
  );

  const positions = useMemo<PositionView[]>(() => {
    if (!player) return [];
    return player.positions.map((position) => {
      const currentPrice = priceOf(position.symbol);

      // A settled position has a real result; anything still running only has
      // an estimate, and that estimate needs both an entry and a live price.
      const estimate =
        position.entryPrice !== null && currentPrice !== null
          ? positionPnl(
              {
                side: position.side,
                notional: position.notional,
                entryPrice: position.entryPrice,
              },
              currentPrice,
            )
          : null;

      return {
        id: position.id,
        symbol: position.symbol,
        side: position.side,
        status: position.status,
        notional: position.notional,
        entryPrice: position.entryPrice,
        exitPrice: position.exitPrice,
        currentPrice,
        pnl: position.status === "settled" ? position.pnl : estimate,
        voided: position.voided,
      };
    });
  }, [player, priceOf]);

  /** Only what is still running: a settled result is already in `realisedPnl`. */
  const openPositions = useMemo(
    () => positions.filter((position) => position.status !== "settled"),
    [positions],
  );

  const unrealisedPnl = useMemo(
    () => openPositions.reduce((total, position) => total + (position.pnl ?? 0), 0),
    [openPositions],
  );

  const leverage = player ? leverageFromScore(player.score) : leverageFromScore(0);

  /*
    Capacity follows realised results, not the starting number: the contract
    computes it from `startingCapital + realisedPnl`, floored at zero. A player
    who has realised losses has less room, and one who has realised gains has
    more. Open positions never count, however well they are doing.
  */
  const capacity = player
    ? aumCapacity(Math.max(0, player.capital + player.realisedPnl), leverage)
    : 0;
  // A position that is closing still occupies capacity until its exit round
  // arrives, exactly as it does in the contract.
  const riskUsed = useMemo(
    () =>
      riskWeightedAum(
        openPositions.map((p) => ({ symbol: p.symbol, notional: p.notional })),
      ),
    [openPositions],
  );
  const equity = player ? player.capital + player.realisedPnl + unrealisedPnl : null;

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const connect = useCallback(async () => {
    setActionError(null);
    try {
      const next = await adapter.connect();
      if (next) setAddress(next);
    } catch (error) {
      // Declining a wallet prompt is a choice, not a failure to report back.
      if (!isUserRejection(error)) setActionError(describeContractError(error));
    }
  }, [adapter]);

  const disconnect = useCallback(() => {
    adapter.disconnect();
    setAddress(null);
    setPlayer(null);
  }, [adapter]);

  const runAction = useCallback(
    async (action: () => Promise<{ confirmed: Promise<void> }>) => {
      setBusy(true);
      setActionError(null);
      try {
        const tx = await action();
        await tx.confirmed;
        refresh();
      } catch (error) {
        if (!isUserRejection(error)) setActionError(describeContractError(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const join = useCallback(async () => {
    if (!season) return;
    await runAction(() => adapter.joinSeason(season.id));
  }, [season, runAction, adapter]);

  const open = useCallback(
    async (input: OpenPositionInput) => {
      if (!season) return;
      await runAction(() => adapter.openPosition(season.id, input));
    },
    [season, runAction, adapter],
  );

  const close = useCallback(
    async (positionId: string) => {
      if (!season) return;
      await runAction(() => adapter.closePosition(season.id, positionId));
    },
    [season, runAction, adapter],
  );

  const claim = useCallback(async () => {
    if (!season) return;
    await runAction(() => adapter.claimPayout(season.id));
  }, [season, runAction, adapter]);

  const settle = useCallback(async () => {
    if (!season || !address || settlements.length === 0) return;
    await runAction(() => adapter.settlePositions(season.id, address, settlements));
  }, [season, address, settlements, runAction, adapter]);

  const value: GameContextValue = {
    quotes,
    quotesError,
    priceOf,
    address,
    season,
    seasonLoaded,
    player,
    leaderboard,
    claimable,
    settlements,
    positions,
    equity,
    unrealisedPnl,
    leverage,
    capacity,
    riskUsed,
    adequate: isCapitalAdequate(riskUsed, capacity),
    adapterKind: adapter.kind,
    busy,
    actionError,
    connect,
    disconnect,
    join,
    open,
    close,
    claim,
    settle,
    refresh,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
