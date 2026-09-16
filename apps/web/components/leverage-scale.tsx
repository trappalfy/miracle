"use client";

import { useId, useState } from "react";
import { MAX_LEVERAGE, MIN_LEVERAGE, leverageFromScore } from "@miracle/shared";

/**
 * Leverage, shown by letting you move the thing that causes it.
 *
 * The number comes from the real `leverageFromScore`, so if the formula is
 * retuned to match the contract this section retunes with it.
 *
 * The slider counts whole ticks rather than stepping in score directly:
 * leverage rises 0.07 per point of score, so seven ticks per point puts the
 * displayed figure on exact 0.01 increments. Integer steps also mean the ends
 * are reachable — a fractional `step` accumulates rounding error and can leave
 * the maximum permanently out of reach.
 *
 * Built on a native range input: dragging, arrow keys, Home/End and screen
 * reader announcements all come for free, and the visible parts are painted
 * over an invisible one.
 */

const TICKS_PER_POINT = 7;
const MAX_TICKS = 100 * TICKS_PER_POINT;

export function LeverageScale() {
  const [ticks, setTicks] = useState(MAX_TICKS / 2);
  const labelId = useId();

  const leverage = leverageFromScore(ticks / TICKS_PER_POINT);
  const progress = (ticks / MAX_TICKS) * 100;

  return (
    <section
      className="led-section border-t border-ivory/10"
      style={{ "--bloom-x": "88%", "--bloom-y": "82%" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[22rem_1fr] lg:gap-20">
          <div>
            <h2
              id={labelId}
              className="text-3xl font-light leading-tight tracking-[-0.02em]"
            >
              Leverage is earned, not bought
            </h2>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              Because every player starts with identical capital, the only thing that
              carries between seasons is your record. It buys room to take bigger
              positions — from {MIN_LEVERAGE}× at the start to {MAX_LEVERAGE}× for a
              perfect one.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              No amount of money moves this number. The only way up is to have traded
              well before. Drag the scale to see it.
            </p>
          </div>

          <div className="lg:pt-2">
            <span className="tabular block text-[clamp(3rem,8vw,5rem)] font-light leading-none tracking-[-0.03em]">
              {leverage.toFixed(2)}×
            </span>

            <div className="relative mt-10 h-7 select-none">
              <span className="led-track absolute inset-x-0 top-1/2 -translate-y-1/2" />
              <span
                className="led-lit absolute left-0 top-1/2 -translate-y-1/2"
                style={{ width: `${progress}%` }}
              />

              <input
                type="range"
                min={0}
                max={MAX_TICKS}
                step={1}
                value={ticks}
                onChange={(event) => setTicks(Number(event.target.value))}
                aria-labelledby={labelId}
                aria-valuetext={`${leverage.toFixed(2)} times leverage`}
                className="peer absolute inset-0 w-full cursor-ew-resize opacity-0"
              />

              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-ivory peer-focus-visible:shadow-[0_0_0_3px_var(--color-steel)]"
                style={{ left: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex justify-between text-xs text-faint">
              <span>No record yet</span>
              <span>Perfect record</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
