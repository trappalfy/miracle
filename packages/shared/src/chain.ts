import type { Address } from "./types";

/**
 * Robinhood Chain network details, verified against the live RPC and the
 * official docs. Measured on mainnet: ~0.1s blocks, ~0.073 gwei gas, so an
 * on-chain trade costs roughly 0.0000073 ETH.
 *
 * The public RPCs are rate limited and fine for reads during development.
 * Production should point at Alchemy via NEXT_PUBLIC_RPC_URL.
 */
export interface NetworkSpec {
  readonly id: number;
  readonly name: string;
  readonly publicRpcUrl: string;
  readonly explorerUrl: string;
  readonly nativeCurrency: { name: string; symbol: string; decimals: number };
}

const ETH = { name: "Ether", symbol: "ETH", decimals: 18 } as const;

export const ROBINHOOD_MAINNET: NetworkSpec = {
  id: 4663,
  name: "Robinhood Chain",
  publicRpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  nativeCurrency: ETH,
};

export const ROBINHOOD_TESTNET: NetworkSpec = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  publicRpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com",
  nativeCurrency: ETH,
};

export const NETWORKS: Record<number, NetworkSpec> = {
  [ROBINHOOD_MAINNET.id]: ROBINHOOD_MAINNET,
  [ROBINHOOD_TESTNET.id]: ROBINHOOD_TESTNET,
};

/**
 * Contract addresses, filled in per network once the contracts agent deploys.
 * Empty until then — the mock adapter does not read these.
 */
export interface DeploymentAddresses {
  readonly priceRegistry: Address | null;
  readonly scoreRegistry: Address | null;
  readonly season: Address | null;
  readonly game: Address | null;
  readonly settlement: Address | null;
}

const UNDEPLOYED: DeploymentAddresses = {
  priceRegistry: null,
  scoreRegistry: null,
  season: null,
  game: null,
  settlement: null,
};

/**
 * Only contracts players should see: the /token page links to these and the
 * adapter plays against them. Everything lives in the single MiracleGame
 * contract; the other slots stay empty. Testnet has no Chainlink feeds, so
 * nothing is deployed there.
 *
 * Mainnet stays empty until the first full season is deployed (see
 * FIRST_SEASON in launch.ts). The integration deployment used to wire the
 * real adapter is deliberately not listed here — its address is in
 * docs/CONTRACTS-DESIGN.md §10; point a local override at it instead.
 */
export const DEPLOYMENTS: Record<number, DeploymentAddresses> = {
  [ROBINHOOD_MAINNET.id]: UNDEPLOYED,
  [ROBINHOOD_TESTNET.id]: UNDEPLOYED,
};

export function networkById(chainId: number): NetworkSpec | null {
  return NETWORKS[chainId] ?? null;
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const network = networkById(chainId);
  return network ? `${network.explorerUrl}/tx/${hash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const network = networkById(chainId);
  return network ? `${network.explorerUrl}/address/${address}` : null;
}
