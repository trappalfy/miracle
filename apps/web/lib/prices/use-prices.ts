"use client";

import { useSyncExternalStore } from "react";
import type { PriceQuote } from "@miracle/shared";
import { readAllPrices } from "./chainlink";

/**
 * One price poller for the whole page.
 *
 * Several components want quotes (the hero ticker, the risk ladder). Each
 * running its own interval would double the load on an RPC that is already
 * rate limited, so they share a single module-level poller that runs only
 * while something is subscribed.
 */

const POLL_INTERVAL_MS = 15_000;

export interface PricesState {
  readonly quotes: readonly PriceQuote[];
  readonly error: string | null;
  readonly loading: boolean;
}

const INITIAL: PricesState = { quotes: [], error: null, loading: true };

let state: PricesState = INITIAL;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function setState(next: PricesState): void {
  state = next;
  for (const listener of listeners) listener();
}

async function poll(): Promise<void> {
  try {
    const quotes = await readAllPrices();
    setState({ quotes, error: null, loading: false });
  } catch (error) {
    setState({
      quotes: state.quotes, // keep the last good quotes rather than blanking the page
      error: error instanceof Error ? error.message : "Could not reach the price feeds.",
      loading: false,
    });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!timer) {
    void poll();
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function usePrices(): PricesState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL, // server render: nothing has been read yet
  );
}

export function quoteOf(
  quotes: readonly PriceQuote[],
  symbol: string,
): PriceQuote | undefined {
  return quotes.find((quote) => quote.symbol === symbol);
}
