import { ASSETS, ASSET_SYMBOLS, MAX_LEVERAGE, MIN_LEVERAGE } from "@miracle/shared";

/**
 * The rules, as the contract enforces them.
 *
 * Everything here is either read from the shared config the contract is
 * deployed with, or describes a check that exists in `MiracleGame.sol`. Where
 * the game has a sharp edge — no liquidations, no audit, a pool that sits
 * still if nobody submits a ranking — it is written down rather than left for
 * a player to discover.
 */

export const SECTIONS = [
  { id: "season", title: "A season, end to end" },
  { id: "capital", title: "Capital and leverage" },
  { id: "assets", title: "What you can trade" },
  { id: "prices", title: "How a price becomes your price" },
  { id: "closing", title: "Closing a position" },
  { id: "ranking", title: "The ranking" },
  { id: "prizes", title: "The split" },
  { id: "score", title: "What you carry forward" },
  { id: "limits", title: "Limits and known risks" },
] as const;

const PHASES = [
  {
    name: "Opening soon",
    body: "The season exists but entry has not opened. Nothing is staked.",
  },
  {
    name: "Entry open",
    body: "Pay the entry fee to join. It goes into the prize pool. Trading has not started, so nobody can be ahead of anybody.",
  },
  {
    name: "Trading",
    body: "Entry is closed and positions can be opened and closed. Trading begins at the exact moment entry ends.",
  },
  {
    name: "Settling",
    body: "Trading has ended. Every position is settled against its exit round, and then a final ranking can be submitted.",
  },
  {
    name: "Finished",
    body: "The ranking has been accepted. Prizes are claimable and career scores are updated.",
  },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-ivory/10 pt-10">
      <h2 className="text-2xl font-light leading-tight tracking-[-0.02em]">{title}</h2>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="formula overflow-x-auto rounded-r-control py-3.5 pl-4 pr-4 text-text">
      {children}
    </pre>
  );
}

