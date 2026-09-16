# Miracle Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `MiracleGame` + `ChainlinkLib` on Robinhood Chain mainnet with a beta season, ABI and hint tooling handed to the frontend.

> **Implementation note:** "after" became strict (`updatedAt > T`) during Task 2 — see design §3 item 10. Code in this plan predates that change; the source files are authoritative.

**Architecture:** One immutable Foundry contract holding all game state; a library resolves "first oracle round at or after T" through the Chainlink proxy, including the phase boundary. Offchain, `packages/shared/src/rounds.ts` finds round hints and a keeper script settles positions and submits the ranking.

**Tech Stack:** Solidity 0.8.28 (EVM cancun), Foundry (forge 1.5.1, forge-std), TypeScript + viem + tsx for scripts, vitest for shared.

**Spec:** `docs/CONTRACTS-DESIGN.md` (on top of `docs/CONTRACTS-BRIEF.md`)

## Global Constraints

- Do not touch `apps/web/**` or `packages/shared/src/types.ts`.
- Fixed point: risk weight `uint16` bps (10000 = 1×); leverage `uint32` bps `30000 + score*700`; score `uint16` 0..100; capital/notional/equity/prices `uint256` WAD (1e18).
- Asset symbols are ASCII, right-padded `bytes32` (`"SPY"` in Solidity == viem `stringToHex("SPY", { size: 32 })`).
- Events exactly as brief §10; no extra events.
- No proxies, pause, whitelist, multisig. Owner = deployer key.
- Constants: `MAX_FEE_BPS = 2000`, `MAX_PAID_PLACES = 100`, `MAX_UNSETTLED_POSITIONS = 20`, `DEAD_FEED_AFTER = 7 days`, `MAX_STARTING_CAPITAL = 1e30`.
- Workspace is not a git repository: commit steps are skipped.
- Beta season: fee 0.0001 ETH, entry 24 h from deploy, trading 7 days, capital 100 000e18, max 100 participants, fee 0, payout `[2500,1800,1300,1000,800,700,600,500,400,400]`.

## File Map

| File | Responsibility |
|---|---|
| `packages/contracts/foundry.toml`, `package.json`, `.gitignore`, `.env.example` | Package + toolchain config |
| `packages/contracts/src/ChainlinkLib.sol` | Round reads, validity, WAD normalisation, first-round-after-T resolution incl. phase boundary and dead feed |
| `packages/contracts/src/MiracleGame.sol` | Assets, seasons, players, positions, settlement, ranking, payouts, scores, claim, views |
| `packages/contracts/test/mocks/MockFeed.sol` | Phase-aware AggregatorProxy double (zeros for missing round, revert for missing phase) |
| `packages/contracts/test/mocks/ChainlinkLibHarness.sol` | Exposes library functions for tests |
| `packages/contracts/test/ChainlinkLib.t.sol` | Resolution rules |
| `packages/contracts/test/Base.t.sol` | Shared fixture: game, two feeds, helpers to join/open/advance |
| `packages/contracts/test/MiracleGame.t.sol` | Season, join, open, close, settle |
| `packages/contracts/test/Ranking.t.sol` | Brief §9 money paths, reentrancy, payout curves, scores, fuzz invariant |
| `packages/contracts/test/Fork.t.sol` | Real SPY feed on mainnet fork (skips without `RPC_URL`) |
| `packages/contracts/script/Deploy.s.sol` | Deploy + list 8 assets + beta season |
| `packages/contracts/script/CreateSeason.s.sol` | Create a season on an existing deployment from env |
| `packages/contracts/scripts/export-abi.mjs` | Writes ABI json + `as const` TS into shared |
| `packages/contracts/scripts/keeper.ts` | Settle positions, submit ranking |
| `packages/shared/src/rounds.ts` + `rounds.test.ts` | Offchain hint search |
| `packages/shared/src/abi/MiracleGame.{json,ts}` | Generated ABI |
| `packages/shared/src/index.ts` | + exports for abi and rounds |
| `packages/shared/src/chain.ts` | `DEPLOYMENTS[4663].game` |

---

