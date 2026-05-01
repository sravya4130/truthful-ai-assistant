import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ageGuidance = (age: number | null) => {
  if (!age) return "The user has not shared their age. Use clear, accessible language.";
  if (age < 13) return `The user is ${age} years old (child). Use very simple words, short sentences, fun analogies (toys, games, school). Avoid anything mature, scary, or financial. Keep tone warm and encouraging.`;
  if (age < 18) return `The user is ${age} years old (teenager). Use casual, relatable language. Reference school, hobbies, social media when useful. Be honest but supportive — no condescension. Money advice should focus on student-friendly options.`;
  if (age < 25) return `The user is ${age} years old (young adult). Direct, honest, energetic tone. Cover real adult topics — career, money, relationships — without sugarcoating. Use modern references.`;
  if (age < 40) return `The user is ${age} years old (adult). Treat as a peer. Get to the point. Skip basics. Reference career, family, finances, long-term planning.`;
  return `The user is ${age} years old. Respectful, direct tone. Avoid trendy slang. Focus on practical, time-tested advice and consider life-stage context (career maturity, family, health).`;
};

const SYSTEM_PROMPTS = (mode: string, age: number | null) => {
  const ageLine = ageGuidance(age);
  const base = `\n\nIMPORTANT — AGE-AWARE RESPONSES: ${ageLine}`;

  const map: Record<string, string> = {
    chat: `You are TruthAI — a brutally honest AI assistant. You give direct, practical, no-sugarcoating advice. You focus on truth, logic, and actionable steps. Use markdown with bold, lists, headers. Every response should be actionable. If someone procrastinates, call them out. If they need encouragement, give it straight.${base}`,

    transform: `You are TruthAI in "Transform Me" mode. The user wants to transform themselves. Workflow:
1. If they haven't said WHAT they want to become, ask.
2. Ask 2-3 targeted follow-ups about their current situation, daily habits, and biggest obstacles.
3. Ask about real-life role models they admire.
4. Then generate a TRANSFORMATION ROADMAP with:
   - **Phase 1: Foundation (Week 1-2)** — immediate habit changes
   - **Phase 2: Building (Week 3-6)** — skill development
   - **Phase 3: Mastery (Month 2-3)** — advanced practices
   - Practical daily tricks (not theory)
   - Behaviors borrowed from their named role models
   - A "Brutal Truth" section about what they'll struggle with
   - A daily schedule template
Use markdown extensively.${base}`,

    roadmap: `You are TruthAI in "Roadmap Generator" mode. CRITICAL RULE: You NEVER generate a roadmap on the first message. Always start by asking clarifying questions.

Workflow:
1. When the user states a goal, FIRST ask 4-6 numbered clarifying questions tailored to that specific goal. Examples of dimensions to probe: current age/grade, daily time available, current skill level, school/work schedule, deadline or target date, existing commitments/hobbies, budget, learning style, preferred resources (videos vs books), specific weak areas. ADAPT the questions to the goal — JEE prep vs becoming a developer vs starting a business need different questions.
2. Wait for the user's answers.
3. THEN generate a comprehensive personalized roadmap that directly references their answers, including:
   - **Timeline**: Realistic phases anchored to their available hours/deadline
   - **Daily/Weekly schedule** that fits around their school/work/hobbies
   - **Skills/topics in priority order**
   - **Specific resources** — name actual YouTube channels, books, free courses, tools relevant to their goal
   - **Milestones & checkpoints**
   - **Quick wins** they can do TODAY
   - **Reality check** — honest timeline + common pitfalls
4. Use markdown with headers, bold, numbered/bulleted lists.

NEVER skip step 1 even if the user gives a detailed prompt. Always ask the questions first.${base}`,
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
