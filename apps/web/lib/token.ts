import { ROBINHOOD_MAINNET, type Address } from "@miracle/shared";

/**
 * The Miracle token, in one place.
 *
 * There is no token yet. When there is, filling `address` in here is the whole
 * change: the page switches from "nothing is deployed" to publishing the
 * contract address, and the explorer link builds itself.
 *
 * Fields that are still undecided are `null` rather than filled with a
 * plausible-looking placeholder. The page leaves out whatever is null, so
 * nothing it shows is ever a guess — which is the only way the page can be
 * useful for checking an address against.
 */
export interface TokenInfo {
  /** The one contract address. Null until it is actually deployed. */
  readonly address: Address | null;
  readonly chainId: number;
  readonly symbol: string | null;
  readonly decimals: number | null;
  /** Written as a plain string so nothing is lost to floating point. */
  readonly totalSupply: string | null;
  readonly launchedAt: Date | null;
}

/*
  Every field below was read back from the contract itself on Robinhood Chain,
  not copied from an announcement — this page is what people check an address
  against, so nothing on it may be a figure someone typed from memory.

  The address is in its EIP-55 checksummed form, which is what explorers show.
  It is the same address as the all-lowercase spelling; the capitals are a
  checksum, so a single mistyped character stops matching.
*/
export const MIRACLE_TOKEN: TokenInfo = {
  address: "0x8B5af2945A6126a6195aa6E5f31661Be026dA9a7",
  chainId: ROBINHOOD_MAINNET.id,
  symbol: "MRCL",
  decimals: 18,
  totalSupply: "1,000,000,000",
  // Not published: the deployment moment is not something this page needs, and
  // it is not going to be guessed.
  launchedAt: null,
};

export function isLaunched(token: TokenInfo): token is TokenInfo & { address: Address } {
  return token.address !== null;
}
