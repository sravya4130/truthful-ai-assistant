import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 🔥 STRICT SYSTEM PROMPT
const SYSTEM_PROMPT = `
You are TruthAI.

STRICT RULES:
- Keep replies VERY SHORT (max 2 lines).
- NEVER give long explanations.
- NEVER give lists or breakdowns.
- NEVER lecture or sound like a teacher.
- Talk like a friendly, chill teen.

DECISION QUESTIONS:
If user asks "should I", "which", "roadmap", "plan":
→ Say: "We’ll figure this out 👀"
→ Ask ONLY ONE question
→ DO NOT answer yet

RUDE USERS:
→ Stay calm and kind

LANGUAGE:
→ Be casual, simple, friendly

If you break rules, the answer is wrong.
`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // 🔥 DETECT QUESTION TYPE
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

    const needsQuestions =
      lastMessage.includes("should i") ||
      lastMessage.includes("which") ||
      lastMessage.includes("roadmap") ||
      lastMessage.includes("plan") ||
      lastMessage.includes("how do i");

    let finalMessages = messages;

    if (needsQuestions) {
      finalMessages = [
        {
          role: "system",
          content: `We’ll figure this out 👀 Ask ONE question only. Do not answer yet.`,
        },
        ...messages,
      ];
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini", // 🔥 FIXED MODEL
          max_tokens: 120,             // 🔥 FORCE SHORT
          temperature: 0.7,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...finalMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("AI error:", response.status, text);

      return new Response(
        JSON.stringify({ error: "AI error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat error:", e);

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
