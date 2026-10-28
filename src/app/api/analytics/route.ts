
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId is required." },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.userId, userId),
          eq(trades.status, "closed")
        )
      )
      .orderBy(desc(trades.closedAt));

    const closedTrades = rows.map((trade) => {
      const entry = Number(trade.entryPrice);
      const exit = Number(trade.exitPrice);
      const quantity = Number(trade.quantity);
      const fees = Number(trade.fees ?? 0);

      const grossPnl =
        trade.direction === "long"
          ? (exit - entry) * quantity
          : (entry - exit) * quantity;

      return {
        id: trade.id,
        instrument: trade.instrument,
        direction: trade.direction,
        strategy: trade.strategy,
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
        grossPnl,
        fees,
        netPnl: grossPnl - fees,
      };
    });

    let cumulativePnl = 0;

    const equityCurve = [...closedTrades]
      .reverse()
      .map((trade) => {
        cumulativePnl += trade.netPnl;

        return {
          date: trade.closedAt
            ? new Date(trade.closedAt).toISOString()
            : "",
          tradeId: trade.id,
          instrument: trade.instrument,
          pnl: Number(trade.netPnl.toFixed(2)),
          equity: Number(cumulativePnl.toFixed(2)),
        };
      });

    const dailyMap = new Map<
      string,
      { date: string; pnl: number; trades: number }
    >();

    for (const trade of closedTrades) {
      if (!trade.closedAt) continue;

      const date = new Date(trade.closedAt).toISOString().slice(0, 10);
      const current = dailyMap.get(date) ?? {
        date,
        pnl: 0,
        trades: 0,
      };

      current.pnl += trade.netPnl;
      current.trades += 1;
      dailyMap.set(date, current);
    }

    const dailyPnl = [...dailyMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        ...day,
        pnl: Number(day.pnl.toFixed(2)),
      }));

    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(
      (trade) => trade.netPnl > 0
    ).length;
    const losingTrades = closedTrades.filter(
      (trade) => trade.netPnl < 0
    ).length;
    const breakevenTrades = closedTrades.filter(
      (trade) => trade.netPnl === 0
    ).length;

    const totalNetPnl = closedTrades.reduce(
      (sum, trade) => sum + trade.netPnl,
      0
    );

    const totalGrossPnl = closedTrades.reduce(
      (sum, trade) => sum + trade.grossPnl,
      0
    );

    const totalFees = closedTrades.reduce(
      (sum, trade) => sum + trade.fees,
      0
    );

    const winRate =
      totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const strategyMap = new Map<
      string,
      { strategy: string; trades: number; netPnl: number; wins: number }
    >();

    for (const trade of closedTrades) {
      const strategy = trade.strategy?.trim() || "Uncategorized";
      const current = strategyMap.get(strategy) ?? {
        strategy,
        trades: 0,
        netPnl: 0,
        wins: 0,
      };

      current.trades += 1;
      current.netPnl += trade.netPnl;

      if (trade.netPnl > 0) current.wins += 1;

      strategyMap.set(strategy, current);
    }

    const strategyPerformance = [...strategyMap.values()].map((item) => ({
      ...item,
      netPnl: Number(item.netPnl.toFixed(2)),
      winRate:
        item.trades > 0
          ? Number(((item.wins / item.trades) * 100).toFixed(2))
          : 0,
    }));

    return NextResponse.json({
      ok: true,
      summary: {
        totalTrades,
        winningTrades,
        losingTrades,
        breakevenTrades,
        winRate: Number(winRate.toFixed(2)),
        totalGrossPnl: Number(totalGrossPnl.toFixed(2)),
        totalFees: Number(totalFees.toFixed(2)),
        totalNetPnl: Number(totalNetPnl.toFixed(2)),
      },
      equityCurve,
      dailyPnl,
      strategyPerformance,
      closedTrades,
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return NextResponse.json(
      { ok: false, error: "Could not calculate trade analytics." },
      { status: 500 }
    );
  }
}