### Task 1: Package scaffold + ChainlinkLib

**Files:**
- Create: `packages/contracts/{foundry.toml,package.json,.gitignore,.env.example}`
- Create: `packages/contracts/src/ChainlinkLib.sol`
- Create: `packages/contracts/test/mocks/MockFeed.sol`, `test/mocks/ChainlinkLibHarness.sol`
- Test: `packages/contracts/test/ChainlinkLib.t.sol`

**Interfaces:**
- Produces:
  - `interface AggregatorV3Interface { decimals(); latestRoundData(); getRoundData(uint80); }`
  - `library ChainlinkLib`:
    - `struct Round { bool exists; uint80 roundId; int256 answer; uint256 updatedAt; uint80 answeredInRound; }`
    - `struct Resolution { bool voided; uint80 roundId; uint256 price; }`
    - `readRound(address feed, uint80 roundId) internal view returns (Round memory)`
    - `isUsable(Round memory) internal pure returns (bool)` — `exists && answer > 0 && answeredInRound >= roundId`
    - `toWad(int256 answer, uint8 decimals) internal pure returns (uint256)`
    - `lastRoundInPhase(address feed, uint16 phase) internal view returns (uint64)` — 0 if the phase has no rounds
    - `resolveFirstRoundAfter(address feed, uint8 decimals, uint256 timestamp, uint80 hint) internal view returns (Resolution memory)`
    - errors `RoundNotPublished(uint80)`, `HintNotAfterTimestamp(uint80)`, `HintNotFirstAfterTimestamp(uint80)`
  - `MockFeed(uint8 decimals)`: `push(int256 answer, uint256 updatedAt) returns (uint80 roundId)`, `pushUnanswered(int256, uint256) returns (uint80)` (answeredInRound = id-1), `startPhase()`, `phaseId()`.

- [ ] **Step 1: Scaffold.** `foundry.toml` (src/test/script/out/libs, `solc_version = "0.8.28"`, `evm_version = "cancun"`, optimizer 200, `[fuzz] runs = 512`). `package.json` name `@miracle/contracts`, scripts `build: forge build`, `test: forge test`. `.gitignore`: `out/ cache/ broadcast/ .env`. `.env.example`: `PRIVATE_KEY=`, `RPC_URL=`. Install forge-std: `forge install foundry-rs/forge-std --no-git`, remapping `forge-std/=lib/forge-std/src/`.

- [ ] **Step 2: Write failing tests** in `ChainlinkLib.t.sol` against the harness:
  - `test_resolvesFirstRoundAfterTimestamp` — rounds at t=100,200,300; T=150; hint round 2 → price = answer·1e10, roundId = hint, not voided.
  - `test_roundExactlyAtTimestampCounts` — T=200, hint round 2 resolves.
  - `test_rejectsHintNotAfterTimestamp` — T=250, hint round 2 → `HintNotAfterTimestamp`.
  - `test_rejectsLaterRoundThanFirst` — T=150, hint round 3 → `HintNotFirstAfterTimestamp`.
  - `test_rejectsUnpublishedRound` — T=350, hint round 4 → `RoundNotPublished`; hint round 3 (latest, before T, grace not over) → `RoundNotPublished`.
  - `test_voidsDeadFeedAfterGrace` — T=350, warp to 350 + 7 days, hint = latest → voided.
  - `test_deadFeedNeedsLatestRoundAsHint` — same warp, hint round 2 → `RoundNotPublished`.
  - `test_voidsUnusableRound` — first round after T has answer 0 → voided; `pushUnanswered` → voided.
  - `test_firstRoundOfNewPhaseAfterBoundary` — phase 1 rounds at 100,200; `startPhase`; phase 2 rounds at 400,500; T=300 → hint (2,1) resolves.
  - `test_phaseBoundaryRejectsNewPhaseWhenOldPhaseHadLaterRound` — phase 1 rounds 100,200,350; phase 2 at 400; T=300 → hint (2,1) reverts `HintNotFirstAfterTimestamp`; hint (1,3) resolves.
  - `test_firstRoundOfFirstPhaseHasNoPredecessor` — T=50, hint (1,1) resolves.
  - `test_lastRoundInPhase` — 1, 2, 3, 37, 64, 65 rounds → returns exact count; empty phase → 0.
  - `test_toWadScalesDecimals` — (8 → ×1e10), (18 → ×1).

