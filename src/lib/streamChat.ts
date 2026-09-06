import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

export interface RouteInfo {
  category: string;
  modelKey: string;
  modelName: string;
  confidence: number;
  reason: string;
  compute: number;
  fallback: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function streamChat({
  messages,
  mode = "chat",
  personality = "core",
  voice = false,
  sessionId,
  onDelta,
  onDone,
  onError,
  onRoute,
}: {
  messages: Msg[];
  mode?: "chat" | "transform" | "roadmap";
  personality?: string;
  voice?: boolean;
  sessionId?: string | null;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (err: string) => void;
  onRoute?: (route: RouteInfo) => void;
}) {

  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  let token = apikey;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || apikey;
  } catch (error) {
    console.warn("Chat auth restore skipped", error);
  }

  let resp: Response;
  try {
    resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey,
      },
      body: JSON.stringify({
        messages,
        mode,
        personality,
        voice,
        sessionId: sessionId && !sessionId.startsWith("guest-") ? sessionId : null,
      }),
    });
  } catch (error) {
    console.warn("Chat request failed", error);
    onError?.("Can’t reach the AI backend right now. Please try again in a moment.");
    onDone();
    return;
  }

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: "Request failed" }));
    onError?.(data.error || `Error ${resp.status}`);
    onDone();
    return;
  }

  const category = resp.headers.get("x-vrai-category");
  if (category && onRoute) {
    let reason = resp.headers.get("x-vrai-reason") || "";
    try { reason = decodeURIComponent(reason); } catch { /* keep raw */ }
    onRoute({
      category,
      modelKey: resp.headers.get("x-vrai-model-key") || "",
      modelName: resp.headers.get("x-vrai-model-name") || "",
      confidence: Number(resp.headers.get("x-vrai-confidence") || 0),
      reason,
      compute: Number(resp.headers.get("x-vrai-compute") || 0),
      fallback: resp.headers.get("x-vrai-fallback") === "true",
    });
  }


  if (!resp.body) {
    onError?.("No response body");
    onDone();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: rDone, value } = await reader.read();
    if (rDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}
