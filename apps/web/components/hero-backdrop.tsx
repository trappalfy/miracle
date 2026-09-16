/**
 * The hero backdrop: the LED panel from the brand.
 *
 * Three layers, back to front:
 *   1. A CSS dot-grid panel. Always present, needs no JS and no network, and
 *      doubles as the poster — it is what you see while the video loads and
 *      what remains under `prefers-reduced-motion`.
 *   2. The generated loop.
 *   3. A scrim so the copy stays legible over any frame.
 *
 * MP4 only, on purpose. H.264 plays everywhere including Safari, so a second
 * WebM encode would buy file size and nothing else.
 */

export function HeroBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="led-panel absolute inset-0" />

      <video
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src="/hero/panel.mp4" type="video/mp4" />
      </video>

      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