- [ ] **Step 3: Run** `forge test --match-path test/ChainlinkLib.t.sol` → FAIL (missing sources).

- [ ] **Step 4: Implement** `ChainlinkLib.sol`:

```solidity
function resolveFirstRoundAfter(address feed, uint8 decimals, uint256 timestamp, uint80 hint)
    internal view returns (Resolution memory)
{
    Round memory round = readRound(feed, hint);
    if (!round.exists || round.updatedAt < timestamp) {
        (uint80 latestId,,, uint256 latestUpdatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        if (latestUpdatedAt >= timestamp) {
            if (!round.exists) revert RoundNotPublished(hint);
            revert HintNotAfterTimestamp(hint);
        }
        if (hint == latestId && block.timestamp >= timestamp + DEAD_FEED_AFTER) {
            return Resolution({voided: true, roundId: hint, price: 0});
        }
        revert RoundNotPublished(hint);
    }
    if (_previousUpdatedAt(feed, hint) >= timestamp) revert HintNotFirstAfterTimestamp(hint);
    if (!isUsable(round)) return Resolution({voided: true, roundId: hint, price: 0});
    return Resolution({voided: false, roundId: hint, price: toWad(round.answer, decimals)});
}

function _previousUpdatedAt(address feed, uint80 roundId) private view returns (uint256) {
    uint16 phase = uint16(roundId >> PHASE_OFFSET);
    uint64 aggregatorRound = uint64(roundId);
    if (aggregatorRound > 1) return readRound(feed, roundId - 1).updatedAt;
    for (uint16 p = phase; p > 1;) {
        --p;
        uint64 last = lastRoundInPhase(feed, p);
        if (last != 0) return readRound(feed, _roundId(p, last)).updatedAt;
    }
    return 0;
}

function lastRoundInPhase(address feed, uint16 phase) internal view returns (uint64) {
    if (!readRound(feed, _roundId(phase, 1)).exists) return 0;
    uint64 lo = 1;
    uint64 hi = 2;
    while (readRound(feed, _roundId(phase, hi)).exists) {
        lo = hi;
        hi = hi << 1; // rounds are contiguous; 2^63 is unreachable in practice
    }
    while (hi - lo > 1) {
        uint64 mid = lo + (hi - lo) / 2;
        if (readRound(feed, _roundId(phase, mid)).exists) lo = mid;
        else hi = mid;
    }
    return lo;
}
```

`readRound` wraps `getRoundData` in `try/catch`; exists iff no revert, returned id == requested, `updatedAt != 0`.

- [ ] **Step 5: Run** `forge test --match-path test/ChainlinkLib.t.sol` → PASS.

---

### Task 2: MiracleGame — assets, seasons, join, open, close, settle

**Files:**
- Create: `packages/contracts/src/MiracleGame.sol`
- Create: `packages/contracts/test/Base.t.sol`
- Test: `packages/contracts/test/MiracleGame.t.sol`

