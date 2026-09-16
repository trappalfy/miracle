"use client";

import { ASSETS, ASSET_SYMBOLS, feedStatusLabel, type PriceQuote } from "@miracle/shared";
import { quoteOf, usePrices } from "@/lib/prices/use-prices";

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function StatusDot({ status }: { status: PriceQuote["status"] }) {
  const tone =
    status === "live" ? "bg-gain" : status === "market-closed" ? "bg-faint" : "bg-warn";
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />;
}

function Quote({
  symbol,
  quote,
  duplicate,
}: {
  symbol: string;
  quote: PriceQuote | undefined;
  duplicate: boolean;
}) {
  return (
    <li
      // Spacing lives on the item, not as a flex gap: the loop only lands
      // seamlessly if every item occupies an identical slot width.
      className="flex shrink-0 items-baseline pr-8"
      aria-hidden={duplicate || undefined}
    >
      <span className="text-xs text-muted">{symbol}</span>
      {/* Fixed slot: without it the loop jumps when "—" becomes a real price. */}
      <span className="tabular ml-2 min-w-[4.75rem] text-right text-sm text-text">
        {quote ? `$${formatPrice(quote.price)}` : "—"}
      </span>
      {quote && (
        <span className="ml-2 self-center" title={feedStatusLabel(quote.status)}>
          <StatusDot status={quote.status} />
        </span>
      )}
      {!duplicate && (
        <span className="sr-only">
          {ASSETS[symbol as keyof typeof ASSETS].name}
          {quote ? `, ${feedStatusLabel(quote.status)}` : ", loading"}
        </span>
      )}
    </li>
  );
}

/**
 * The ticker tape along the base of the hero.
 *
 * Two identical copies of the quotes slide by exactly one copy's width, so the
 * loop never shows a seam. It pauses on hover and on keyboard focus, and stops
 * entirely under `prefers-reduced-motion`, where the strip becomes scrollable
 * by hand instead.
 */
export function PriceBoard() {
  const { quotes, error } = usePrices();
  const copies = [false, true];

  return (
    <section
      aria-label="Live prices from Chainlink"
      className="ticker flex items-center gap-6 overflow-hidden"
    >
      <span className="hidden shrink-0 text-xs leading-snug text-faint lg:block">
        Read from Chainlink,
        <br />
        by your browser
      </span>

      {error && quotes.length === 0 ? (
        <p className="truncate text-xs text-warn" title={error}>
          Price feeds unavailable — {error}
        </p>
      ) : (
        <div className="ticker-fade min-w-0 flex-1 overflow-hidden">
          <ul className="ticker-track flex w-max items-center py-1">
            {copies.map((duplicate) =>
              ASSET_SYMBOLS.map((symbol) => (
                <Quote
                  key={`${duplicate ? "b" : "a"}-${symbol}`}
                  symbol={symbol}
                  quote={quoteOf(quotes, symbol)}
                  duplicate={duplicate}
                />
              )),
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
