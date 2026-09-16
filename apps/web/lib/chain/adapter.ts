import { DEPLOYMENTS, type Address, type MiracleAdapter, type PriceQuote } from "@miracle/shared";
import { activeNetwork } from "./client";
import { ContractAdapter } from "./contract-adapter";
import { mockAdapter } from "./mock-adapter";

/**
 * Which adapter the interface is talking to, and how it decides.
 *
 * There is exactly one rule: if a game contract address is configured, the
 * screens read the chain. Otherwise the only thing available is the mock, and
 * the only page allowed to ask for it is the demo — which labels itself.
 *
 * The interface never states that it is live or that it is a demo from a
 * hardcoded string. It asks the adapter what it is, so the claim cannot drift
 * from the truth.
 */

/**
 * How a screen is getting its data. `chain` is the product; `mock` is the
 * practice board — local, nothing at stake, and it says so.
 */
export type AdapterMode = "live" | "demo";

export interface GameAdapter extends MiracleAdapter {
  readonly kind: "chain" | "mock";
  /** Prompts for an account. Null if the user declined or there is none. */
  connect(): Promise<Address | null>;
  /** Reconnects without prompting, if permission was already given. */
  restore(): Promise<Address | null>;
  disconnect(): void;
  /** Live prices, for adapters that price open positions themselves. */
  setQuotes(quotes: readonly PriceQuote[]): void;
}

/**
 * A local override exists so the real adapter can be developed against a test
 * deployment without that address ever reaching `DEPLOYMENTS`, which holds
 * only what players should see.
 */
const override = process.env.NEXT_PUBLIC_GAME_ADDRESS as Address | undefined;

export const GAME_ADDRESS: Address | null =
  override ?? DEPLOYMENTS[activeNetwork.id]?.game ?? null;

const chainAdapter: GameAdapter | null = GAME_ADDRESS
  ? new ContractAdapter(GAME_ADDRESS)
  : null;

/** True when the contract is deployed and the screens are reading it. */
export const LIVE = chainAdapter !== null;

export function adapterFor(mode: AdapterMode): GameAdapter {
  if (mode === "demo") return mockAdapter;
  return chainAdapter ?? mockAdapter;
}