**Interfaces:**
- Consumes: `ChainlinkLib.resolveFirstRoundAfter`, `MockFeed`.
- Produces (exact, used by Tasks 3, 5, 6):
  - enums `Phase { Upcoming, Entry, Live, Settling, Settled }`, `PositionStatus { Open, Closing, Settled }`
  - structs `AssetView { bytes32 symbol; address feed; uint16 riskWeightBps; bool alwaysOpen; uint8 decimals; }`,
    `SeasonView { uint256 id; Phase phase; uint256 entryFee; uint256 prizePool; uint256 paidOut; uint256 startingCapital; uint64 entryOpensAt; uint64 entryClosesAt; uint64 tradingEndsAt; uint32 participants; uint32 maxParticipants; uint16 feeBps; uint16[] payoutBps; }`,
    `PlayerView { bool joined; uint32 index; uint16 score; uint32 leverageBps; uint32 unsettledPositions; uint32 rank; int256 realisedPnl; uint256 riskWeightedAum; uint256 aumCapacity; uint256 equity; uint256 positionCount; uint256 claimable; }`,
    `Position { bytes32 symbol; bool isLong; PositionStatus status; bool voided; uint256 notional; uint64 openedAt; uint64 closedAt; uint80 entryRoundId; uint80 exitRoundId; uint256 entryPrice; uint256 exitPrice; int256 pnl; }`,
    `SettleRequest { address player; uint256 positionId; uint80 entryRoundHint; uint80 exitRoundHint; }`
  - functions as in design §4, plus `leverageBpsFromScore(uint16) public pure returns (uint32)` and `positionPnl(bool isLong, uint256 notional, uint256 entryPrice, uint256 exitPrice) public pure returns (int256)`.
  - errors: `NotOwner, ZeroAddress, InvalidAsset, AssetAlreadyListed(bytes32), AssetNotListed(bytes32), InvalidSeason, SeasonNotFound, WrongPhase(Phase expected, Phase actual), WrongEntryFee, AlreadyJoined, SeasonFull, NotParticipant(address), ZeroNotional, TooManyUnsettledPositions, CapitalInadequate(uint256 required, uint256 capacity), PositionNotFound, PositionNotOpen, PositionAlreadySettled, PositionStillOpen, RankingLengthMismatch, DuplicatePlayer(address), UnsettledPositions(address), RankingOrderViolated(uint256 index), NothingToClaim, TransferFailed, Reentrancy`.

- [ ] **Step 1: Base fixture** `Base.t.sol`: deploys `MiracleGame`, `MockFeed spy(8)` listed as `"SPY"` 10000, `MockFeed btc(8)` listed `"BTC"` 20000 alwaysOpen; seeds a price round at deploy time; creates season (fee 1 ether, opens now, closes +1 day, ends +8 days, capital 100_000e18, max 100, fee 0, top-10 curve). Helpers: `join(addr)`, `toLive()`, `toEnd()`, `open(addr, symbol, isLong, notional)`, `pushPrice(feed, price8)`.

- [ ] **Step 2: Failing tests** `MiracleGame.t.sol`:
  - config: `test_onlyOwnerListsAndCreates`; `test_assetCannotBeRelisted`; `test_rejectsInvalidSeasonParams` (bad times, zero capital, zero max, fee > 2000, payout sum ≠ 10000, increasing payout, empty payout); `test_seasonIdsStartAtOne`; `test_phasesFollowTime` (Upcoming→Entry→Live→Settling).
  - join: `test_joinRecordsIndexScoreAndLeverage` (score 0 → 30000); `test_joinRejectsWrongFee`; `test_joinRejectsTwice`; `test_joinRejectsOutsideEntry`; `test_joinRespectsMaxParticipants`.
  - parity with `formulas.ts`: `test_leverageMatchesFormulas` (0→30000, 50→65000, 100→100000, 140→100000); `test_positionPnlMatchesFormulas` (long 1000 @100→110 = +100e18; →90 = −100e18; short mirrors; unmoved = 0).
  - open: `test_openRecordsTimestampWithoutPrice`; `test_openRejectsBeforeLive`; `test_openRejectsUnknownAsset`; `test_openRejectsZeroNotional`; `test_capacityUsesRiskWeights` (capital 100k × 3 = 300k; BTC 2× → notional 150k fits, +1 wei reverts `CapitalInadequate`); `test_unsettledPositionLimit` (21st open reverts).
  - close: `test_closeMarksClosing`; `test_closeRejectsOthersPositionAndAfterEnd`.
  - settle: `test_settleClosedLongUsesNextRounds` (open at t, price rounds after open 100 then close request then round 110 → pnl +10% notional, aum released, unsettled 0, event `PositionClosed`); `test_settleShort`; `test_settleOpenPositionOnlyAfterEnd` (reverts `PositionStillOpen` during Live; after end uses first round ≥ tradingEndsAt); `test_sameRoundEntryAndExitIsZeroPnl`; `test_deadFeedVoidsPosition`; `test_settleTwiceReverts`; `test_batchSkipsSettled`; `test_realisedPnlChangesCapacity`.