export function RulesContent() {
  return (
    <article className="max-w-2xl space-y-14">
      <Section id="season" title="A season, end to end">
        <p>
          A season runs in five phases. The contract works out which one it is in from
          the clock, so nobody switches it by hand.
        </p>

        <dl className="space-y-4">
          {PHASES.map((phase, index) => (
            <div key={phase.name} className="flex gap-4">
              <dt className="tabular w-5 shrink-0 pt-0.5 text-xs text-faint">
                {index + 1}
              </dt>
              <dd className="min-w-0">
                <span className="text-text">{phase.name}</span>
                <span className="mt-1 block">{phase.body}</span>
              </dd>
            </div>
          ))}
        </dl>

        <p>
          A season also has a ceiling on how many players it accepts. Once it is full,
          entry is refused — which is what caps the amount of money any one season can
          have at stake.
        </p>
      </Section>

      <Section id="capital" title="Capital and leverage">
        <p>
          Every player starts with the same virtual trading capital. Nothing you hold
          outside the game changes it, and there is no way to add more mid-season. The
          only thing that differs between two players on day one is their career score.
        </p>
        <p>
          That score buys room, not money. It sets how large a book you may carry, from{" "}
          {MIN_LEVERAGE}× at a standing start to {MAX_LEVERAGE}× for a perfect record:
        </p>

        <Formula>{`leverage = 3 + 0.07 × score        score is a whole number, 0…100
capital  = starting capital + realised profit and loss
capacity = capital × leverage`}</Formula>

        <p>
          Your leverage is read when you enter and fixed for the whole season, so
          finishing a season well never changes the one you are already playing.
        </p>
        <p>
          Capital moves with realised results only. An open position that is doing well
          does not buy you room to open more; a realised loss takes room away. If
          realised losses wipe out the starting capital, capacity is zero and you cannot
          open anything further.
        </p>
      </Section>

      <Section id="assets" title="What you can trade">
        <p>
          Eight assets, each with a Chainlink feed on Robinhood Chain. We do not list
          anything we cannot price. A position consumes capacity in proportion to its
          risk weight, so where you put the money matters as much as whether you were
          right about it.
        </p>

        <Formula>{`risk-weighted exposure = Σ notional × risk weight
you may open if        exposure after the trade ≤ capacity`}</Formula>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="pb-2.5 font-normal">Asset</th>
                <th className="pb-2.5 font-normal">Name</th>
                <th className="pb-2.5 text-right font-normal">Risk weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory/8">
              {ASSET_SYMBOLS.map((symbol) => (
                <tr key={symbol}>
                  <td className="py-2.5 text-text">{symbol}</td>
                  <td className="py-2.5 text-muted">{ASSETS[symbol].name}</td>
                  <td className="tabular py-2.5 text-right text-muted">
                    {ASSETS[symbol].riskWeight.toFixed(1)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          Both directions are allowed on every asset. A short profits when the price
          falls by exactly as much as a long of the same size would lose.
        </p>
        <p>
          The game runs around the clock. Equity feeds only publish while the market is
          open, so an order placed at the weekend is priced at the first round after the
          market reopens — see below.
        </p>
      </Section>

      <Section id="prices" title="How a price becomes your price">
        <p>
          This is the rule that makes the game fair, and it is the one most worth
          understanding: <span className="text-text">you never trade at a price you
          have already seen.</span>
        </p>
        <p>
          When you open a position, the contract records the moment and no price at all.
          Your entry is the first Chainlink round published strictly after that moment —
          a price that did not exist when you pressed the button.
        </p>

        <Formula>{`entry price = first oracle round with updatedAt > the moment you opened`}</Formula>

        <p>
          That comparison is strict. A round stamped in the same second as your
          transaction does not count, because blocks here are a tenth of a second apart
          while timestamps are whole seconds — a round from your own second could have
          been published before you acted, and you might have seen it.
        </p>
        <p>
          Anyone can then point the contract at which round that was, and it checks the
          claim: the round must come after your moment, and the round before it must
          not. There is exactly one round that satisfies both, so the person submitting
          has no choice to make and nothing to gain.
        </p>
        <p>
          Without this, a fast player could watch the feed, see a new price arrive, and
          buy at the old one. It is the oldest trick against price feeds and it is worth
          more than any amount of skill, which is why the game is built around closing
          it rather than around anything else.
        </p>
        <p>
          A round is only usable if the feed answered properly. If the answer is not
          positive, or the feed has published nothing for a week, the position is voided
          and settles at zero profit and loss rather than at a made-up number.
        </p>
      </Section>

      <Section id="closing" title="Closing a position">
        <p>
          Closing takes two steps, for the same reason opening does: the price you leave
          at cannot be one you have already seen.
        </p>
        <p>
          Asking to close records the moment. Settling it works out the exit — the first
          round after that moment — and books the profit or loss. Anything still open
          when trading ends settles against the end of trading.
        </p>

        <Formula>{`profit and loss = notional × (exit − entry) ÷ entry      negated for a short`}</Formula>

        <p>
          Anyone can settle anyone&rsquo;s position: it is a public calculation with a
          single correct answer, so there is nothing to gain by being the one who does
          it. A keeper runs continuously and settles whatever is ready.
        </p>
        <p>
          Until a position is settled it still occupies capacity. Feeds publish when the
          price moves half a percent or once a day, whichever comes first, so the wait is
          routinely hours; Treasuries can take a full day, and longer across a weekend.
          Closing frees your room later than you might expect, and that is worth knowing
          before you need the room.
        </p>
      </Section>

      <Section id="ranking" title="The ranking">
        <p>
          When trading ends, anyone can compute the final order and submit it. The
          contract does not sort; it checks. The first submission that passes every check
          is accepted and the season is finished.
        </p>
        <p>What it checks:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-faint">
          <li>the list holds exactly as many addresses as the season has players;</li>
          <li>every one of them entered this season, and none appears twice;</li>
          <li>nobody in it still has an unsettled position;</li>
          <li>equity never rises as the list goes down.</li>
        </ul>
        <p>
          Final equity is the starting capital plus realised profit and loss, and never
          less than zero. Open positions do not count until they are settled — which is
          why the standings shown during a season are a forecast your browser computes,
          not the result.
        </p>
      </Section>

      <Section id="prizes" title="The split">
        <p>
          Entry fees accumulate in the season contract. There is no function that lets us
          withdraw them. When the ranking is accepted, the pool is divided by a curve
          fixed before the season opened.
        </p>
        <p>
          If fewer players turn up than the curve pays, it is renormalised over the
          places that exist, so the whole pool is always distributed. Players who finish
          on exactly equal equity pool the places their tie spans and split them evenly —
          which is what makes the ranking safe to let anyone submit, since the order
          chosen inside a tie moves nobody&rsquo;s money.
        </p>
        <p>
          A season may also carry a platform fee, capped at 20% and disclosed on the
          leaderboard. It is zero on the opening season.
        </p>
        <p>
          Prizes are not sent to you; they are credited, and you withdraw them when you
          want to.
        </p>
      </Section>

      <Section id="score" title="What you carry forward">
        <p>
          The only thing that survives a season is your score, and the only thing it
          does is set your leverage in the next one.
        </p>

        <Formula>{`percentile = 100 for first place, 0 for last, spread evenly between
new score  = (old score + percentile) ÷ 2`}</Formula>

        <p>
          Averaging against your old score means one good season does not hand you 10×,
          and one bad season does not undo a career. It also means a player who stops
          playing keeps their score exactly as it was.
        </p>
        <p>A season with a single player does not change anyone&rsquo;s score.</p>
      </Section>

      <Section id="limits" title="Limits and known risks">
        <p>
          Nothing below is a hypothetical. These are the things we know about and have
          decided to ship with.
        </p>

        <dl className="space-y-5">
          {[
            {
              title: "The contract has not been audited",
              body: "Instead of an audit we cap what can be lost: every season has a maximum number of players, so the most at risk is the entry fee multiplied by that ceiling. Play with an amount that matches that.",
            },
            {
              title: "There are no liquidations",
              body: "Nothing closes your position for you. A position deep in the red stays open until you close it or trading ends, and final equity is floored at zero rather than going negative.",
            },
            {
              title: "The pool needs someone to submit a ranking",
              body: "If nobody ever submits one, the prizes are never distributed. Anyone can submit, including you, and we run a keeper that does — but the contract has no timer that pays out on its own.",
            },
            {
              title: "Several wallets can farm a score",
              body: "Nothing ties an address to a person. Somebody willing to pay several entry fees can raise one wallet's score using the others. It costs real money each season, which is the only thing standing in the way.",
            },
            {
              title: "Slow feeds cut both ways",
              body: "A feed publishes when the price moves half a percent, or once a day. Between rounds, your entry and exit are pinned to prices that may be hours old — the same for everyone, but not the same as the market.",
            },
            {
              title: "A dead feed voids a position",
              body: "If a feed stops publishing for a week, positions on it settle at zero rather than at a guess. You lose the trade's outcome, not your capital.",
            },
            {
              title: "No more than twenty unsettled positions",
              body: "You cannot open a twenty-first until some are settled. It exists so a season cannot be jammed by one player leaving thousands of positions for someone to settle.",
            },
          ].map((risk) => (
            <div key={risk.title}>
              <dt className="rule-top-fade pt-3.5 text-base text-text">{risk.title}</dt>
              <dd className="mt-2">{risk.body}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </article>
  );
}
