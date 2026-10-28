
"use client";

import { useCallback, useEffect, useState } from "react";

type Market = {
  symbol: string;
  name: string;
  category: string;
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

const CATEGORIES = [
  "All",
  "Crypto",
  "US Stocks",
  "Indian Market",
  "Forex",
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadMarkets = useCallback(async () => {
    try {
      setError("");

      const response = await fetch("/api/markets", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to load market prices.");
      }

      setMarkets(data.markets);
      setLastUpdated(data.fetchedAt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load market prices."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkets();

    const timer = window.setInterval(() => {
      void loadMarkets();
    }, 15 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [loadMarkets]);

  const visibleMarkets =
    category === "All"
      ? markets
      : markets.filter((market) => market.category === category);

  const money = (price: number, currency?: string) =>
    new Intl.NumberFormat("en-US", {
      style: currency ? "currency" : "decimal",
      currency: currency || undefined,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-7 sm:flex-row sm:items-center">
          <div>
            <a
              href="/"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              ← Back to Trading Dashboard
            </a>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              TradeMind AI
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Global Market Watch
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Crypto, stocks and currency markets in one place.
            </p>
          </div>

          <button
            onClick={() => void loadMarkets()}
            disabled={loading}
            className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh Prices"}
          </button>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <p>
            Provider: Twelve Data · Refresh interval: 15 minutes
          </p>
          <p>
            {lastUpdated
              ? `Last fetched: ${new Date(lastUpdated).toLocaleString()}`
              : "Waiting for market data"}
          </p>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                category === item
                  ? "bg-emerald-400 font-semibold text-slate-950"
                  : "border border-white/10 bg-[#111722] text-slate-300 hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {loading && markets.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            Fetching market prices...
          </p>
        ) : (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMarkets.map((market) => (
              <article
                key={market.symbol}
                className="rounded-2xl border border-white/10 bg-[#111722] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      {market.category}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">
                      {market.name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {market.symbol}
                      {market.exchange ? ` · ${market.exchange}` : ""}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      market.available
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {market.available ? "Available" : "Unavailable"}
                  </span>
                </div>

                {market.available ? (
                  <>
                    <p className="mt-6 text-3xl font-bold">
                      {money(market.price!, market.currency)}
                    </p>

                    <p
                      className={`mt-2 text-sm font-medium ${
                        (market.change ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {(market.change ?? 0) >= 0 ? "+" : ""}
                      {money(market.change ?? 0, market.currency)}
                      {" ("}
                      {(market.percentChange ?? 0) >= 0 ? "+" : ""}
                      {(market.percentChange ?? 0).toFixed(2)}%)
                    </p>

                    <p className="mt-4 text-xs text-slate-500">
                      Provider timestamp: {market.updatedAt || "Not supplied"}
                    </p>
                  </>
                ) : (
                  <p className="mt-6 text-sm text-amber-300">
                    {market.error || "No data available for this symbol."}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}

        <footer className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
          Market data availability and delays depend on the provider and your
          subscription. Prices are informational, not trading advice.
        </footer>
      </div>
    </main>
  );
}