- [ ] **Step 3: Run** `forge test --match-path test/MiracleGame.t.sol` → FAIL.

- [ ] **Step 4: Implement** `MiracleGame.sol` per design §4. Key rules: phase from timestamps (`ranked` → Settled); `_capacity = equity * leverageBps / BPS` with `equity = max(0, startingCapital + realisedPnl)`; open adds `notional * riskWeightBps / BPS` to aum and settle subtracts the identical expression; `positionPnl = int(notional) * (int(exit) - int(entry)) / int(entry)`, negated for shorts; `createSeason` also requires `startingCapital <= 1e30`. Build view structs field by field to avoid stack-too-deep.

- [ ] **Step 5: Run** → PASS. `forge build --sizes` → MiracleGame < 24 KB.

---

### Task 3: Ranking, payouts, scores, claim

**Files:**
- Modify: `packages/contracts/src/MiracleGame.sol` (submitRanking, _distribute, claim)
- Test: `packages/contracts/test/Ranking.t.sol`

**Interfaces:**
- Consumes: Task 2 fixture and views.
- Produces: `submitRanking`, `claim`, `claimableOf`, `getRanking`, `scoreOf`, `PlayerView.rank`.

- [ ] **Step 1: Failing tests** (`Ranking.t.sol`):
  - brief §9.1 `test_joinAccountsFeeIntoPool` — three joins at 1 ether → `prizePool == 3 ether`, contract balance 3 ether.
  - brief §9.2 `test_rankingRejectsWrongOrder` (reverts `RankingOrderViolated(1)`), `test_rankingRejectsDuplicates` (`[a, a, b]` for 3 players → `DuplicatePlayer(a)`), `test_rankingRejectsWrongLength`, `test_rankingRejectsNonParticipant`, `test_rankingRejectsUnsettledPositions`, `test_rankingRejectsBeforeSettling`, `test_secondRankingRejected` (`WrongPhase`).
  - brief §9.3 `test_claimPaysCurveShare` — 3 players with pnl +10%, +5%, −5%, curve `[5000,3000,2000]`, pool 3 ether → 1.5 / 0.9 / 0.6 ether, balances change exactly, `paidOut` sums.
  - brief §9.4 `test_claimTwiceReverts` (`NothingToClaim`).
  - `test_fewerPlayersThanPlacesRenormalises` — 2 players, top-10 curve → shares 2500/(4300) and 1800/(4300) of pool.
  - `test_tiesSplitEqually` — 3 players all untraded, curve `[5000,3000,2000]` → each 1 ether (minus dust), all rank 1.
  - `test_feeGoesToOwner` — season with feeBps 1000 → owner claimable 10% of pool.
  - `test_scoresUpdateFromPercentile` — 3 players distinct equity → percentiles 100/50/0 → scores 50/25/0; next season leverage for top = 30000 + 50·700 = 65000.
  - `test_singlePlayerSeasonKeepsScore`.
  - `test_emptySeasonCanBeRanked`.
  - `test_claimReentrancyBlocked` — attacker contract re-enters `claim` in `receive` → outer claim reverts `TransferFailed`; honest EOA claim still pays.
  - `testFuzz_payoutsNeverExceedPool(uint8 players, uint256 seed, uint8 places)` — 1..40 players with seed-derived pnl via two-step settle, random non-increasing curve summing to 10000, random fee ≤ 2000; rank by equity; everyone + owner claims; assert `paidOut <= prizePool` and contract balance == `prizePool - paidOut`.

- [ ] **Step 2: Run** `forge test --match-path test/Ranking.t.sol` → FAIL.

- [ ] **Step 3: Implement** `submitRanking` (single pass, bitmap `uint256[] seen = new uint256[]((n >> 8) + 1)`), store `ranking`, then:

