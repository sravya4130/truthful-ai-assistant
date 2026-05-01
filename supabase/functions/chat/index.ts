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

    // 🔥 KEEP ONLY USER MESSAGES (remove old AI personality)
    const cleanMessages = messages.filter((m: any) => m.role === "user");

    const lastMessage =
      cleanMessages[cleanMessages.length - 1]?.content?.toLowerCase() || "";

    // 🔥 FORCE QUESTION FLOW
    const isDecision =
      lastMessage.includes("should i") ||
      lastMessage.includes("which") ||
      lastMessage.includes("roadmap") ||
      lastMessage.includes("plan") ||
      lastMessage.includes("how do i");

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

    // 🔥 AI CALL
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
          max_tokens: 100,
          temperature: 0.6,
          messages: [
            {
              role: "system",
              content: `
You are a friendly, chill AI.

STRICT RULES:
- Keep replies SHORT (1–2 lines only)
- NO lectures
- NO "stop wasting time"
- NO "go fix your life"
- NO long explanations
- Talk like a normal friend

If user is rude:
→ Stay calm and kind

If user is sad:
→ Be supportive, simple

If user asks about language:
→ Be friendly, no lecture

Break rules = wrong answer
`,
            },
            ...cleanMessages,
          ],
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
