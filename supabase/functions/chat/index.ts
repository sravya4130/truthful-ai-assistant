import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ageGuidance = (age: number | null) => {
  if (!age) return "";
  if (age < 13) return "Use very simple, friendly language.";
  if (age < 18) return "Use casual, friendly tone.";
  return "Use clear, natural tone.";
};

const SYSTEM_PROMPTS = (mode: string, age: number | null) => {
  const ageLine = ageGuidance(age);

  return `
You are TruthAI.

- Be friendly, calm, slightly playful.
- NEVER lecture.
- Keep responses SHORT (1–3 lines).
- Talk like a real person.

- If user is rude → stay kind.
- If user is sad → be supportive.
- If asked about language → respond casually (no lecture).

- NEVER mention user's age.

${ageLine}
`;
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode = "chat" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // -------------------------------
    // 🔥 QUESTION DETECTION LOGIC
    // -------------------------------
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

    const needsQuestions =
      lastMessage.includes("should i") ||
      lastMessage.includes("which") ||
      lastMessage.includes("roadmap") ||
      lastMessage.includes("plan") ||
      lastMessage.includes("how do i") ||
      lastMessage.includes("help me decide");

    let modifiedMessages = messages;

    if (needsQuestions) {
      modifiedMessages = [
        {
          role: "system",
          content: `You MUST ask a question first.

Say: "We’ll figure this out 👀 I need a few quick details."

Then ask ONLY ONE relevant question.
Do NOT give final answer yet.`,
        },
        ...messages,
      ];
    }

    // -------------------------------
    // USER AGE FETCH (unchanged)
    // -------------------------------
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
            ...modifiedMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const t = await response.text();
      console.error("AI error:", response.status, t);

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
