/**
 * Settles a Miracle season.
 *
 * Positions settle against the first oracle round after they opened and after
 * they closed (or after trading ended), and the contract only verifies round
 * hints — it does not search for them. This script finds the hints, settles
 * every position that can be settled, and once trading is over and nothing is
 * left unsettled, submits the ranking so payouts become claimable.
 *
 * Anyone can run it; the contract trusts none of its inputs. Safe to re-run:
 * settled positions are skipped and a ranking is submitted only once.
 *
 *   pnpm --filter @miracle/contracts keeper -- --season 1 [--dry-run]
 *
 * Environment (packages/contracts/.env): RPC_URL, GAME_ADDRESS, PRIVATE_KEY
 * (not needed with --dry-run).
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ROBINHOOD_MAINNET,
  findFirstRoundAfter,
  miracleGameAbi,
  type RoundHint,
  type RoundReader,
} from "@miracle/shared";

const PHASE = { Upcoming: 0, Entry: 1, Live: 2, Settling: 3, Settled: 4 } as const;
const STATUS = { Open: 0, Closing: 1, Settled: 2 } as const;
const SETTLE_BATCH = 50;
const PAGE = 200n;

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

interface SettleRequest {
  player: Address;
  positionId: bigint;
  entryRoundHint: bigint;
  exitRoundHint: bigint;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const dryRun = process.argv.includes("--dry-run");
const seasonId = BigInt(required("--season", arg("season")));
const game = required("GAME_ADDRESS", process.env.GAME_ADDRESS) as Address;
const rpcUrl = process.env.RPC_URL || ROBINHOOD_MAINNET.publicRpcUrl;

const chain = defineChain({
  id: ROBINHOOD_MAINNET.id,
  name: ROBINHOOD_MAINNET.name,
  nativeCurrency: ROBINHOOD_MAINNET.nativeCurrency,
  rpcUrls: { default: { http: [rpcUrl] } },
});
const transport = http(rpcUrl, { batch: { wait: 16 }, retryCount: 5, retryDelay: 1_000 });
const client = createPublicClient({ chain, transport });

function isRevert(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    error.walk((e) => e instanceof ContractFunctionRevertedError || e instanceof ContractFunctionZeroDataError) !==
      null
  );
}

/** A cached reader over one Chainlink proxy. */
function feedReader(feed: Address): RoundReader {
  const rounds = new Map<bigint, { roundId: bigint; updatedAt: bigint } | null>();
  return {
    async latestRound() {
      const [roundId, , , updatedAt] = await client.readContract({
        address: feed,
        abi: AGGREGATOR_ABI,
        functionName: "latestRoundData",
      });
      return { roundId, updatedAt };
    },
    async getRound(roundId) {
      if (rounds.has(roundId)) return rounds.get(roundId)!;
      let reading: { roundId: bigint; updatedAt: bigint } | null = null;
      try {
        const [returnedId, , , updatedAt] = await client.readContract({
          address: feed,
          abi: AGGREGATOR_ABI,
          functionName: "getRoundData",
          args: [roundId],
        });
        if (returnedId === roundId && updatedAt !== 0n) reading = { roundId, updatedAt };
      } catch (error) {
        if (!isRevert(error)) throw error;
      }
      rounds.set(roundId, reading);
      return reading;
    },
  };
}

async function readSeason() {
  return client.readContract({ address: game, abi: miracleGameAbi, functionName: "getSeason", args: [seasonId] });
}

async function readParticipants(): Promise<Address[]> {
  const all: Address[] = [];
  for (let offset = 0n; ; offset += PAGE) {
    const page = await client.readContract({
      address: game,
      abi: miracleGameAbi,
      functionName: "getParticipants",
      args: [seasonId, offset, PAGE],
    });
    all.push(...page);
    if (BigInt(page.length) < PAGE) return all;
  }
}

function describe(hint: RoundHint): string {
  return hint.kind === "pending" ? "pending" : `${hint.kind} ${hint.roundId}`;
}

function signer() {
  const account = privateKeyToAccount(required("PRIVATE_KEY", process.env.PRIVATE_KEY) as Hex);
  return { account, wallet: createWalletClient({ account, chain, transport }) };
}

async function confirm(label: string, hash: Hex): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`${label}: ${hash} (${receipt.status})`);
  if (receipt.status !== "success") throw new Error(`${label} reverted`);
}

