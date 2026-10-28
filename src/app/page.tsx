
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Trade = {
  id: string;
  userId: string;
  instrument: string;
  direction: "long" | "short";
  status: "open" | "closed";
  entryPrice: string;
  exitPrice: string | null;
  quantity: string;
  openedAt: string;
  createdAt: string;
  closedAt?: string | null;
  fees?: string | null;
  strategy: string | null;
  notes: string | null;
};

type Analytics = {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakevenTrades: number;
    winRate: number;
    totalGrossPnl: number;
    totalFees: number;
    totalNetPnl: number;
  };
  equityCurve: {
    date: string;
    tradeId: string;
    instrument: string;
    pnl: number;
    equity: number;
  }[];
  dailyPnl: {
    date: string;
    pnl: number;
  }[];
  strategyPerformance: {
    strategy: string;
    totalTrades: number;
    winningTrades: number;
    netPnl: number;
  }[];
  closedTrades?: {
    id: string;
    instrument: string;
    grossPnl: number;
    fees: number;
    netPnl: number;
  }[];
};

const DEMO_USER = "demo-user";

const panel =
  "rounded-2xl border border-white/10 bg-[#111722] p-5 sm:p-6";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0b1019] px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signedMoney = (value: number) =>
  `${value < 0 ? "-" : value > 0 ? "+" : ""}${money(Math.abs(value))}`;

const shortDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
};

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");

  const [instrument, setInstrument] = useState("BTCUSDT");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);

  const loadTrades = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(
        `/api/trades?userId=${encodeURIComponent(DEMO_USER)}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not load trades.");
      }

      setTrades(data.trades);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load trades.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalyticsError("");

      const response = await fetch(
        `/api/analytics?userId=${encodeURIComponent(DEMO_USER)}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not load analytics.");
      }

      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(
        err instanceof Error
          ? err.message
          : "Could not load analytics.",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([loadTrades(), loadAnalytics()]);
  }, [loadTrades, loadAnalytics]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  async function addTrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER,
          instrument: instrument.trim().toUpperCase(),
          direction,
          entryPrice,
          quantity,
          openedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not save trade.");
      }

      setMessage("Trade saved successfully.");
      setEntryPrice("");
      setQuantity("");
      await refreshDashboard();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not save trade.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function closeTrade(trade: Trade) {
    const exitPrice = window.prompt(
      `Enter exit price for ${trade.instrument}:`,
    );

    if (exitPrice === null) return;

    const parsedPrice = Number(exitPrice);

    if (
      !exitPrice.trim() ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0
    ) {
      setMessage("Please enter a valid positive exit price.");
      return;
    }

    setBusyTradeId(trade.id);
    setMessage("");

    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER,
          action: "close",
          exitPrice: String(parsedPrice),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not close trade.");
      }

      setMessage(`${trade.instrument} closed successfully.`);
      await refreshDashboard();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not close trade.",
      );
    } finally {
      setBusyTradeId(null);
    }
  }

  async function deleteTrade(trade: Trade) {
    const confirmed = window.confirm(
      `Delete ${trade.instrument} permanently? This cannot be undone.`,
    );

    if (!confirmed) return;

    setBusyTradeId(trade.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/trades/${trade.id}?userId=${encodeURIComponent(DEMO_USER)}`,
        { method: "DELETE" },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not delete trade.");
      }

      setMessage(`${trade.instrument} deleted successfully.`);
      await refreshDashboard();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not delete trade.",
      );
    } finally {
      setBusyTradeId(null);
    }
  }

  const openTrades = trades.filter((trade) => trade.status === "open");
  const closedTrades = trades.filter((trade) => trade.status === "closed");

  const totalRealizedPnl =
    analytics?.summary.totalNetPnl ??
    closedTrades.reduce((total, trade) => {
      if (trade.exitPrice === null) return total;

      const entry = Number(trade.entryPrice);
      const exit = Number(trade.exitPrice);
      const qty = Number(trade.quantity);
      const fees = Number(trade.fees ?? 0);

      if (![entry, exit, qty, fees].every(Number.isFinite)) return total;

      const pnl =
        trade.direction === "long"
          ? (exit - entry) * qty
          : (entry - exit) * qty;

      return total + pnl - fees;
    }, 0);

  const summary = analytics?.summary;
  const equityCurve = analytics?.equityCurve ?? [];
  const dailyPnl = analytics?.dailyPnl ?? [];
  const strategyPerformance = analytics?.strategyPerformance ?? [];

  return (
    <main className="min-h-screen bg-[#080b12] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              TradeMind AI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Trading Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Track your trades and understand your performance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Database connected
            </span>

            <button
              type="button"
              onClick={() => void refreshDashboard()}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
            >
              Refresh dashboard
            </button>
          </div>
        </header>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300"
          >
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            Trades: {error}
          </p>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Trades"
            value={String(trades.length)}
            detail="All saved records"
          />
          <StatCard
            label="Open Trades"
            value={String(openTrades.length)}
            detail="Currently open"
            accent="text-emerald-400"
          />
          <StatCard
            label="Closed Trades"
            value={String(closedTrades.length)}
            detail="Completed records"
          />
          <StatCard
            label="Net Realized P&L"
            value={signedMoney(totalRealizedPnl)}
            detail="After recorded fees, when available"
            accent={
              totalRealizedPnl >= 0
                ? "text-emerald-400"
                : "text-rose-400"
            }
          />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Win Rate"
            value={
              summary ? `${Number(summary.winRate).toFixed(1)}%` : "—"
            }
            detail={
              summary
                ? `${summary.winningTrades} winning trades`
                : "Closed trades only"
            }
            accent="text-emerald-300"
          />
          <StatCard
            label="Gross P&L"
            value={
              summary ? signedMoney(summary.totalGrossPnl) : "—"
            }
            detail="Before fees"
          />
          <StatCard
            label="Total Fees"
            value={
              summary ? money(summary.totalFees) : "—"
            }
            detail="Recorded trade fees"
          />
          <StatCard
            label="Losing Trades"
            value={summary ? String(summary.losingTrades) : "—"}
            detail={
              summary
                ? `${summary.breakevenTrades} breakeven trades`
                : "Closed trades only"
            }
            accent="text-rose-300"
          />
        </section>

        {analyticsError && (
          <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Analytics could not load: {analyticsError}. Check that
            /api/analytics is working. Your trade journal remains available.
          </div>
        )}

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className={panel}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Equity Curve</h2>
              <p className="mt-1 text-sm text-slate-400">
                Cumulative net P&L across closed trades
              </p>
            </div>

            {analyticsLoading ? (
              <ChartMessage>Loading equity curve...</ChartMessage>
            ) : equityCurve.length === 0 ? (
              <ChartMessage>
                Close a trade to start building your equity curve.
              </ChartMessage>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={equityCurve}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#263244"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => money(Number(value))}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1019",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#f1f5f9",
                    }}
                    formatter={(value) => [
                      money(Number(value)),
                      "Cumulative P&L",
                    ]}
                    labelFormatter={(label) => `Date: ${String(label)}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    name="Cumulative P&L"
                    stroke="#34d399"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#34d399" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className={panel}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Daily P&L</h2>
              <p className="mt-1 text-sm text-slate-400">
                Profit or loss grouped by closing date
              </p>
            </div>

            {analyticsLoading ? (
              <ChartMessage>Loading daily performance...</ChartMessage>
            ) : dailyPnl.length === 0 ? (
              <ChartMessage>
                Daily performance will appear after you close trades.
              </ChartMessage>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={dailyPnl}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#263244"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => money(Number(value))}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1019",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#f1f5f9",
                    }}
                    formatter={(value) => [
                      signedMoney(Number(value)),
                      "Daily P&L",
                    ]}
                    labelFormatter={(label) => `Date: ${String(label)}`}
                  />
                  <Bar
                    dataKey="pnl"
                    name="Daily P&L"
                    fill="#34d399"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className={`mt-6 ${panel}`}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Strategy Performance</h2>
            <p className="mt-1 text-sm text-slate-400">
              Compare closed trades by recorded strategy
            </p>
          </div>

          {analyticsLoading ? (
            <ChartMessage>Loading strategies...</ChartMessage>
          ) : strategyPerformance.length === 0 ? (
            <ChartMessage>
              No strategy data yet. Add strategy labels to trades to compare them.
            </ChartMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="px-3 py-3 font-medium">Strategy</th>
                    <th className="px-3 py-3 font-medium">Trades</th>
                    <th className="px-3 py-3 font-medium">Wins</th>
                    <th className="px-3 py-3 font-medium">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyPerformance.map((item) => (
                    <tr
                      key={item.strategy}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-3 py-4 font-medium">
                        {item.strategy}
                      </td>
                      <td className="px-3 py-4">{item.totalTrades}</td>
                      <td className="px-3 py-4">{item.winningTrades}</td>
                      <td
                        className={`px-3 py-4 font-semibold ${
                          item.netPnl >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {signedMoney(item.netPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 grid items-start gap-6 lg:grid-cols-[0.85fr_1.5fr]">
          <div className={panel}>
            <h2 className="text-xl font-semibold">Add a Trade</h2>
            <p className="mt-1 text-sm text-slate-400">
              Save a new record to your trade journal.
            </p>

            <form onSubmit={addTrade} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Instrument
                </label>
                <input
                  value={instrument}
                  onChange={(event) => setInstrument(event.target.value)}
                  required
                  maxLength={30}
                  placeholder="BTCUSDT"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(event) =>
                    setDirection(event.target.value as "long" | "short")
                  }
                  className={inputClass}
                >
                  <option value="long">Long / Buy</option>
                  <option value="short">Short / Sell</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Entry Price
                </label>
                <input
                  type="number"
                  min="0.00000001"
                  step="any"
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  required
                  placeholder="65000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Quantity
                </label>
                <input
                  type="number"
                  min="0.00000001"
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                  placeholder="0.01"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Trade"}
              </button>
            </form>
          </div>

          <div className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Trade History</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Your records from Neon PostgreSQL
                </p>
              </div>

              <button
                type="button"
                onClick={() => void refreshDashboard()}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <ChartMessage>Loading trades...</ChartMessage>
            ) : error ? (
              <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">
                {error}
              </div>
            ) : trades.length === 0 ? (
              <ChartMessage>
                No trades yet. Add your first trade using the form.
              </ChartMessage>
            ) : (
              <div className="mt-5 space-y-3">
                {trades.map((trade) => (
                  <article
                    key={trade.id}
                    className="rounded-xl border border-white/10 bg-[#0b1019] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{trade.instrument}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(trade.openedAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            trade.direction === "long"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-rose-400/10 text-rose-300"
                          }`}
                        >
                          {trade.direction.toUpperCase()}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            trade.status === "open"
                              ? "bg-amber-400/10 text-amber-300"
                              : "bg-slate-400/10 text-slate-300"
                          }`}
                        >
                          {trade.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <TradeValue
                        label="Entry Price"
                        value={money(Number(trade.entryPrice))}
                      />
                      <TradeValue
                        label="Quantity"
                        value={trade.quantity}
                      />
                      <TradeValue
                        label="Exit Price"
                        value={
                          trade.exitPrice === null
                            ? "—"
                            : money(Number(trade.exitPrice))
                        }
                      />
                    </div>

                    {trade.strategy && (
                      <p className="mt-3 text-xs text-slate-400">
                        Strategy: {trade.strategy}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      {trade.status === "open" && (
                        <button
                          type="button"
                          disabled={busyTradeId === trade.id}
                          onClick={() => void closeTrade(trade)}
                          className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                        >
                          {busyTradeId === trade.id
                            ? "Please wait..."
                            : "Close Trade"}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busyTradeId === trade.id}
                        onClick={() => void deleteTrade(trade)}
                        className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 border-t border-white/10 py-5 text-center text-xs text-slate-500">
          TradeMind AI · Development version · No live orders are placed
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent = "text-slate-100",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111722] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-3 break-words text-2xl font-bold sm:text-3xl ${accent}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ChartMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

function TradeValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}
