import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

/* ---------------- EMOTION DETECTION ---------------- */
function detectEmotion(text: string) {
  const t = text.toLowerCase();
  const words = ["breakup","sad","hurt","cry","lonely","depressed","stress"];
  let score = 0;
  words.forEach(w => { if (t.includes(w)) score++; });
  if (score >= 2) return "high";
  if (score === 1) return "medium";
  return "none";
}

/* ---------------- MONEY INTENT ---------------- */
function isMoneyIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("money") || t.includes("earn") || t.includes("income");
}

/* ---------------- MEMORY ---------------- */
async function getMemory(client: any, userId: string) {
  const { data } = await client
    .from("user_memory")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.data || {};
}

async function saveMemory(client: any, userId: string, newData: any) {
  const old = await getMemory(client, userId);
  await client.from("user_memory").upsert({
    user_id: userId,
    data: { ...old, ...newData }
  });
}

function extractPrefs(text: string) {
  const t = text.toLowerCase();
  const prefs: any = {};
  if (t.includes("hour")) prefs.hours = text;
  if (t.includes("face")) prefs.face = t.includes("no") ? "no" : "yes";
  return prefs;
}

/* ---------------- RULES ---------------- */
const GLOBAL_RULES = `
- normal: short replies
- emotional: longer, no questions, suggestions
- money: ask first, then suggest with links
`;

/* ---------------- PROMPT ---------------- */
function SYSTEM_PROMPT(mode: string, emotion: string, memory: any) {

  if (mode === "money") {
    return `
Make Money Guide:

STRICT:
- start: "you can definitely do this, let's start"
- ask ONE question
- ask 2–4 questions total
- DO NOT suggest early

USER MEMORY: ${JSON.stringify(memory)}

After enough info:
- suggest ways
- include real links
${GLOBAL_RULES}
`;
  }

  return `Friendly assistant\n${GLOBAL_RULES}`;
}

/* ---------------- SERVER ---------------- */
serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");

    const last = messages[messages.length - 1]?.content || "";

    const emotion = detectEmotion(last);
    let mode = isMoneyIntent(last) ? "money" : "chat";

    /* -------- MEMORY -------- */
    let memory = {};
    let client: any = null;

    const auth = req.headers.get("Authorization");

    if (auth) {
      const url = Deno.env.get("SUPABASE_URL")!;
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

      client = createClient(url, anon, {
        global: { headers: { Authorization: auth } }
      });

      const { data: { user } } = await client.auth.getUser();

      if (user) {
        memory = await getMemory(client, user.id);

        const newPrefs = extractPrefs(last);
        if (Object.keys(newPrefs).length) {
          await saveMemory(client, user.id, newPrefs);
          memory = { ...memory, ...newPrefs };
        }
      }
    }

    const prompt = SYSTEM_PROMPT(mode, emotion, memory);

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
