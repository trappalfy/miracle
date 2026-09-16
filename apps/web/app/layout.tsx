import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://miracle.game"),
  title: {
    default: "Miracle – on-chain trading game",
    template: "%s · Miracle",
  },
  description:
    "A trading game on Robinhood Chain. Same starting capital for everyone, Chainlink prices, and a leaderboard nobody can edit.",
  openGraph: {
    title: "Miracle – on-chain trading game",
    description:
      "Same starting capital for everyone. Chainlink prices. Every position and score on-chain.",
    siteName: "Miracle",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miracle – on-chain trading game",
    description:
      "Same starting capital for everyone. Chainlink prices. Every position and score on-chain.",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-dvh bg-void text-text antialiased">{children}</body>
    </html>
  );
}
