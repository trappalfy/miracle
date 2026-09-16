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

export const MIRACLE_TOKEN: TokenInfo = {
  address: null,
  chainId: ROBINHOOD_MAINNET.id,
  symbol: null,
  decimals: null,
  totalSupply: null,
  launchedAt: null,
};

export function isLaunched(token: TokenInfo): token is TokenInfo & { address: Address } {
  return token.address !== null;
}
