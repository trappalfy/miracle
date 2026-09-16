"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * A row of LEDs used as a meter.
 *
 * Two layers share one 7px grid so the lit dots land exactly on the unlit
 * ones: the track holds every dot, the lit layer is clipped to a whole number
 * of them. Drawn as background gradients rather than elements — a leaderboard
 * of forty rows would otherwise be hundreds of nodes.
 *
 * The count is whole dots, never a percentage. A percentage width would slice
 * the dot at the edge in half, and a half-lit dot reads as a rendering bug
 * rather than as a value.
 */

const DOT_PX = 7;

export type LedTone = "ivory" | "gain" | "loss" | "steel";

const TONE: Record<LedTone, string> = {
  ivory: "rgba(242, 235, 221, 0.92)",
  gain: "rgba(111, 211, 155, 0.92)",
  loss: "rgba(224, 86, 75, 0.92)",
  steel: "rgba(110, 140, 168, 0.92)",
};

export interface LedBarProps {
  /**
   * How much of the scale is filled, 0…1. Dots are lit by rounding this to a
   * whole number of them, so the meter never shows half a dot.
   */
  readonly fraction: number;
  /** Fixed dot count. Omit to fill the available width instead. */
  readonly total?: number;
  readonly tone?: LedTone;
  readonly className?: string;
  /**
   * What the meter says, for anyone who cannot see it. Without this the bar is
   * decoration and is hidden from screen readers instead.
   */
  readonly label?: string;
}

/**
 * Dots that fit the element's own width, remeasured when it changes.
 *
 * A bar asked to fill its container cannot know its dot count up front, and a
 * percentage width would slice the last dot in half. Measuring keeps every dot
 * whole at any width. Returns null until measured, so nothing renders at the
 * wrong size first.
 */
function useFittedDots(enabled: boolean): [React.RefObject<HTMLSpanElement | null>, number | null] {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [dots, setDots] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;

    const measure = () => setDots(Math.max(1, Math.floor(element.clientWidth / DOT_PX)));
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return [ref, dots];
}

export function LedBar({
  fraction,
  total,
  tone = "ivory",
  className = "",
  label,
}: LedBarProps) {
  const fills = total === undefined;
  const [ref, fitted] = useFittedDots(fills);

  const dots = fills ? fitted : total;
  const width = fills ? "100%" : (total ?? 0) * DOT_PX;
  const safe = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const clamped = dots === null ? 0 : Math.round(safe * dots);

  return (
    <span
      ref={ref}
      className={`relative block ${fills ? "w-full" : "shrink-0"} ${className}`}
      style={fills ? undefined : { width }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="led-track block" style={{ width }} />
      <span
        className="led-lit absolute inset-y-0 left-0"
        style={
          {
            width: clamped * DOT_PX,
            "--led-lit-color": TONE[tone],
          } as React.CSSProperties
        }
      />
    </span>
  );
}

/**
 * A value's place on a scale, as 0…1. Zero rather than NaN when the scale has
 * no width — a season where nobody has moved yet lights no dots, not every dot.
 */
export function fractionOf(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / max));
}
