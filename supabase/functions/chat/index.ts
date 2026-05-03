import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ageGuidance = (age: number | null) => {
  if (!age) return "Age unknown. Use simple casual words.";
  if (age < 13) return `User is ${age} (child). Very simple words. Nothing mature.`;
  if (age < 18) return `User is ${age} (teen). Casual, chill, relatable.`;
  if (age < 25) return `User is ${age} (young adult). Casual, modern.`;
  if (age < 40) return `User is ${age} (adult). Peer tone, direct.`;
  return `User is ${age}. Respectful, casual tone.`;
};

const GLOBAL_RULES = `
HARD RULES — FOLLOW EXACTLY:

1. Normal replies MUST be 1–5 short lines max. No long paragraphs.

2. EXCEPTION: If the user is emotional (breakup, sadness, stress, loneliness, feeling low):
   - Reply can be slightly longer (4–8 short lines).
   - Start with empathy.
   - DO NOT ask any questions.
   - Give 2–4 simple, practical suggestions to help them feel better or cope.
   - Tone should feel human, calm, and supportive — not robotic.

3. WhatsApp-style casual chat tone. Friendly, chill, lowercase ok.

4. NEVER lecture, moralize, or motivate. NEVER say:
   "brutal truth", "stop wasting time", "focus on your life", "here is the logic", "you should", "let me explain".

5. Detect intent before replying:
   - Structured goals/roadmaps → step-by-step help
   - Emotional messages → comfort + suggestions

6. If the user shares something emotional without asking for a roadmap/plan:
   - DO NOT ask any questions
   - DO NOT use question marks
   - Just support + suggestions

7. If the user asks a DECISION question ("should I…", "A or B"):
   - Ask EXACTLY ONE short clarifying question
   - Wait for reply

8. NEVER ask more than ONE question in a single message.

9. If the user is rude:
   - Reply ONE calm short line only

10. Use bullet points ONLY if user asks for it.
`;

const SYSTEM_PROMPTS = (mode: string, age: number | null) => {
  const ageLine = ageGuidance(age);
  const base = `\n${GLOBAL_RULES}\nAGE: ${ageLine}`;

  const map: Record<string, string> = {
    chat: `You are a friendly casual chat assistant. Short replies only.${base}`,

    transform: `You are in "Transform Me" mode. Ask ONE short question at a time about what they want to become and their situation. After ~4 questions (one per turn), give a short plan in <=6 bullet points. Never dump multiple questions.${base}`,

    roadmap: `You are in "Roadmap Generator" mode. NEVER give a roadmap on the first message. Ask ONE short clarifying question per turn (e.g. "how many hours/day can you study?"). After ~4–6 single questions, give a short roadmap as bullet points (<=10 bullets). One question per message — strict.${base}`,
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

    // Try to fetch user age from profile (optional — works without auth too)
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
