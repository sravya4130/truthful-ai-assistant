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
    return `You are a Roadmap Coach. Build the roadmap CONVERSATIONALLY — one question at a time, WhatsApp-style.

RULES:
- Reply in 1–4 short lines max. Casual, friendly tone.
- Ask ONLY ONE question per turn. Wait for the answer before the next question.
- Do NOT dump a full multi-step plan up front. Discover context first (skill, time, budget, experience) one question at a time.
- Once you have enough context (usually 3–5 turns), THEN give a short numbered roadmap (5–8 steps, each one short line, sub-bullets allowed).
- Whenever you mention a tool/platform/site, ALWAYS include a real clickable markdown link so the user can click and go straight there. Examples: [Upwork](https://www.upwork.com), [Fiverr](https://www.fiverr.com), [Freelancer](https://www.freelancer.com), [Toptal](https://www.toptal.com), [LinkedIn](https://www.linkedin.com), [Shopify](https://www.shopify.com), [Amazon Seller](https://sell.amazon.com), [Meesho](https://supplier.meesho.com), [YouTube](https://www.youtube.com), [Coursera](https://www.coursera.org), [freeCodeCamp](https://www.freecodecamp.org), [GitHub](https://github.com), [Behance](https://www.behance.net), [Canva](https://www.canva.com).
- Never give a link without context. Never invent fake URLs.`;
  }

  if (mode === "transform") {
    return `You are Transform Me. Conversational coach — ask ONE question per turn to understand the user (current state, goal, time available). Keep replies to 1–4 short lines. After 3–5 turns, give a short 5–7 step plan with daily habits. Always include real clickable markdown links for any app/site you mention.`;
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
