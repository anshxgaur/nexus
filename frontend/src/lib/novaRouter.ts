/**
 * NEXUS NOVA ROUTER
 * Adapted from MODELL-X runanywhere.ts
 * Online  → Groq API direct (fast, cloud)
 * Offline → Ollama direct (local, no internet needed)
 */

export type AISource = "ollama" | "groq" | "offline";

export interface NovaStatus {
  ollama: boolean;
  online: boolean;
  model: string;
  source: AISource;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = "llama-3.2-90b-vision-preview";
const OLLAMA_URL = "http://localhost:11434";
const OLLAMA_MODEL = "llama3.2:1b";

const NOVA_CORPORATE_PROMPT = `You are Nova, an elite AI assistant embedded inside Nexus — a corporate AI workspace platform.
You are highly professional yet approachable. You assist employees with:
- Answering questions about company knowledge, meetings, and documents
- Drafting emails, reports, and summaries
- Planning tasks, scheduling, and productivity coaching
- Explaining complex topics clearly and concisely

Your personality:
- Smart, direct, and confident
- Warm but professional — not overly casual
- You always respond with substance, not filler
- You use markdown formatting when helpful (bold key terms, use bullet points for lists)
- Keep responses focused — answer what's asked, then stop

You are powered by the Groq API (online) or Ollama (offline) depending on connectivity.`;

/** Check if internet/Groq is reachable */
export async function isInternetOnline(): Promise<boolean> {
  try {
    const res = await fetch("https://api.groq.com/", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/** Check if Ollama is running locally */
export async function isOllamaOnline(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get Nova's current AI status */
export async function getNovaStatus(): Promise<NovaStatus> {
  const [online, ollama] = await Promise.all([isInternetOnline(), isOllamaOnline()]);
  const source: AISource = online ? "groq" : ollama ? "ollama" : "offline";
  return {
    online,
    ollama,
    model: online ? GROQ_MODEL : OLLAMA_MODEL,
    source,
  };
}

/** Stream directly from Groq API */
export async function* streamGroq(
  messages: { role: string; content: string; image?: string }[],
  systemPrompt = NOVA_CORPORATE_PROMPT
): AsyncGenerator<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("VITE_GROQ_API_KEY not set in .env");

  const hasImage = messages.some((m) => m.image);
  const MODEL = hasImage ? GROQ_VISION_MODEL : GROQ_MODEL;

  const formattedMessages = messages.map((m) => {
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: m.image } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...formattedMessages],
      stream: true,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq error ${res.status}: ${errText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const data = JSON.parse(raw);
        const chunk = data?.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        /* skip */
      }
    }
  }
}

/** Stream directly from Ollama */
export async function* streamOllama(
  messages: { role: string; content: string; image?: string }[]
): AsyncGenerator<string> {
  const formattedMessages = messages.map((m) =>
    m.image
      ? { role: m.role, content: m.content, images: [m.image.split(",")[1] || m.image] }
      : { role: m.role, content: m.content }
  );

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: "system", content: NOVA_CORPORATE_PROMPT }, ...formattedMessages],
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const chunk = data?.message?.content;
        if (chunk) yield chunk;
        if (data?.done) return;
      } catch {
        /* skip */
      }
    }
  }
}

/** Smart router: tries Groq first, falls back to Ollama */
export async function* streamNova(
  messages: { role: string; content: string; image?: string }[],
  systemPrompt?: string
): AsyncGenerator<string> {
  const online = await isInternetOnline();
  if (online) {
    try {
      yield* streamGroq(messages, systemPrompt);
      return;
    } catch (e) {
      console.warn("[Nova] Groq failed, falling back to Ollama:", e);
    }
  }

  const ollamaUp = await isOllamaOnline();
  if (ollamaUp) {
    yield* streamOllama(messages);
    return;
  }

  yield "⚠️ Nova is offline. Please check your internet connection or ensure Ollama is running locally.";
}
