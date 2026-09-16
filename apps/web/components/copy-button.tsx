"use client";

import { useState } from "react";

/**
 * Copies a value and says so.
 *
 * The clipboard can be refused — an insecure origin, a locked-down browser —
 * so this never becomes the only way to get the text. Whatever it copies is
 * also selectable on the page.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-control border border-ivory/20 px-3 py-1.5 text-xs text-muted transition-colors hover:border-ivory/40 hover:text-text"
    >
      <span aria-hidden="true">
        {failed ? "Select it instead" : copied ? "Copied" : "Copy"}
      </span>
      <span className="sr-only">
        {failed
          ? `Could not copy the ${label}. Select it on the page instead.`
          : copied
            ? `${label} copied`
            : `Copy ${label}`}
      </span>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
