import { createPublicClient, defineChain, http } from "viem";
import { ROBINHOOD_MAINNET, ROBINHOOD_TESTNET, type NetworkSpec } from "@miracle/shared";

/**
 * Read-only access to Robinhood Chain.
 *
 * The public RPC is rate limited — hard enough that a handful of requests in
 * quick succession gets the caller cut off at the edge. It is fine for a local
 * poke around and unusable for anything with visitors, so production must set
 * NEXT_PUBLIC_RPC_URL to an Alchemy endpoint.
 *
 * Requests are batched at the JSON-RPC layer rather than through a Multicall3
 * contract: reading eight feeds becomes one HTTP request without depending on
 * a helper contract being deployed here.
 */

function toViemChain(spec: NetworkSpec) {
  return defineChain({
    id: spec.id,
    name: spec.name,
    nativeCurrency: spec.nativeCurrency,
    rpcUrls: { default: { http: [spec.publicRpcUrl] } },
    blockExplorers: {
      default: { name: "Blockscout", url: spec.explorerUrl },
    },
  });
}

export const robinhoodMainnet = toViemChain(ROBINHOOD_MAINNET);
export const robinhoodTestnet = toViemChain(ROBINHOOD_TESTNET);

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? ROBINHOOD_MAINNET.id);

export const activeChain =
  CHAIN_ID === ROBINHOOD_TESTNET.id ? robinhoodTestnet : robinhoodMainnet;

export const activeNetwork: NetworkSpec =
  CHAIN_ID === ROBINHOOD_TESTNET.id ? ROBINHOOD_TESTNET : ROBINHOOD_MAINNET;

/** True when running against the rate-limited public endpoint. */
export const usingPublicRpc = !process.env.NEXT_PUBLIC_RPC_URL;

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? activeNetwork.publicRpcUrl, {
    batch: { wait: 16 },
    retryCount: 2,
    retryDelay: 400,
    timeout: 12_000,
  }),
});
