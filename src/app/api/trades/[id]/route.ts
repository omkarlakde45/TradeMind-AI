
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validPositiveNumber(value: unknown): boolean {
  return (
    value !== "" &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0
  );
}

// PUT: Update or close a trade
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { userId, action } = body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      !id
    ) {
      return NextResponse.json(
        { ok: false, error: "Trade ID and userId are required." },
        { status: 400 }
      );
    }

    const [existingTrade] = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.id, id),
          eq(trades.userId, userId.trim())
        )
      )
      .limit(1);

    if (!existingTrade) {
      return NextResponse.json(
        { ok: false, error: "Trade not found." },
        { status: 404 }
      );
    }

    if (action === "close") {
      if (!validPositiveNumber(body.exitPrice)) {
        return NextResponse.json(
          { ok: false, error: "A valid exitPrice is required to close a trade." },
          { status: 400 }
        );
      }

      if (existingTrade.status === "closed") {
        return NextResponse.json(
          { ok: false, error: "This trade is already closed." },
          { status: 409 }
        );
      }

      const [updatedTrade] = await db
        .update(trades)
        .set({
          status: "closed",
          exitPrice: String(body.exitPrice),
          closedAt: new Date(),
          fees:
            body.fees === undefined
              ? existingTrade.fees
              : validPositiveNumber(body.fees) ||
                  (body.fees !== "" &&
                    body.fees !== null &&
                    Number(body.fees) === 0)
                ? String(body.fees)
                : null,
        })
        .where(
          and(
            eq(trades.id, id),
            eq(trades.userId, userId.trim())
          )
        )
        .returning();

      return NextResponse.json({
        ok: true,
        message: "Trade closed successfully.",
        trade: updatedTrade,
      });
    }

    if (action !== "update") {
      return NextResponse.json(
        { ok: false, error: "action must be 'update' or 'close'." },
        { status: 400 }
      );
    }

    const updates: Partial<typeof trades.$inferInsert> = {};

    if (body.instrument !== undefined) {
      if (
        typeof body.instrument !== "string" ||
        !body.instrument.trim()
      ) {
        return NextResponse.json(
          { ok: false, error: "Invalid instrument." },
          { status: 400 }
        );
      }
      updates.instrument = body.instrument.trim().toUpperCase();
    }

    if (body.direction !== undefined) {
      if (!["long", "short"].includes(body.direction)) {
        return NextResponse.json(
          { ok: false, error: "Direction must be long or short." },
          { status: 400 }
        );
      }
      updates.direction = body.direction;
    }

    for (const field of ["entryPrice", "quantity"] as const) {
      if (body[field] !== undefined) {
        if (!validPositiveNumber(body[field])) {
          return NextResponse.json(
            { ok: false, error: `${field} must be greater than zero.` },
            { status: 400 }
          );
        }

        updates[field] = String(body[field]);
      }
    }

    for (const field of ["stopLoss", "takeProfit", "fees"] as const) {
      if (body[field] !== undefined) {
        if (
          body[field] !== null &&
          body[field] !== "" &&
          !Number.isFinite(Number(body[field]))
        ) {
          return NextResponse.json(
            { ok: false, error: `${field} must be a valid number.` },
            { status: 400 }
          );
        }

        updates[field] =
          body[field] === null || body[field] === ""
            ? null
            : String(body[field]);
      }
    }

    for (const field of ["strategy", "notes"] as const) {
      if (body[field] !== undefined) {
        if (body[field] !== null && typeof body[field] !== "string") {
          return NextResponse.json(
            { ok: false, error: `${field} must be text.` },
            { status: 400 }
          );
        }
        updates[field] = body[field];
      }
    }

    if (body.openedAt !== undefined) {
      if (
        typeof body.openedAt !== "string" ||
        Number.isNaN(Date.parse(body.openedAt))
      ) {
        return NextResponse.json(
          { ok: false, error: "Invalid openedAt date." },
          { status: 400 }
        );
      }
      updates.openedAt = new Date(body.openedAt);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid fields provided to update." },
        { status: 400 }
      );
    }

    const [updatedTrade] = await db
      .update(trades)
      .set(updates)
      .where(
        and(
          eq(trades.id, id),
          eq(trades.userId, userId.trim())
        )
      )
      .returning();

    return NextResponse.json({
      ok: true,
      message: "Trade updated successfully.",
      trade: updatedTrade,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not update trade." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a trade
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId?.trim() || !id) {
      return NextResponse.json(
        { ok: false, error: "Trade ID and userId are required." },
        { status: 400 }
      );
    }

    const [deletedTrade] = await db
      .delete(trades)
      .where(
        and(
          eq(trades.id, id),
          eq(trades.userId, userId.trim())
        )
      )
      .returning({ id: trades.id });

    if (!deletedTrade) {
      return NextResponse.json(
        { ok: false, error: "Trade not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Trade deleted successfully.",
      id: deletedTrade.id,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not delete trade." },
      { status: 500 }
    );
  }
}
