import type { Metadata } from "next";
import Link from "next/link";
import { DEPLOYMENTS, explorerAddressUrl, networkById } from "@miracle/shared";
import { CopyButton } from "@/components/copy-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MIRACLE_TOKEN, isLaunched } from "@/lib/token";

export const metadata: Metadata = {
  title: "Token",
  description:
    "The official contract address for the Miracle token, published here first. Anything not on this page is not ours.",
};

/**
 * The token page exists to be the one place an address can be checked against.
 *
 * Until there is a token, its job is to say so as plainly as possible: a
 * project that has announced a token but not deployed one is exactly when
 * people get sold a fake. So the page states the absence, and never renders a
 * placeholder that could be mistaken for an address.
 */

const UNANNOUNCED = [
  "How many there will be",
  "How they will be distributed",
  "What holding one will do",
  "When it will happen",
];

/** The address slot: the whole point of the page, in both of its states. */
function AddressPanel() {
  const network = networkById(MIRACLE_TOKEN.chainId);

  if (!isLaunched(MIRACLE_TOKEN)) {
    return (
      <div className="rounded-panel border border-ivory/15 bg-panel p-6 sm:p-8">
        <div className="text-xs text-faint">Contract address</div>

        <p className="mt-4 text-2xl font-light tracking-[-0.02em] text-text sm:text-3xl">
          Not deployed
        </p>

        {/* An unlit row of the board: the slot exists, nothing is in it. */}
        <span
          aria-hidden="true"
          className="led-track mt-6 block w-full max-w-md opacity-60"
        />

        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
          There is no Miracle token. When one is deployed, its address appears in this
          box — and this box is the only place it will appear first.
        </p>
      </div>
    );
  }

  const url = explorerAddressUrl(MIRACLE_TOKEN.chainId, MIRACLE_TOKEN.address);

  return (
    <div className="rounded-panel border border-ivory/20 bg-panel p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-faint">
          Contract address{network ? ` · ${network.name}` : ""}
        </div>
        <CopyButton value={MIRACLE_TOKEN.address} label="contract address" />
      </div>

      <p className="formula mt-4 select-all break-all rounded-r-control py-3 pl-4 pr-4 text-base text-text">
        {MIRACLE_TOKEN.address}
      </p>

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
        {MIRACLE_TOKEN.symbol && (
          <div>
            <dt className="text-xs text-faint">Symbol</dt>
            <dd className="mt-1 text-sm text-text">{MIRACLE_TOKEN.symbol}</dd>
          </div>
        )}
        {MIRACLE_TOKEN.totalSupply && (
          <div>
            <dt className="text-xs text-faint">Total supply</dt>
            <dd className="tabular mt-1 text-sm text-text">{MIRACLE_TOKEN.totalSupply}</dd>
          </div>
        )}
        {MIRACLE_TOKEN.decimals !== null && (
          <div>
            <dt className="text-xs text-faint">Decimals</dt>
            <dd className="tabular mt-1 text-sm text-text">{MIRACLE_TOKEN.decimals}</dd>
          </div>
        )}
        {network && (
          <div>
            <dt className="text-xs text-faint">Chain</dt>
            <dd className="tabular mt-1 text-sm text-text">{network.id}</dd>
          </div>
        )}
      </dl>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-7 inline-block text-sm text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
        >
          Read the contract on the explorer →
        </a>
      )}
    </div>
  );
}

export default function TokenPage() {
  const launched = isLaunched(MIRACLE_TOKEN);

  // Null until the contracts agent fills in DEPLOYMENTS, so the page never
  // links to an address that does not exist yet.
  const game = DEPLOYMENTS[MIRACLE_TOKEN.chainId]?.game ?? null;
  const gameUrl = game ? explorerAddressUrl(MIRACLE_TOKEN.chainId, game) : null;

  return (
    <main className="relative min-h-dvh">
      <div className="relative h-20">
        <SiteHeader />
      </div>

      <section
        className="led-section"
        style={{ "--bloom-x": "78%", "--bloom-y": "22%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-12">
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.1] tracking-[-0.03em]">
            Token
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
            {launched
              ? "The official contract address, published here first. If you found an address anywhere else, check it against this one before you do anything with it."
              : "Miracle has no token. Nothing has been deployed, nothing has been sold, and there is no sale to be early for."}
          </p>

          <div className="mt-12 max-w-2xl">
            <AddressPanel />
          </div>
        </div>
      </section>

      <section
        className="led-section border-t border-ivory/10"
        style={{ "--bloom-x": "12%", "--bloom-y": "20%" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[20rem_1fr] lg:gap-20">
            <div>
              <h2 className="text-3xl font-light leading-tight tracking-[-0.02em]">
                How to tell ours from a fake
              </h2>
              <p className="mt-6 text-sm leading-relaxed text-muted">
                Anybody can deploy a token and call it Miracle. Names are not scarce and
                nothing stops them. An address is the only thing that identifies a
                contract, so it is the only thing worth checking.
              </p>
            </div>

            <dl className="space-y-8">
              {[
                {
                  title: "This page comes first",
                  body: "Any address is published here before it is announced anywhere else. If a post has an address this page does not, the post is wrong or it is not from us.",
                },
                {
                  title: "Compare every character",
                  body: "Addresses that match at both ends and differ in the middle are generated deliberately, and the first and last four characters are what people check. Compare the whole thing, or copy it from here.",
                },
                {
                  title: "We will never message you first",
                  body: "No direct messages, no support staff asking you to connect a wallet, no form that needs your seed phrase. There is nothing we would ever need from your wallet.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <dt className="rule-top-fade pt-4 text-base text-text">{item.title}</dt>
                  <dd className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
                    {item.body}
                  </dd>
                </div>
              ))}

              {/* Kept out of the list above so it can link to the game contract
                  the moment there is one to link to. */}
              <div>
                <dt className="rule-top-fade pt-4 text-base text-text">
                  The game runs on ETH
                </dt>
                <dd className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
                  The game contract takes entry fees in ETH and pays prizes in ETH.
                  Nothing about playing a season requires you to buy anything.
                  {gameUrl && (
                    <>
                      {" "}
                      <a
                        href={gameUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-text underline-offset-4 hover:underline"
                      >
                        Read it on the explorer
                      </a>
                      .
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {!launched && (
        <section
          className="led-section border-t border-ivory/10"
          style={{ "--bloom-x": "64%", "--bloom-y": "76%" } as React.CSSProperties}
        >
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="max-w-xl text-3xl font-light leading-tight tracking-[-0.02em]">
              What we have not announced
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
              None of this has been decided, so none of it has been said. If you have
              seen any of it stated as fact, it did not come from us.
            </p>

            <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {UNANNOUNCED.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 border-b border-ivory/8 pb-4 text-sm text-muted"
                >
                  <span aria-hidden="true" className="led-track w-14 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-12 max-w-xl text-sm leading-relaxed text-muted">
              In the meantime the game is the product.{" "}
              <Link
                href="/play"
                className="text-text underline-offset-4 hover:underline"
              >
                Enter the season
              </Link>{" "}
              or{" "}
              <Link
                href="/rules"
                className="text-text underline-offset-4 hover:underline"
              >
                read the rules it runs on
              </Link>
              .
            </p>
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
