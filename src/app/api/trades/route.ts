
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";

function optionalNumber(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? String(number) : undefined;
}

// GET: Fetch trades for a user
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "userId is required." },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId.trim()))
      .orderBy(desc(trades.createdAt));

    return NextResponse.json({
      ok: true,
      count: result.length,
      trades: result,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not fetch trades." },
      { status: 500 }
    );
  }
}

// POST: Create a trade
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      instrument,
      direction,
      entryPrice,
      quantity,
      openedAt,
      exitPrice,
      fees,
      stopLoss,
      takeProfit,
      strategy,
      notes,
    } = body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof instrument !== "string" ||
      !instrument.trim() ||
      !["long", "short"].includes(direction) ||
      entryPrice === "" ||
      !Number.isFinite(Number(entryPrice)) ||
      Number(entryPrice) <= 0 ||
      quantity === "" ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) <= 0 ||
      typeof openedAt !== "string" ||
      Number.isNaN(Date.parse(openedAt))
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing required trade fields." },
        { status: 400 }
      );
    }

    const [newTrade] = await db
      .insert(trades)
      .values({
        userId: userId.trim(),
        instrument: instrument.trim().toUpperCase(),
        direction,
        entryPrice: String(entryPrice),
        quantity: String(quantity),
        openedAt: new Date(openedAt),
        exitPrice: optionalNumber(exitPrice) ?? null,
        fees: optionalNumber(fees) ?? null,
        stopLoss: optionalNumber(stopLoss) ?? null,
        takeProfit: optionalNumber(takeProfit) ?? null,
        strategy: typeof strategy === "string" ? strategy : null,
        notes: typeof notes === "string" ? notes : null,
      })
      .returning();

    return NextResponse.json(
      { ok: true, trade: newTrade },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not save trade." },
      { status: 500 }
    );
  }
}
