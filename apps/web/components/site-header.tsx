import Link from "next/link";
import { Wordmark } from "./wordmark";

const NAV = [
  { href: "/play", label: "Play" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/rules", label: "Rules" },
  { href: "/token", label: "Token" },
];

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      {/* Four links plus the wordmark is wider than a phone: let it wrap rather
          than squeeze, and tighten the gaps before it has to. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6">
        <Link href="/" className="text-lg text-text hover:text-ivory">
          <Wordmark />
        </Link>

        <nav aria-label="Main">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:gap-x-7">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted transition-colors hover:text-text"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
