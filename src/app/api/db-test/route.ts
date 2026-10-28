
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = result.rows.map((row) => row.table_name);

    return NextResponse.json({
      ok: true,
      database: "connected",
      tables,
      tradesTableExists: tables.includes("trades"),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not inspect database tables." },
      { status: 500 }
    );
  }
}
