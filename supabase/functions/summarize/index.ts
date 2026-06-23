import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

type Mode = "quick" | "detailed" | "age" | "takeaways" | "simplify";

function buildPrompt(mode: Mode, age?: string) {
  const base = `You are Summarizo — a brilliant assistant that distills long content into clear, useful summaries. Be accurate, neutral, and skip filler. Format using clean markdown.`;
  switch (mode) {
    case "quick":
      return `${base}

Task: QUICK SUMMARY
- 2 to 5 short lines.
- Only the core essence.
- No bullets, no headings — just clean prose.`;
    case "detailed":
      return `${base}

Task: DETAILED SUMMARY
- Cover all important ideas as concise bullet points.
- Group related points under short bold sub-headings if helpful.
- Keep each bullet 1–2 lines. Skip fluff.`;
    case "age": {
      const audience: Record<string, string> = {
        "10": "a curious 10-year-old. Use very simple words, short sentences, friendly tone, and tiny relatable examples (toys, school, games).",
        "15": "a 15-year-old high-schooler. Use plain language, light analogies, and a casual tone. No heavy jargon.",
        "college": "a college student. Be clear and structured, you can use academic terms but define them briefly.",
        "pro": "a professional / expert. Be concise, precise, and use proper domain terminology. Skip basics.",
      };
      const a = audience[age || "15"] || audience["15"];
      return `${base}

Task: AGE-BASED EXPLANATION
Explain the content to ${a}
- Start with a 1-line TL;DR.
- Then 4–8 short, easy points.
- Use an analogy if it helps understanding.`;
    }
    case "takeaways":
      return `${base}

Task: KEY TAKEAWAYS
Return three short sections:
**💡 Key Insights** — 3–5 bullets
**✅ Actionable Points** — 3–5 bullets the reader can actually do
**📌 Important Facts** — 3–5 bullets with concrete facts/numbers/names`;
    case "simplify":
      return `${base}

Task: SMART SIMPLIFICATION
Rewrite the content in very easy-to-understand language.
- Replace jargon with everyday words (keep the original term in parentheses the first time).
- Short sentences. Friendly tone.
- Preserve every important idea — do not skip meaning, just simplify wording.`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, mode = "quick", age } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "Missing content" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = content.slice(0, 60000);
    const key = Deno.env.get("LOVABLE_API_KEY");
    const system = buildPrompt(mode as Mode, age);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Here is the content to process:\n\n${trimmed}` },
        ],
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
      let friendly = errText;
      if (res.status === 429) friendly = "Rate limit reached. Please try again in a moment.";
      if (res.status === 402) friendly = "AI credits exhausted. Add credits to continue.";
      return new Response(JSON.stringify({ error: friendly }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

  } catch (e) {
    console.error("summarize error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
