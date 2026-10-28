
import { NextResponse } from "next/server";

const SYMBOLS = [
  { symbol: "BTC/USD", name: "Bitcoin", category: "Crypto" },
  { symbol: "ETH/USD", name: "Ethereum", category: "Crypto" },
  { symbol: "AAPL", name: "Apple", category: "US Stocks" },
  { symbol: "NVDA", name: "NVIDIA", category: "US Stocks" },
  { symbol: "NIFTY", name: "NIFTY 50", category: "Indian Market" },
  { symbol: "BANKNIFTY", name: "BANK NIFTY", category: "Indian Market" },
  { symbol: "EUR/USD", name: "EUR / USD", category: "Forex" },
  { symbol: "USD/INR", name: "USD / INR", category: "Forex" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WAIT_MS = 60 * 1000;

type MarketData = {
  available: boolean;
  price?: number;
  change?: number;
  percentChange?: number;
  currency?: string;
  exchange?: string;
  marketOpen?: boolean | null;
  updatedAt?: string | null;
  error?: string;
};

const cache = new Map<
  string,
  { data: MarketData; time: number }
>();

let nextIndex = 0;
let rateLimitedUntil = 0;
let requestInProgress = false;

export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Market API key is not configured." },
      { status: 503 }
    );
  }

  // Do not make repeated calls while the provider is rate-limiting us.
  if (Date.now() >= rateLimitedUntil && !requestInProgress) {
    const item = SYMBOLS[nextIndex];
    const cached = cache.get(item.symbol);
    const cacheIsFresh =
      cached && Date.now() - cached.time < CACHE_TTL_MS;

    // Refresh a symbol only when its cached data is stale or missing.
    if (!cacheIsFresh) {
      requestInProgress = true;

      try {
        const params = new URLSearchParams({
          symbol: item.symbol,
          apikey: apiKey,
        });

        const response = await fetch(
          `https://api.twelvedata.com/quote?${params.toString()}`,
          { cache: "no-store" }
        );

        const data = await response.json();
        const message = String(data.message || "");

        if (
          /credit|limit|minute|api key/i.test(message) ||
          response.status === 429
        ) {
          rateLimitedUntil = Date.now() + RATE_LIMIT_WAIT_MS;
        } else if (
          response.ok &&
          !data.code &&
          data.close !== undefined &&
          Number.isFinite(Number(data.close))
        ) {
          cache.set(item.symbol, {
            time: Date.now(),
            data: {
              available: true,
              price: Number(data.close),
              change: Number(data.change ?? 0),
              percentChange: Number(data.percent_change ?? 0),
              currency: data.currency || "",
              exchange: data.exchange || "",
              marketOpen: data.is_market_open ?? null,
              updatedAt: data.datetime || null,
            },
          });

          nextIndex = (nextIndex + 1) % SYMBOLS.length;
        } else {
          // Keep previous valid data if this refresh fails.
          if (!cached) {
            cache.set(item.symbol, {
              time: Date.now(),
              data: {
                available: false,
                error: message || "Symbol unavailable on this API plan.",
              },
            });
          }

          nextIndex = (nextIndex + 1) % SYMBOLS.length;
        }
      } catch {
        // A temporary network error should not erase valid cached prices.
      } finally {
        requestInProgress = false;
      }
    } else {
      nextIndex = (nextIndex + 1) % SYMBOLS.length;
    }
  }

  const markets = SYMBOLS.map((item) => {
    const cached = cache.get(item.symbol);

    if (!cached) {
      return {
        ...item,
        available: false,
        error:
          Date.now() < rateLimitedUntil
            ? "Provider rate limit reached. Try again later."
            : "Waiting for market data.",
      };
    }

    return {
      ...item,
      ...cached.data,
      cached: Date.now() - cached.time > CACHE_TTL_MS,
    };
  });

  return NextResponse.json({
    ok: true,
    markets,
    rateLimited: Date.now() < rateLimitedUntil,
    fetchedAt: new Date().toISOString(),
  });
}
