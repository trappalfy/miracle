import { DEFAULT_PAYOUT_BPS } from "./payouts";

/**
 * What has been announced about the first full season, before it exists
 * on-chain — the single source for the launch countdown and the numbers shown
 * beside it.
 *
 * `opensAt` stays null until the owner announces a date. While it is null the
 * interface says the date is not announced; it never counts down to an
 * invented one. Change it here and nowhere else.
 *
 * The other fields are decided and match the defaults of
 * packages/contracts/script/CreateSeason.s.sol, which creates the season.
 * Once the season is on-chain, `getSeason` is authoritative for all of them.
 */
export interface SeasonAnnouncement {
  /** When entry opens. Null until announced. */
  readonly opensAt: Date | null;
  /** Entry fee in wei. */
  readonly entryFee: bigint;
  /** Entry stays open this long after `opensAt`; trading starts when it closes. */
  readonly entryDurationSeconds: number;
  readonly tradingDurationSeconds: number;
  /** Virtual capital each player starts with, in display units. */
  readonly startingCapital: number;
  /** Entry is refused past this many players, which caps the prize pool. */
  readonly maxParticipants: number;
  readonly feeBps: number;
  readonly payoutBps: readonly number[];
}

const DAY_SECONDS = 86_400;

export const FIRST_SEASON: SeasonAnnouncement = {
  opensAt: null,
  entryFee: 10_000_000_000_000_000n, // 0.01 ETH
  entryDurationSeconds: 3 * DAY_SECONDS,
  tradingDurationSeconds: 14 * DAY_SECONDS,
  startingCapital: 100_000,
  maxParticipants: 100,
  feeBps: 0,
  payoutBps: DEFAULT_PAYOUT_BPS,
};

export interface SeasonSchedule {
  readonly entryOpensAt: Date;
  /** Entry closes and trading starts at the same moment. */
  readonly tradingStartsAt: Date;
  readonly tradingEndsAt: Date;
}

/**
 * The dates the season will be created with, derived exactly as the contract
 * script derives them. Null while the opening date is unannounced.
 */
export function announcedSchedule(announcement: SeasonAnnouncement): SeasonSchedule | null {
  if (!announcement.opensAt) return null;

  const opens = announcement.opensAt.getTime();
  const tradingStarts = opens + announcement.entryDurationSeconds * 1000;
  return {
    entryOpensAt: new Date(opens),
    tradingStartsAt: new Date(tradingStarts),
    tradingEndsAt: new Date(tradingStarts + announcement.tradingDurationSeconds * 1000),
  };
}
