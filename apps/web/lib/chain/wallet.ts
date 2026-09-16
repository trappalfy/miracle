import {
  createWalletClient,
  custom,
  type Address,
  type EIP1193Provider,
  type WalletClient,
} from "viem";
import { activeChain, activeNetwork } from "./client";

/**
 * The browser's own wallet, over EIP-1193.
 *
 * An injected wallet needs no account with us and no third-party key, so the
 * game is playable the day the contract is live. An embedded-wallet provider
 * can be added beside this later without the adapter noticing: everything
 * below hands back a viem `WalletClient` and nothing else depends on where it
 * came from.
 */

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export class WalletError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WalletError";
  }
}

/** EIP-1193: the user closed the prompt or said no. Not worth an error banner. */
export function isUserRejection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 4001
  );
}

export function injectedProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function provider(): EIP1193Provider {
  const found = injectedProvider();
  if (!found) {
    throw new WalletError(
      "No wallet found in this browser. Install one, or open this page in a wallet's own browser.",
    );
  }
  return found;
}

/** Accounts already granted, without prompting. Empty if none. */
export async function silentAccounts(): Promise<Address[]> {
  const found = injectedProvider();
  if (!found) return [];

  try {
    return (await found.request({ method: "eth_accounts" })) as Address[];
  } catch {
    return [];
  }
}

export async function requestAccounts(): Promise<Address[]> {
  return (await provider().request({ method: "eth_requestAccounts" })) as Address[];
}

/**
 * Puts the wallet on Robinhood Chain, adding it if the wallet has never heard
 * of it. Without this a transaction would be signed for whatever chain the
 * wallet happened to be on.
 */
export async function ensureChain(): Promise<void> {
  const found = provider();
  const chainIdHex = `0x${activeChain.id.toString(16)}`;

  try {
    await found.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex as `0x${string}` }],
    });
    return;
  } catch (error) {
    // 4902: unrecognised chain. Anything else is a real failure.
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code: unknown }).code
        : null;
    if (code !== 4902) throw error;
  }

  await found.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: chainIdHex as `0x${string}`,
        chainName: activeNetwork.name,
        nativeCurrency: activeNetwork.nativeCurrency,
        rpcUrls: [activeNetwork.publicRpcUrl],
        blockExplorerUrls: [activeNetwork.explorerUrl],
      },
    ],
  });
}

export function walletClientFor(account: Address): WalletClient {
  return createWalletClient({
    account,
    chain: activeChain,
    transport: custom(provider()),
  });
}

/** Fires when the user switches account or disconnects in the wallet itself. */
export function onAccountsChanged(listener: (accounts: Address[]) => void): () => void {
  const found = injectedProvider();
  if (!found?.on) return () => {};

  const handler = (accounts: unknown) => listener(accounts as Address[]);
  found.on("accountsChanged", handler);

  return () => found.removeListener?.("accountsChanged", handler);
}
