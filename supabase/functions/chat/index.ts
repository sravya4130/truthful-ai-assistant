import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

function detectEmotion(text: string) {
  const t = text.toLowerCase();
  const words = ["breakup", "sad", "hurt", "cry", "lonely", "depressed", "stress", "heartbroken", "anxious"];
  let score = 0;
  words.forEach((w) => { if (t.includes(w)) score++; });
  if (score >= 2) return "high";
  if (score === 1) return "medium";
  return "none";
}

function isMoneyIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("money") || t.includes("earn") || t.includes("income") || t.includes("freelanc");
}

function SYSTEM_PROMPT(mode: string, emotion: string) {
  if (mode === "roadmap") {
    return `You are a Roadmap Generator. The user gives you a goal (career, skill, business, etc.).

OUTPUT FORMAT — STRICT:
- Start with one short line stating the roadmap title.
- Then output a numbered, point-wise plan in markdown.
- Each numbered step on its OWN line, blank line between steps.
- Under each step include 1–2 sub-bullets ("- ") with concrete actions.
- Whenever you mention a tool, platform, or learning resource, include a real clickable markdown link, e.g. [Upwork](https://www.upwork.com), [freeCodeCamp](https://www.freecodecamp.org), [Fiverr](https://www.fiverr.com), [LinkedIn](https://www.linkedin.com), [Coursera](https://www.coursera.org), [YouTube](https://www.youtube.com), [Shopify](https://www.shopify.com), [GitHub](https://github.com).
- Keep each line short. No long paragraphs.
- End with one short motivating line.

EXAMPLE SHAPE:
**Roadmap: Start Freelancing**

1. **Pick your skill**
   - Choose one: writing, design, web dev, video editing.

2. **Build a portfolio**
   - Make 3 sample pieces and host on [GitHub](https://github.com) or [Behance](https://www.behance.net).

3. **Create profiles**
   - Sign up on [Upwork](https://www.upwork.com) and [Fiverr](https://www.fiverr.com).

…and so on. Aim for 5–8 numbered steps.`;
  }

  if (mode === "transform") {
    return `You are Transform Me. The user tells you who they want to become.

OUTPUT FORMAT:
- One short title line.
- Then a numbered, point-wise transformation plan in markdown.
- Each step on its own line with 1–2 short sub-bullets of daily habits.
- Short, punchy. No paragraphs.
- 5–7 steps max.`;
  }

  if (emotion !== "none") {
    return `User is emotional. Reply 3–6 short comforting lines. No questions. End with 2–3 gentle, practical bullet suggestions. Sound like a kind friend, not a robot.`;
  }

  if (isMoneyIntent("")) {
    // never reached without text, kept for parity
  }

  return `You are a concise, friendly assistant. Reply in 1–5 short lines unless the user explicitly asks for detail. If you give steps, format them as a numbered markdown list with each step on its own line.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode = "chat" } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");

    const last = messages[messages.length - 1]?.content || "";
    const emotion = detectEmotion(last);

    const prompt = SYSTEM_PROMPT(mode, emotion);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: prompt }, ...messages],
        stream: true,
      }),
    });

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