async function sendSettlePositions(batch: readonly SettleRequest[]): Promise<void> {
  if (dryRun) return console.log(`[dry-run] would settle ${batch.length} position(s)`);
  const { account, wallet } = signer();
  const { request } = await client.simulateContract({
    account,
    address: game,
    abi: miracleGameAbi,
    functionName: "settlePositions",
    args: [seasonId, batch],
  });
  await confirm("settlePositions", await wallet.writeContract(request));
}

async function sendRanking(ordered: readonly Address[]): Promise<void> {
  if (dryRun) return console.log("[dry-run] would submit this ranking");
  const { account, wallet } = signer();
  const { request } = await client.simulateContract({
    account,
    address: game,
    abi: miracleGameAbi,
    functionName: "submitRanking",
    args: [seasonId, ordered],
  });
  await confirm("submitRanking", await wallet.writeContract(request));
}

async function settle(participants: readonly Address[]): Promise<number> {
  const season = await readSeason();
  const now = (await client.getBlock()).timestamp;
  const feeds = new Map<string, RoundReader>();
  for (const asset of await client.readContract({ address: game, abi: miracleGameAbi, functionName: "getAssets" })) {
    feeds.set(asset.symbol, feedReader(asset.feed));
  }

  const requests: SettleRequest[] = [];
  let pending = 0;

  for (const player of participants) {
    const positions = await client.readContract({
      address: game,
      abi: miracleGameAbi,
      functionName: "getPositions",
      args: [seasonId, player],
    });

    for (const [index, position] of positions.entries()) {
      if (position.status === STATUS.Settled) continue;
      if (position.status === STATUS.Open && now < season.tradingEndsAt) continue;

      const feed = feeds.get(position.symbol)!;
      const exitAfter = position.status === STATUS.Closing ? position.closedAt : season.tradingEndsAt;
      const entry = await findFirstRoundAfter(feed, position.openedAt, now);
      const exit = await findFirstRoundAfter(feed, exitAfter, now);

      if (entry.kind === "pending" || exit.kind === "pending") {
        pending++;
        console.log(`${player} #${index}: waiting for oracle (entry ${describe(entry)}, exit ${describe(exit)})`);
        continue;
      }
      console.log(`${player} #${index}: entry ${describe(entry)}, exit ${describe(exit)}`);
      requests.push({ player, positionId: BigInt(index), entryRoundHint: entry.roundId, exitRoundHint: exit.roundId });
    }
  }

  for (let i = 0; i < requests.length; i += SETTLE_BATCH) {
    await sendSettlePositions(requests.slice(i, i + SETTLE_BATCH));
  }
  return pending;
}

async function rank(participants: readonly Address[]): Promise<void> {
  const equities = await Promise.all(
    participants.map((player) =>
      client.readContract({
        address: game,
        abi: miracleGameAbi,
        functionName: "equityOf",
        args: [seasonId, player],
      }),
    ),
  );
  const ordered = participants
    .map((player, i) => ({ player, equity: equities[i]! }))
    .sort((a, b) => (a.equity === b.equity ? 0 : a.equity > b.equity ? -1 : 1))
    .map((entry) => entry.player);

  ordered.forEach((player, i) => console.log(`${i + 1}. ${player}`));
  await sendRanking(ordered);
}

async function main(): Promise<void> {
  const season = await readSeason();
  console.log(`Season ${seasonId}: phase ${season.phase}, ${season.participants} participants`);

  if (season.phase < PHASE.Live || season.phase === PHASE.Settled) {
    console.log("Nothing to settle.");
    return;
  }

  const participants = await readParticipants();
  const pending = await settle(participants);

  if ((await readSeason()).phase !== PHASE.Settling) return;
  if (pending > 0) {
    console.log(`${pending} position(s) still waiting for the oracle; ranking later.`);
    return;
  }

  // In a dry run nothing was settled, so the check would always fail; show the would-be order instead.
  if (!dryRun) {
    const players = await Promise.all(
      participants.map((player) =>
        client.readContract({ address: game, abi: miracleGameAbi, functionName: "getPlayer", args: [seasonId, player] }),
      ),
    );
    if (players.some((p) => p.unsettledPositions > 0)) {
      console.log("Some positions are still unsettled; ranking later.");
      return;
    }
  }
  await rank(participants);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
