import Link from "next/link";
import { ROBINHOOD_MAINNET } from "@miracle/shared";
import { Wordmark } from "./wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-ivory/10 bg-panel">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div>
            <Link href="/" className="text-base text-text hover:text-ivory">
              <Wordmark />
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-faint">
              A trading game on {ROBINHOOD_MAINNET.name}, chain {ROBINHOOD_MAINNET.id}.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <li>
                <Link href="/play" className="text-muted hover:text-text">
                  Play
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="text-muted hover:text-text">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/rules" className="text-muted hover:text-text">
                  Rules
                </Link>
              </li>
              <li>
                <Link href="/token" className="text-muted hover:text-text">
                  Token
                </Link>
              </li>
              <li>
                <a
                  href={ROBINHOOD_MAINNET.explorerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted hover:text-text"
                >
                  Explorer
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-12 max-w-2xl border-t border-ivory/10 pt-6 text-xs leading-relaxed text-faint">
          Miracle is a game of skill played with virtual capital. Trading is simulated
          against live Chainlink prices — no shares, tokens or other assets are bought,
          sold or held on your behalf, and nothing here is investment advice. Entry fees
          and payouts are handled by a contract you can read yourself.
        </p>
      </div>
    </footer>
  );
}
