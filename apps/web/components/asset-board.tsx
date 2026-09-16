"use client";

import { ASSETS, ASSET_SYMBOLS, feedStatusLabel } from "@miracle/shared";
import { StatusDot } from "./price-board";
import { LedBar, fractionOf } from "./led-bar";
import { quoteOf, usePrices } from "@/lib/prices/use-prices";

/**
 * The tradeable universe, compact, with live prices.
 *
 * It fills the screens where a player has nothing yet — before a wallet is
 * connected, and after connecting but before entering. Those were a single
 * line of text on black, which is the emptiest place in the product and the
 * first thing a new visitor sees.
 *
 * Read from the shared asset config, so it can never list something the
 * contract does not price, and from the shared price poller, so showing it
 * costs no extra requests.
 *
 * The landing's `RiskLadder` stays separate: it carries full names, asset
 * classes and an argument. What the two share is the LED bar, not the row.
 */

const DOTS = 10;
const MAX_WEIGHT = Math.max(...ASSET_SYMBOLS.map((s) => ASSETS[s].riskWeight));

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AssetBoard({ className = "" }: { className?: string }) {
  const { quotes, error } = usePrices();

  return (
    <section className={className} aria-label="What you can trade">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm text-muted">What you can trade</h2>
        <span className="text-xs text-faint">
          {error ? "Prices unavailable" : "Live from Chainlink"}
        </span>
      </div>

      <ul className="mt-5 grid gap-x-10 gap-y-0 sm:grid-cols-2">
        {ASSET_SYMBOLS.map((symbol) => {
          const asset = ASSETS[symbol];
          const quote = quoteOf(quotes, symbol);

          return (
            <li
              key={symbol}
              className="flex items-center gap-3 border-b border-ivory/8 py-3 last:border-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-0"
            >
              <span className="w-12 shrink-0 text-sm text-text">{symbol}</span>

              {/* Fixed slot: the row must not jump when "—" becomes a price. */}
              <span className="tabular min-w-[5.25rem] text-right text-sm text-muted">
                {quote ? `$${formatPrice(quote.price)}` : "—"}
              </span>

              <span
                className="shrink-0"
                title={quote ? feedStatusLabel(quote.status) : "Loading"}
              >
                {quote ? <StatusDot status={quote.status} /> : null}
              </span>

              <LedBar
                fraction={fractionOf(asset.riskWeight, MAX_WEIGHT)}
                total={DOTS}
                className="ml-auto"
                label={`Risk weight ${asset.riskWeight.toFixed(1)} times`}
              />

              <span className="tabular w-10 shrink-0 text-right text-xs text-faint">
                {asset.riskWeight.toFixed(1)}×
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 max-w-xl text-xs leading-relaxed text-faint">
        The bar is how much capacity a position eats, not how much it can make.
        Ten thousand dollars of Strategy uses five times the room that ten thousand
        of Treasury bills does.
      </p>
    </section>
  );
}
