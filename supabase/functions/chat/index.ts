import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

/* -------- EMOTION DETECTION -------- */
function detectEmotion(text: string) {
  const t = text.toLowerCase();
  const words = ["breakup","sad","hurt","cry","lonely","depressed","stress"];
  let score = 0;
  words.forEach(w => { if (t.includes(w)) score++; });

  if (score >= 2) return "high";
  if (score === 1) return "medium";
  return "none";
}

/* -------- MONEY INTENT -------- */
function isMoneyIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("money") || t.includes("earn") || t.includes("income");
}

/* -------- PROMPT -------- */
function SYSTEM_PROMPT(mode: string, emotion: string) {

  if (mode === "money") {
    return `
You are in Make Money Guide mode.

STRICT FLOW:
- Start with: "you can definitely do this, let's start"
- Ask ONLY ONE question
- Ask 2–4 questions total
- DO NOT give suggestions early

After enough answers:
- Suggest 2–4 ways to earn
- Include real links

Tone: simple, confident, helpful
`;
  }

  if (emotion !== "none") {
    return `
User is emotional.

- Reply 5–10 short lines
- No questions
- Show empathy
- Give 2–4 real suggestions
- Sound like a friend, not a robot
`;
  }

  return `Friendly short assistant.`;
}

/* -------- SERVER -------- */
serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");

    const last = messages[messages.length - 1]?.content || "";

    const emotion = detectEmotion(last);
    const mode = isMoneyIntent(last) ? "money" : "chat";

    const prompt = SYSTEM_PROMPT(mode, emotion);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: prompt },
          ...messages
        ],
        stream: true
      })
    });

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: "error" }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
