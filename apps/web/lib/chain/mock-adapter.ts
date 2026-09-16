import {
  ASSETS,
  DEFAULT_PAYOUT_BPS,
  leverageFromScore,
  positionPnl,
  type Address,
  type Hash,
  type LeaderboardEntry,
  type MiracleAdapter,
  type OpenPositionInput,
  type PlayerState,
  type Position,
  type PositionStatus,
  type PriceQuote,
  type SeasonState,
  type SettlementHint,
  type TxResult,
  toWad,
} from "@miracle/shared";

/**
 * In-memory stand-in for the contracts, running on live Chainlink prices.
 *
 * It exists so the interface can be finished and exercised before the
 * contracts land, and it deliberately reproduces the states the real chain
 * will produce — including an entry price that is not known yet. A mock that
 * resolved entry prices instantly would let us ship a UI that falls over the
 * moment it meets the real thing.
 *
 * The connected address is held on the adapter, exactly as the real one will
 * hold a wallet client, so `MiracleAdapter` is implemented as declared and the
 * swap is a one-line change.
 *
 * Everything here is local to the browser. Nothing is on-chain, and the
 * interface says so while this adapter is in use.
 */

const STORAGE_KEY = "miracle.demo.v1";
const SEASON_ID = 1;
const STARTING_CAPITAL = 100_000;

interface StoredPosition {
  id: string;
  symbol: keyof typeof ASSETS;
  side: "long" | "short";
  notional: number;
  entryPrice: number | null;
  openedAtMs: number;
  /** Set the moment a close is asked for. The exit round comes later. */
  closedAtMs: number | null;
  exitPrice: number | null;
  pnl: number | null;
}

interface StoredPlayer {
  joined: boolean;
  score: number;
  realisedPnl: number;
  positions: StoredPosition[];
}

interface Store {
  players: Record<string, StoredPlayer>;
}

const emptyStore = (): Store => ({ players: {} });

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : emptyStore();
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode — the session simply will not persist */
  }
}

function playerRecord(store: Store, address: Address): StoredPlayer {
  return (
    store.players[address.toLowerCase()] ?? {
      joined: false,
      score: 0,
      realisedPnl: 0,
      positions: [],
    }
  );
}

function savePlayer(store: Store, address: Address, player: StoredPlayer): void {
  store.players[address.toLowerCase()] = player;
  writeStore(store);
}

function fakeTx(): TxResult {
  const hash = ("0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")) as Hash;

  // Settles on the next tick so callers exercise their pending state.
  return { hash, confirmed: new Promise<void>((resolve) => setTimeout(resolve, 600)) };
}

const IDENTITY_KEY = "miracle.demo.address";

/** A stand-in for a wallet, so the demo can have a player without one. */
function loadIdentity(): Address | null {
  try {
    return window.localStorage.getItem(IDENTITY_KEY) as Address | null;
  } catch {
    return null;
  }
}

