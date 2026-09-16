import type { Address } from "./types";

/**
 * The tradeable universe of a Miracle season.
 *
 * Every asset here has a real Chainlink feed on Robinhood Chain mainnet — the
 * addresses come from Chainlink's reference data directory, which is the
 * source of truth. Nothing is listed that we cannot actually price: an asset
 * without a feed would force a hardcoded fallback, which is exactly the thing
 * this game exists not to do.
 *
 * `riskWeight` scales a position's notional when measuring how much of a
 * player's capacity it consumes: a 2.0x asset eats twice its notional. It must
 * match the contract's weights exactly, or the interface will promise trades
 * the chain rejects.
 *
 * `tradesAroundTheClock` marks the assets whose feeds keep publishing at
 * weekends. Equity and ETF feeds run 24/5 and simply hold their last value
 * when the market is shut, with a 24h heartbeat — so freshness alone cannot
 * tell you whether a quote is tradeable.
 */
export type AssetClass = "treasury" | "commodity" | "equity" | "crypto";

export interface AssetSpec {
  readonly symbol: string;
  readonly name: string;
  readonly riskWeight: number;
  readonly assetClass: AssetClass;
  /** Chainlink aggregator proxy on Robinhood Chain mainnet. */
  readonly feed: Address;
  readonly decimals: number;
  /** Seconds after which the feed is contractually allowed to have gone quiet. */
  readonly heartbeatSeconds: number;
  readonly tradesAroundTheClock: boolean;
}

const EQUITY_HEARTBEAT = 86_400;

export const ASSETS = {
  SGOV: {
    symbol: "SGOV",
    name: "0–3 Month Treasury Bill ETF",
    riskWeight: 0.5,
    assetClass: "treasury",
    feed: "0xa0DF4ee0fFf975306345875E3548Fcc519577A11",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
  SLV: {
    symbol: "SLV",
    name: "Silver Trust",
    riskWeight: 0.8,
    assetClass: "commodity",
    feed: "0x209b73908e92Ae021826eD79609845451Ecba2ce",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
  SPY: {
    symbol: "SPY",
    name: "S&P 500 ETF",
    riskWeight: 1.0,
    assetClass: "equity",
    feed: "0x319724394D3A0e3669269846abE664Cd621f9f6A",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
  QQQ: {
    symbol: "QQQ",
    name: "Nasdaq 100 ETF",
    riskWeight: 1.2,
    assetClass: "equity",
    feed: "0x80901d846d5D7B030F26B480776EE3b29374C2ae",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
  NVDA: {
    symbol: "NVDA",
    name: "Nvidia",
    riskWeight: 1.5,
    assetClass: "equity",
    feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla",
    riskWeight: 1.8,
    assetClass: "equity",
    feed: "0x4A1166a659A55625345e9515b32adECea5547C38",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    riskWeight: 2.0,
    assetClass: "crypto",
    feed: "0xa2c5184bF03d373Dc9dE4876eb4Bce595B460251",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: true,
  },
  MSTR: {
    symbol: "MSTR",
    name: "Strategy",
    riskWeight: 2.5,
    assetClass: "equity",
    feed: "0x396118bdFB181e6240E74D243F266B061c0edc3D",
    decimals: 8,
    heartbeatSeconds: EQUITY_HEARTBEAT,
    tradesAroundTheClock: false,
  },
} as const satisfies Record<string, AssetSpec>;

export type AssetSymbol = keyof typeof ASSETS;

/** Ordered from safest to wildest — the risk ladder the UI renders. */
export const ASSET_SYMBOLS = Object.keys(ASSETS) as AssetSymbol[];

export function isAssetSymbol(symbol: string): symbol is AssetSymbol {
  return symbol in ASSETS;
}

export function assetSpec(symbol: string): AssetSpec {
  if (!isAssetSymbol(symbol)) {
    throw new Error(`Unknown asset: ${symbol}`);
  }
  return ASSETS[symbol];
}

export function riskWeightOf(symbol: string): number {
  return assetSpec(symbol).riskWeight;
}
