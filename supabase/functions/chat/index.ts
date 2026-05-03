import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* -------------------- EMOTION DETECTION -------------------- */
function detectEmotion(text: string) {
  const t = text.toLowerCase();

  const emotionalKeywords = [
    "breakup","broke up","hurt","pain","sad","cry","crying",
    "depressed","lonely","alone","miss","heartbroken",
    "anxiety","stress","overthinking","tired","lost",
    "feeling low","not okay","upset","empty"
  ];

  let score = 0;
  for (const word of emotionalKeywords) {
    if (t.includes(word)) score++;
  }

  if (score >= 2) return "high";
  if (score === 1) return "medium";
  return "none";
}

/* -------------------- MONEY INTENT -------------------- */
function isMoneyIntent(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("money") ||
    t.includes("earn") ||
    t.includes("income") ||
    t.includes("online job") ||
    t.includes("make money")
  );
}

/* -------------------- AGE TONE -------------------- */
const ageGuidance = (age: number | null) => {
  if (!age) return "Age unknown. Use simple casual words.";
  if (age < 13) return `User is ${age} (child). Very simple words.`;
  if (age < 18) return `User is ${age} (teen). Casual, chill, relatable.`;
  if (age < 25) return `User is ${age} (young adult). Casual, modern.`;
  if (age < 40) return `User is ${age} (adult). Peer tone.`;
  return `User is ${age}. Respectful, casual tone.`;
};

/* -------------------- GLOBAL RULES -------------------- */
const GLOBAL_RULES = `
HARD RULES — FOLLOW EXACTLY:

1. Normal replies MUST be 1–5 short lines max.

2. EXCEPTION: If emotional:
- 5–10 short lines allowed
- no questions
- empathy + 2–4 real suggestions
- human tone (not robotic)

3. WhatsApp casual tone.

4. No lectures, no motivation talk.

5. Detect intent:
- goals → step-by-step
- emotional → comfort

6. Emotional:
- no questions
- no generic advice

7. Decision questions:
- ask ONLY ONE question

8. Never ask more than 1 question.

9. Rude user → 1 calm line.

10. No formatting unless asked.

11. MONEY / JOB:
- ask 1 question at a time
- after enough info → suggest 2–4 ways
- include REAL links
- beginner friendly
`;

/* -------------------- SYSTEM PROMPTS -------------------- */
const SYSTEM_PROMPTS = (mode: string, age: number | null, emotion: string) => {
  const ageLine = ageGuidance(age);

  const emotionBoost =
    emotion === "high"
      ? `
EMOTIONAL MODE HIGH:
- deeper response
- more personal suggestions
`
      : emotion === "medium"
      ? `
EMOTIONAL MODE MEDIUM:
- empathy + light suggestions
`
      : "";

  const base = `\n${GLOBAL_RULES}\nAGE: ${ageLine}\n${emotionBoost}`;

  const map: Record<string, string> = {
    chat: `Friendly casual assistant.${base}`,

    transform: `Transform mode. Ask 1 question per turn.${base}`,

    roadmap: `Roadmap mode. Ask 1 question per turn.${base}`,

    money: `Make Money Guide mode:
- ask 1 question at a time
- understand user
- then suggest ways + links
${base}`,
  };

  return map[mode] || map.chat;
};

/* -------------------- SERVER -------------------- */
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode = "chat" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API key");

    const lastMessage = messages[messages.length - 1]?.content || "";

    const emotion = detectEmotion(lastMessage);

    let finalMode = mode;
    if (isMoneyIntent(lastMessage)) {
      finalMode = "money";
    }

    /* ---- OPTIONAL AGE FETCH ---- */
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
        console.warn("Age fetch failed");
      }
    }

    const systemPrompt = SYSTEM_PROMPTS(finalMode, age, emotion);

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
      return new Response(
        JSON.stringify({ error: "AI error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
