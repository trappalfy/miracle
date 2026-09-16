/**
 * The Miracle lockup: the wordmark plus the two sparkles from the logo.
 * Set in the display face rather than shipped as an image so it stays crisp
 * at any size and inherits the surrounding colour.
 */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 0 Q13.9 10.1 24 12 Q13.9 13.9 12 24 Q10.1 13.9 0 12 Q10.1 10.1 12 0 Z" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-start ${className}`}>
      <span className="font-medium lowercase tracking-[-0.02em]">miracle</span>
      <span
        className="relative ml-[0.14em] inline-block h-[1em] w-[0.46em]"
        aria-hidden="true"
      >
        <Sparkle className="absolute left-0 top-[0.12em] h-[0.4em] w-[0.4em]" />
        <Sparkle className="absolute left-[0.3em] top-[-0.04em] h-[0.18em] w-[0.18em]" />
      </span>
    </span>
  );
}