```solidity
uint256 fee = s.prizePool * s.feeBps / BPS;
if (fee > 0) _claimable[seasonId][owner] += fee;
uint256 distributable = s.prizePool - fee;
uint256 places = s.payoutBps.length < n ? s.payoutBps.length : n;
uint256 totalBps;
for (uint256 r; r < places; ++r) totalBps += s.payoutBps[r];
uint256 groupStart;
uint256 groupPrize;
for (uint256 i; i < n; ++i) {
    if (i < places) groupPrize += distributable * s.payoutBps[i] / totalBps;
    if (i + 1 < n && equities[i + 1] == equities[i]) continue;
    uint256 each = groupPrize / (i + 1 - groupStart);
    uint256 percentile = n >= 2 ? 100 * (2 * (n - 1) - (groupStart + i)) / (2 * (n - 1)) : 0;
    for (uint256 j = groupStart; j <= i; ++j) {
        address who = ordered[j];
        if (each > 0) _claimable[seasonId][who] += each;
        _players[seasonId][who].rank = uint32(groupStart + 1);
        if (n >= 2) scoreOf[who] = uint16((uint256(scoreOf[who]) + percentile) / 2);
    }
    groupStart = i + 1;
    groupPrize = 0;
}
```

`claim`: `nonReentrant`, phase Settled, zero the debt, `paidOut += amount`, then `call{value: amount}`, revert `TransferFailed` on failure, emit `Claimed`.

- [ ] **Step 4: Run** `forge test` (whole suite) → PASS.

---

### Task 4: Mainnet fork test on the real SPY feed

**Files:**
- Test: `packages/contracts/test/Fork.t.sol`

- [ ] **Step 1: Write test.** Read `RPC_URL` via `vm.envOr`; `vm.skip(true)` when empty. `vm.createSelectFork(rpc, <pinned block after SPY round 131>)`. Harness over SPY proxy `0x319724394D3A0e3669269846abE664Cd621f9f6A` (decimals 8). Known rounds: phase 1 agg 129 `updatedAt 1789458121`, agg 130 `updatedAt 1789476942` answer `76138125000`, agg 131 `updatedAt 1789482150`. With `T = 1789458122`: hint `(1<<64)+130` resolves to `761.38125e18`; hint `+131` reverts `HintNotFirstAfterTimestamp`; hint `+129` reverts `HintNotAfterTimestamp`. Also `lastRoundInPhase(spy, 1) >= 131` and phase 2 returns 0.
- [ ] **Step 2: Run** with and without `RPC_URL` → PASS / SKIP.

---

### Task 5: ABI export + shared hint search

**Files:**
- Create: `packages/contracts/scripts/export-abi.mjs`
- Create: `packages/shared/src/abi/MiracleGame.json`, `packages/shared/src/abi/MiracleGame.ts` (generated)
- Create: `packages/shared/src/rounds.ts`, Test: `packages/shared/src/rounds.test.ts`
- Modify: `packages/shared/src/index.ts` (append two export lines)

**Interfaces:**
- Produces:
  - `export const miracleGameAbi = [...] as const;`
  - `rounds.ts`:
    ```ts
    export interface RoundReading { readonly roundId: bigint; readonly updatedAt: bigint }
    export interface RoundReader {
      latestRound(): Promise<RoundReading>;
      /** null when the proxy returns an empty round or reverts */
      getRound(roundId: bigint): Promise<RoundReading | null>;
    }
    export type RoundHint =
      | { readonly kind: "round"; readonly roundId: bigint }
      | { readonly kind: "dead-feed"; readonly roundId: bigint }
      | { readonly kind: "pending" };
    export const DEAD_FEED_AFTER_SECONDS: bigint; // 604800n
    export function roundIdOf(phase: bigint, aggregatorRound: bigint): bigint;
    export function phaseOf(roundId: bigint): bigint;
    export function aggregatorRoundOf(roundId: bigint): bigint;
    export function findFirstRoundAfter(reader: RoundReader, timestamp: bigint, now: bigint): Promise<RoundHint>;
    ```

