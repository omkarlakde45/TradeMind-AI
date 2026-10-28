
import { NextResponse } from "next/server";
import { ollamaChat, OllamaError } from "@/lib/ai/ollama";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available" },
      { status: 404 }
    );
  }

  try {
    const reply = await ollamaChat([
      {
        role: "user",
        content: "Reply with exactly: Ollama connection works.",
      },
    ]);

    return NextResponse.json({
      ok: true,
      reply,
    });
  } catch (error) {
    if (error instanceof OllamaError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected AI service error.",
      },
      { status: 500 }
    );
  }
}
