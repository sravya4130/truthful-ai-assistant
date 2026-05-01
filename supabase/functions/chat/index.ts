import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    // 🔥 TAKE ONLY LAST 5 MESSAGES (keeps context but avoids old personality)
    const recentMessages = messages.slice(-5);

    const lastMessage =
      recentMessages[recentMessages.length - 1]?.content?.toLowerCase() || "";

    // 🔥 STRONG DECISION DETECTION
    const isDecision =
      /(should i|which|roadmap|plan|how do i|help me decide)/i.test(lastMessage);

    // 🔥 HARD OVERRIDE (NO AI)
    if (isDecision) {
      return new Response(
        JSON.stringify({
          response: "We’ll figure this out 👀\nWhat kind of event is it?",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // 🔥 AI CALL
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: 80,
          temperature: 0.5,
          messages: [
            {
              role: "system",
              content: `
You are a friendly AI.

RULES:
- Max 2 lines ONLY
- No long text
- No advice paragraphs
- No "stop wasting time"
- No lecture tone
- Talk like a normal friend

If user is rude → stay calm
If sad → be supportive

Break rules = wrong
`,
            },
            ...recentMessages,
          ],
        }),
      }
    );

    const data = await aiResponse.json();

    let reply =
      data?.choices?.[0]?.message?.content || "Something went wrong";

    // 🔥 HARD TRIM (extra safety)
    reply = reply.split("\n").slice(0, 2).join("\n");

    return new Response(
      JSON.stringify({ response: reply }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