- [ ] **Step 1:** `export-abi.mjs` reads `out/MiracleGame.sol/MiracleGame.json`, writes abi JSON (2-space) and `MiracleGame.ts` with a generated-file header. Add `"abi": "forge build && node scripts/export-abi.mjs"` to package.json. Run it.
- [ ] **Step 2: Failing vitest** `rounds.test.ts` with an in-memory reader (phases → arrays of updatedAt):
  - finds first round ≥ T mid-phase; exact-equality counts;
  - `pending` when latest < T and grace not over; `dead-feed` with latest id after 7 days;
  - T before the first round of phase 1 → `(1,1)`;
  - boundary: phase 1 [100,200], phase 2 [400] and T=300 → `(2,1)`;
  - boundary where old phase has a later round: phase 1 [100,200,350], phase 2 [400], T=300 → `(1,3)`.
- [ ] **Step 3: Run** `pnpm --filter @miracle/shared test` → FAIL.
- [ ] **Step 4: Implement** (binary search over the current phase for the first `updatedAt >= T`; if it lands on aggregator round 1, walk previous phases: stop when the phase's last round is `< T`, otherwise binary-search that phase and continue only if it lands on round 1; `lastRoundInPhase` by galloping + binary search as in the contract). Append to `index.ts`: `export * from "./rounds";` and `export { miracleGameAbi } from "./abi/MiracleGame";`.
- [ ] **Step 5: Run** shared tests + `pnpm --filter @miracle/shared typecheck` → PASS.

---

### Task 6: Deploy + keeper scripts, mainnet beta deployment

**Files:**
- Create: `packages/contracts/script/Deploy.s.sol`, `script/CreateSeason.s.sol`, `scripts/keeper.ts`
- Modify: `packages/contracts/package.json` (deps `viem`, `tsx`, `@miracle/shared: workspace:*`; scripts `deploy`, `season`, `keeper`)
- Modify: `packages/shared/src/chain.ts` (`DEPLOYMENTS[4663].game`)

- [ ] **Step 1: `Deploy.s.sol`** — `vm.envUint("PRIVATE_KEY")`; deploy; `listAsset` × 8 with feeds from `assets.ts` and weights SGOV 5000, SLV 8000, SPY 10000, QQQ 12000, NVDA 15000, TSLA 18000, BTC 20000 (alwaysOpen), MSTR 25000; beta season per Global Constraints; log addresses.
- [ ] **Step 2: `CreateSeason.s.sol`** — env `GAME_ADDRESS`, `ENTRY_FEE_WEI` (default 0.01 ether), `ENTRY_OPENS_IN` (0), `ENTRY_DURATION` (3 days), `TRADING_DURATION` (14 days), `STARTING_CAPITAL` (100_000e18), `MAX_PARTICIPANTS` (100), `FEE_BPS` (0); top-10 curve.
- [ ] **Step 3: Dry run** `forge script script/Deploy.s.sol --fork-url $RPC_URL` with an anvil-funded key → simulation succeeds, 8 assets listed.
- [ ] **Step 4: `keeper.ts`** — env `RPC_URL`, `PRIVATE_KEY`, `GAME_ADDRESS`, `SEASON_ID`. Reads season, participants (pages of 200), positions, assets. For each unsettled position that is `Closing`, or `Open` once phase ≥ Settling: hints via `findFirstRoundAfter` (viem `readContract`; missing round → null); skip `pending`; `settlePositions` in chunks of 50. If phase is Settling and nothing unsettled: read `equityOf` for all, sort descending, `submitRanking`. `--dry-run` flag prints actions without sending.
- [ ] **Step 5: Deploy to mainnet** (needs owner's `.env`): `forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --slow`; verify on Blockscout (`forge verify-contract --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/`); read back `getSeason(1)` and `getAssets()` with `cast`.
- [ ] **Step 6:** write the address into `DEPLOYMENTS[4663].game`; run shared typecheck + tests.

---

### Task 7: Handoff

- [ ] Whole suite: `forge test`, `pnpm --filter @miracle/shared test`, `pnpm --filter @miracle/shared typecheck`.
- [ ] Add §10 "Статус" to `docs/CONTRACTS-DESIGN.md`: address, deploy block, beta season id and timings, how to run keeper.
- [ ] Report the one-line deviation summary to the owner for the frontend agent.
