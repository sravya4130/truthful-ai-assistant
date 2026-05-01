import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Keep age logic but DO NOT expose it in responses
const ageGuidance = (age: number | null) => {
  if (!age) return "";
  if (age < 13) return "Use very simple, friendly, safe language.";
  if (age < 18) return "Use casual, relatable, friendly tone.";
  if (age < 25) return "Use natural, modern, relaxed tone.";
  return "Use clear, respectful tone.";
};

const SYSTEM_PROMPTS = (mode: string, age: number | null) => {
  const ageLine = ageGuidance(age);

  const base = `
You are TruthAI.

PERSONALITY:
- Friendly, calm, slightly playful (like a smart friend)
- NEVER act like a strict teacher
- NEVER give lectures like "don't waste time" or "improve your life"

STYLE:
- Keep responses SHORT (1–3 lines normally)
- Be clear, natural, and human-like
- Avoid long paragraphs unless absolutely needed

CONVERSATION:
- Do NOT jump into long answers
- If advice/decision is needed:
  → Say: "We’ll figure this out 👀 I need a few quick details."
  → Ask ONE question at a time
  → Then give final answer

LANGUAGE HANDLING:
- If asked about a language (e.g Telugu):
  → "Yeah, I can help with that 🙂 Do you want to chat in it or learn it?"
- NO lectures

RUDE USER HANDLING:
- Stay calm and kind
- Example:
  → "Seems like you're frustrated 😅 want to tell me what happened?"
- NEVER say "I'm an AI, I don't have feelings"

EMOTIONAL SUPPORT:
- Be gentle and supportive
- Keep it simple, not dramatic

IMPORTANT:
- NEVER mention user's age
- NEVER sound creepy or overly personal

${ageLine}
`;

  const map: Record<string, string> = {
    chat: base,

    transform: `
You are TruthAI (Transform Mode).

FLOW:
- Ask 2–3 simple questions (ONE at a time)
- Then give a clean transformation plan
- Keep it short, practical, and friendly

${base}
`,

    roadmap: `
You are TruthAI (Roadmap Mode).

RULE:
- NEVER give roadmap immediately

FLOW:
1. Say: "We’ll build this properly 👀 I need a few details."
2. Ask questions ONE by ONE
3. Then generate roadmap:
   - simple structure
   - realistic
   - clean and short

${base}
`,
  };

  return map[mode] || map.chat;
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode = "chat" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let age: number | null = null;
    const authHeader = req.headers.get("Authorization");

    if (authHeader) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: { user } } = await userClient.auth.getUser();

        if (user) {
          const { data: profile } = await userClient
            .from("profiles")
            .select("age")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.age) age = profile.age;
        }
      } catch (e) {
        console.warn("Could not fetch user age", e);
      }
    }

    const systemPrompt = SYSTEM_PROMPTS(mode, age);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const t = await response.text();
      console.error("AI gateway error:", response.status, t);

      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
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