function createIdentity(): Address {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const address = ("0x" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")) as Address;
  try {
    window.localStorage.setItem(IDENTITY_KEY, address);
  } catch {
    /* private mode — the identity simply will not persist */
  }
  return address;
}

export class MockAdapter implements MiracleAdapter {
  readonly kind = "mock" as const;

  private address: Address | null = null;
  /** Latest quotes, pushed in by the price poller so PnL tracks the real market. */
  private quotes = new Map<string, PriceQuote>();

  async connect(): Promise<Address | null> {
    this.address = loadIdentity() ?? createIdentity();
    return this.address;
  }

  async restore(): Promise<Address | null> {
    this.address = loadIdentity();
    return this.address;
  }

  disconnect(): void {
    this.address = null;
  }

  private requireAddress(): Address {
    if (!this.address) throw new Error("Connect a wallet first");
    return this.address;
  }

  setQuotes(quotes: readonly PriceQuote[]): void {
    for (const quote of quotes) this.quotes.set(quote.symbol, quote);
    this.resolvePendingRounds();
  }

  private priceOf(symbol: string): number | null {
    return this.quotes.get(symbol)?.price ?? null;
  }

  /**
   * Resolves the rounds that positions are waiting on — entries, then exits.
   *
   * This is the mock's version of "the first oracle round after the moment",
   * which applies to both ends of a trade. The price you get is never the one
   * that was on screen when you pressed the button, and a close does not book
   * a result until a round arrives to close it against.
   */
  private resolvePendingRounds(): void {
    const store = readStore();
    let changed = false;

    for (const player of Object.values(store.players)) {
      for (const position of player.positions) {
        const price = this.priceOf(position.symbol);
        if (price === null) continue;

        if (position.entryPrice === null) {
          position.entryPrice = price;
          changed = true;
          continue; // an entry and its exit never resolve on the same round
        }

        // The exit round is found, but the result is not booked here. On the
        // chain that takes a second transaction, and a mock that skipped it
        // would hide the step the player actually has to take.
        if (position.closedAtMs !== null && position.exitPrice === null) {
          position.exitPrice = price;
          changed = true;
        }
      }
    }

    if (changed) writeStore(store);
  }

  private static statusOf(stored: StoredPosition): PositionStatus {
    if (stored.pnl !== null) return "settled";
    return stored.closedAtMs !== null ? "closing" : "open";
  }

  private toPosition(stored: StoredPosition): Position {
    return {
      id: stored.id,
      symbol: stored.symbol,
      side: stored.side,
      status: MockAdapter.statusOf(stored),
      notional: stored.notional,
      entryPrice: stored.entryPrice,
      entryRoundId: null,
      openedAt: new Date(stored.openedAtMs),
      closedAt: stored.closedAtMs === null ? null : new Date(stored.closedAtMs),
      exitPrice: stored.exitPrice,
      exitRoundId: null,
      pnl: stored.pnl,
      voided: false,
    };
  }

  /**
   * What the leaderboard ranks on, in WAD so ties compare the way the contract
   * compares them.
   *
   * Open positions are not counted, however well they are doing — the contract
   * ranks on starting capital plus *realised* profit and loss, floored at
   * zero. Adding unrealised gains here would make the demo board move in a way
   * the real one never does, and the first surprise would come at settlement.
   */
  private equityOf(player: StoredPlayer): bigint {
    return toWad(Math.max(0, STARTING_CAPITAL + player.realisedPnl));
  }

  /**
   * Whether this adapter should pretend a season is running.
   *
   * Off by default, and deliberately so: no season has been created for
   * players, and a mock that invents one would put "the season is open" in
   * front of people when it is not. The demo screen turns it on explicitly and
   * labels itself as a demo.
   */
  private demoSeason = false;

  setDemoSeason(enabled: boolean): void {
    this.demoSeason = enabled;
  }

  async getCurrentSeason(): Promise<SeasonState | null> {
    if (!this.demoSeason) return null;

    const now = Date.now();
    const day = 86_400_000;

    return {
      id: SEASON_ID,
      phase: "live",
      entryFee: 10_000_000_000_000_000n, // 0.01 ETH
      prizePool: 240_000_000_000_000_000n,
      startingCapital: STARTING_CAPITAL,
      participants: Object.values(readStore().players).filter((p) => p.joined).length,
      maxParticipants: 100,
      feeBps: 0,
      payoutBps: DEFAULT_PAYOUT_BPS,
      entryOpensAt: new Date(now - 3 * day),
      entryClosesAt: new Date(now + 2 * day),
      tradingStartsAt: new Date(now - 2 * day),
      tradingEndsAt: new Date(now + 5 * day),
    };
  }

  async getSeason(seasonId: number): Promise<SeasonState | null> {
    return seasonId === SEASON_ID ? await this.getCurrentSeason() : null;
  }

  async getPlayer(seasonId: number, address: Address): Promise<PlayerState | null> {
    if (seasonId !== SEASON_ID) return null;
    const player = playerRecord(readStore(), address);
    if (!player.joined) return null;

    return {
      address,
      seasonId,
      capital: STARTING_CAPITAL,
      positions: player.positions.map((p) => this.toPosition(p)),
      score: player.score,
      realisedPnl: player.realisedPnl,
    };
  }

  async getLeaderboard(
    seasonId: number,
    limit = 20,
  ): Promise<readonly LeaderboardEntry[]> {
    if (seasonId !== SEASON_ID) return [];
    const store = readStore();

    const joined = Object.entries(store.players)
      .filter(([, player]) => player.joined)
      .map(([address, player]) => ({
        address: address as Address,
        equity: this.equityOf(player),
        score: player.score,
      }));

    // Only real players. Invented rivals would put numbers on a leaderboard
    // that nobody earned, which is the one thing a leaderboard cannot do.
    return joined
      .sort((a, b) => (b.equity > a.equity ? 1 : b.equity < a.equity ? -1 : 0))
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async getClaimable(): Promise<bigint> {
    return 0n; // Nothing to claim while the season is live.
  }

  async joinSeason(_seasonId: number): Promise<TxResult> {
    const address = this.requireAddress();
    const store = readStore();
    savePlayer(store, address, { ...playerRecord(store, address), joined: true });
    return fakeTx();
  }

  async openPosition(
    _seasonId: number,
    input: OpenPositionInput,
  ): Promise<TxResult> {
    const address = this.requireAddress();
    const store = readStore();
    const player = playerRecord(store, address);

    player.positions = [
      ...player.positions,
      {
        id: crypto.randomUUID(),
        symbol: input.symbol,
        side: input.side,
        notional: input.notional,
        entryPrice: null, // resolved on the next quote, never at click time
        openedAtMs: Date.now(),
        closedAtMs: null,
        exitPrice: null,
        pnl: null,
      },
    ];

    savePlayer(store, address, player);
    return fakeTx();
  }

  /**
   * Records the close and nothing else, exactly as the contract does.
   *
   * The result is not booked here: it waits for the first round after this
   * moment, which `resolvePendingRounds` fills in. Closing at the price on
   * screen would hand the player the one thing the whole design exists to
   * prevent, and would hide the waiting state the real game has.
   */
  async closePosition(_seasonId: number, positionId: string): Promise<TxResult> {
    const address = this.requireAddress();
    const store = readStore();
    const player = playerRecord(store, address);
    const stored = player.positions.find((p) => p.id === positionId);

    if (stored && stored.closedAtMs === null) {
      stored.closedAtMs = Date.now();
    }

    savePlayer(store, address, player);
    return fakeTx();
  }

  /**
   * Positions whose exit round has arrived and are waiting to be booked.
   *
   * The round ids are zero here because nothing checks them: on the chain they
   * are the hints the contract verifies, and the shape is kept identical so
   * the screens above cannot tell the two adapters apart.
   */
  async getSettlements(
    _seasonId: number,
    address: Address,
  ): Promise<readonly SettlementHint[]> {
    return playerRecord(readStore(), address)
      .positions.filter(
        (position) =>
          position.closedAtMs !== null &&
          position.exitPrice !== null &&
          position.pnl === null,
      )
      .map((position) => ({
        positionId: position.id,
        entryRoundId: 0n,
        exitRoundId: 0n,
      }));
  }

  async settlePositions(
    _seasonId: number,
    address: Address,
    hints: readonly SettlementHint[],
  ): Promise<TxResult> {
    const store = readStore();
    const player = playerRecord(store, address);
    const wanted = new Set(hints.map((hint) => hint.positionId));

    for (const position of player.positions) {
      if (!wanted.has(position.id)) continue;
      if (position.pnl !== null) continue; // already settled, as the batch call skips
      if (position.entryPrice === null || position.exitPrice === null) continue;

      position.pnl = positionPnl(
        {
          side: position.side,
          notional: position.notional,
          entryPrice: position.entryPrice,
        },
        position.exitPrice,
      );
      player.realisedPnl += position.pnl;
    }

    savePlayer(store, address, player);
    return fakeTx();
  }

  async claimPayout(_seasonId: number): Promise<TxResult> {
    this.requireAddress();
    return fakeTx();
  }

  leverageFor(address: Address): number {
    return leverageFromScore(playerRecord(readStore(), address).score);
  }

  reset(): void {
    writeStore(emptyStore());
  }
}

export const mockAdapter = new MockAdapter();
