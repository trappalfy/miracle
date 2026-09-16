const STEPS = [
  {
    title: "Enter",
    body: "Pay the entry fee once. It goes straight into the season's prize pool, held by the contract. There is no withdrawal function for us to call.",
  },
  {
    title: "Take your capital",
    body: "Every player starts the season with the same virtual trading capital. Nothing you hold outside the game changes that number.",
  },
  {
    title: "Trade",
    body: "Open and close positions against live Chainlink prices, up to the capacity your leverage allows. Each position is a transaction.",
  },
  {
    title: "Settle",
    body: "When trading closes, anyone can compute the ranking and submit it. The contract checks the order itself, then pays out.",
  },
];

/** The rail dims as the season runs out; each segment picks up where the last left off. */
const RAIL_FROM = 0.5;
const RAIL_TO = 0.06;

function railGradient(index: number, total: number): string {
  const at = (step: number) => RAIL_FROM + (RAIL_TO - RAIL_FROM) * (step / total);
  return `linear-gradient(to right, rgba(242,235,221,${at(index).toFixed(3)}), rgba(242,235,221,${at(index + 1).toFixed(3)}))`;
}

export function HowItWorks() {
  return (
    <section
      className="led-section border-t border-ivory/10"
      style={{ "--bloom-x": "82%", "--bloom-y": "14%" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="max-w-lg text-3xl font-light leading-tight tracking-[-0.02em]">
          How a season works
        </h2>

        <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              {/*
                Number and rail share one flex row so `items-center` lines them
                up exactly. An absolutely placed rail cannot: an inline number
                sits on its line box's baseline, not at a predictable offset.
              */}
              <div className="flex items-center gap-4">
                <span className="tabular shrink-0 text-sm leading-none text-ivory">
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px flex-1"
                  style={{ backgroundImage: railGradient(index, STEPS.length) }}
                />
              </div>

              <h3 className="mt-6 text-base text-text">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
