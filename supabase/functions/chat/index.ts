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
    const userMessage =
      messages[messages.length - 1]?.content?.toLowerCase() || "";

    // 🔥 STEP 1: FORCE QUESTION FLOW (NO AI)
    const isDecision =
      userMessage.includes("should i") ||
      userMessage.includes("which") ||
      userMessage.includes("roadmap") ||
      userMessage.includes("plan") ||
      userMessage.includes("how do i");

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

    // 🔥 STEP 2: NORMAL CHAT (SHORT + FRIENDLY)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
          max_tokens: 120,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: `
You are a friendly AI.

RULES:
- Keep replies SHORT (1–3 lines)
- No lectures
- No long paragraphs
- Talk casually like a friend
- Be kind if user is rude
- If user asks about language → respond friendly (no lecture)
`,
            },
            ...messages,
          ],
          stream: false,
        }),
      }
    );

    const data = await aiResponse.json();
    const reply =
      data?.choices?.[0]?.message?.content || "Something went wrong";

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
