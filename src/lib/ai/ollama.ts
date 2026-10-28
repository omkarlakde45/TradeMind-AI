
import "server-only";

export class OllamaError extends Error {
  constructor(
    message: string,
    public code: "offline" | "model_missing" | "failed"
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function ollamaChat(
  messages: ChatMessage[]
): Promise<string> {
  const baseUrl =
    process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

  const model = process.env.OLLAMA_MODEL;

  if (!model) {
    throw new OllamaError(
      "OLLAMA_MODEL is missing from .env.local.",
      "model_missing"
    );
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new OllamaError(
      "Cannot connect to Ollama. Check whether Ollama is running.",
      "offline"
    );
  }

  if (response.status === 404) {
    throw new OllamaError(
      `Model "${model}" was not found. Check your installed models.`,
      "model_missing"
    );
  }

  if (!response.ok) {
    throw new OllamaError(
      `Ollama returned HTTP ${response.status}.`,
      "failed"
    );
  }

  const data = await response.json();
  const content = data?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new OllamaError(
      "Ollama returned an empty response.",
      "failed"
    );
  }

  return content;
}
