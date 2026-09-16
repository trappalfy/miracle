import type { Metadata } from "next";
import Link from "next/link";
import { RulesContent, SECTIONS } from "@/components/rules-content";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Rules",
  description:
    "Every rule Miracle enforces: phases, leverage, risk weights, how an entry price is decided, settlement, the prize split and the known risks.",
};

export default function RulesPage() {
  return (
    <main className="relative min-h-dvh">
      <div className="relative h-20">
        <SiteHeader />
      </div>

      <section
        className="led-section"
        style={{ "--bloom-x": "82%", "--bloom-y": "24%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-12">
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
            Rules
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
            These are the rules the contract enforces, not a friendly summary of them.
            Where the game has a sharp edge it is written down here rather than left for
            you to find during a season.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
            You do not have to take any of it on trust.{" "}
            <Link href="/token" className="text-text underline-offset-4 hover:underline">
              Every address we publish
            </Link>{" "}
            can be read on the explorer.
          </p>
        </div>
      </section>

      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "10%", "--bloom-y": "12%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-12 lg:grid-cols-[13rem_1fr] lg:gap-16">
            {/*
              Contents. A plain list of anchors — sticky on wide screens where
              there is room beside the text, and simply the first thing on the
              page on narrow ones.
            */}
            <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="text-xs text-faint">Contents</h2>
              <ol className="mt-4 space-y-2.5 text-sm">
                {SECTIONS.map((section, index) => (
                  <li key={section.id} className="flex gap-3">
                    <span className="tabular w-4 shrink-0 text-xs leading-6 text-faint">
                      {index + 1}
                    </span>
                    <a
                      href={`#${section.id}`}
                      className="text-muted transition-colors hover:text-text"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <RulesContent />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
