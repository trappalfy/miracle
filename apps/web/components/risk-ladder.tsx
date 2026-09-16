"use client";

import { ASSETS, ASSET_SYMBOLS, feedStatusLabel } from "@miracle/shared";
import { StatusDot } from "./price-board";
import { quoteOf, usePrices } from "@/lib/prices/use-prices";

const CLASS_LABEL: Record<string, string> = {
  treasury: "Treasuries",
  commodity: "Commodity",
  equity: "Equity",
  crypto: "Crypto",
};

/** Dots per bar, on the same 7px grid the section background uses. */
const DOTS = 20;
const DOT_PX = 7;
const MAX_WEIGHT = Math.max(...ASSET_SYMBOLS.map((s) => ASSETS[s].riskWeight));

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * The tradeable universe, drawn from the shared asset config — the same
 * weights the contract enforces, so this can never drift from the game.
 *
 * The bars are rows of LEDs rather than lines: the decoration and the data are
 * the same thing, which is the only kind of ornament this product should have.
 */
export function RiskLadder() {
  const { quotes } = usePrices();

  return (
    <section
      className="led-section border-t border-ivory/10"
      style={{ "--bloom-x": "6%", "--bloom-y": "42%" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[22rem_1fr] lg:gap-20">
          <div>
            <h2 className="text-3xl font-light leading-tight tracking-[-0.02em]">
              Eight assets, weighted by how much trouble they can cause
            </h2>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              A position consumes capacity in proportion to its risk weight. Ten
              thousand dollars of Strategy eats five times the room that ten thousand
              of Treasury bills does, so where you put your capital matters as much as
              whether you were right.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Every one of these has a live Chainlink feed on Robinhood Chain. We do
              not list anything we cannot price.
            </p>
          </div>

          <ul>
            {ASSET_SYMBOLS.map((symbol) => {
              const asset = ASSETS[symbol];
              const quote = quoteOf(quotes, symbol);
              const lit = Math.round((asset.riskWeight / MAX_WEIGHT) * DOTS);

              return (
                <li
                  key={symbol}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ivory/8 py-3.5 last:border-0"
                >
                  <span className="w-12 shrink-0 text-sm text-text sm:w-14">
                    {symbol}
                  </span>

                  <span
                    className="relative shrink-0"
                    style={{ width: DOTS * DOT_PX }}
                    role="img"
                    aria-label={`Risk weight ${asset.riskWeight.toFixed(1)} times`}
                  >
                    <span className="led-track block" style={{ width: DOTS * DOT_PX }} />
                    <span
                      className="led-lit absolute inset-y-0 left-0"
                      style={{ width: lit * DOT_PX }}
                    />
                  </span>

                  {/* Wraps to its own line on narrow screens; inline from sm up. */}
                  <span className="order-last flex w-full min-w-0 items-baseline gap-2.5 pl-12 text-xs sm:order-none sm:w-auto sm:flex-1 sm:pl-0">
                    <span className="tabular shrink-0 text-text">
                      {quote ? `$${formatPrice(quote.price)}` : "—"}
                    </span>
                    {quote && (
                      <span className="shrink-0 self-center" title={feedStatusLabel(quote.status)}>
                        <StatusDot status={quote.status} />
                      </span>
                    )}
                    <span className="truncate text-faint">
                      {asset.name}
                      <span className="mx-1.5 text-ivory/25">·</span>
                      {CLASS_LABEL[asset.assetClass]}
                    </span>
                  </span>

                  <span className="tabular ml-auto w-11 shrink-0 text-right text-sm text-muted sm:ml-0">
                    {asset.riskWeight.toFixed(1)}×
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
