import Link from "next/link";
import { FIRST_SEASON } from "@miracle/shared";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { HowItWorks } from "@/components/how-it-works";
import { LeverageScale } from "@/components/leverage-scale";
import { PriceBoard } from "@/components/price-board";
import { RiskLadder } from "@/components/risk-ladder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Whether there is a date to invite people to. Until there is, the page says
 * so rather than offering a season that does not exist.
 */
const SEASON_ANNOUNCED = FIRST_SEASON.opensAt !== null;

const CONSTRAINTS = [
  {
    title: "Change a price",
    body: "Every quote is read from a Chainlink feed on Robinhood Chain by your own browser. We never hold one, so there is nothing for us to edit.",
  },
  {
    title: "Give you a better entry",
    body: "Your entry price is the first oracle round after your transaction lands — not the number that was on screen when you pressed the button. Nobody trades on a price they have already seen.",
  },
  {
    title: "Move the leaderboard",
    body: "Rankings are checked by the contract. Anyone can compute the order and submit it, and an incorrect one is rejected. If we could edit it, it would not be a leaderboard.",
  },
  {
    title: "Touch the prize pool",
    body: "Entry fees sit in the season contract and are split by rules written into it before the season opens. It has no withdrawal function.",
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Exactly one viewport tall, with a floor so it never crushes on a short window. */}
      <section className="relative isolate flex h-dvh min-h-[34rem] flex-col overflow-hidden">
        <HeroBackdrop />
        <SiteHeader />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-10 pt-28">
          <h1 className="max-w-2xl text-[clamp(2.25rem,6vw,4rem)] font-light leading-[1.1] tracking-[-0.03em]">
            A trading game you can verify yourself.
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">
            Everyone starts a season with the same capital, so the best trader wins
            rather than the biggest wallet. Prices come from Chainlink. Positions,
            scores and the leaderboard live on-chain.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-5">
            <Link
              href="/play"
              className="rounded-control bg-ivory px-6 py-3 text-sm font-medium text-void transition-colors hover:bg-white"
            >
              {SEASON_ANNOUNCED ? "Enter the season" : "See the first season"}
            </Link>
            <Link
              href="/rules"
              className="text-sm text-muted transition-colors hover:text-text"
            >
              How it works
            </Link>
          </div>
        </div>

        {/* The ticker along the base of the screen: the claim above, demonstrated. */}
        <div className="relative z-10 w-full shrink-0 border-t border-ivory/10 bg-void/60 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <PriceBoard />
          </div>
        </div>
      </section>

      <HowItWorks />
      <RiskLadder />
      <LeverageScale />

      {/* Deliberately the quiet section: if everything glows, nothing stands out. */}
      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "12%", "--bloom-y": "10%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="max-w-xl text-3xl font-light leading-tight tracking-[-0.02em]">
            Four things we could not do to you if we wanted to
          </h2>

          <dl className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {CONSTRAINTS.map((item) => (
              <div key={item.title}>
                <dt className="rule-top-fade pt-4 text-base text-text">{item.title}</dt>
                <dd className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "50%", "--bloom-y": "45%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-6xl px-6 py-28">
          <h2 className="max-w-lg text-[clamp(1.75rem,4vw,2.75rem)] font-light leading-tight tracking-[-0.02em]">
            {SEASON_ANNOUNCED ? "The season is open." : "The first season is coming."}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
            {SEASON_ANNOUNCED
              ? "Same capital as everyone else, real prices, and a result anyone can check."
              : "Same capital as everyone else, real prices, and a result anyone can check. The opening date is announced on the season page."}
          </p>
          <Link
            href="/play"
            className="mt-9 inline-block rounded-control bg-ivory px-6 py-3 text-sm font-medium text-void transition-colors hover:bg-white"
          >
            {SEASON_ANNOUNCED ? "Enter the season" : "See the terms"}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
