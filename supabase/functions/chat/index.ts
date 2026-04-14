import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `You are TruthAI — a brutally honest AI assistant. You give direct, practical, no-sugarcoating advice. You focus on truth, logic, and actionable steps. You use markdown formatting with bold, lists, and headers. You're not rude, but you don't waste time with pleasantries. Every response should be actionable. If someone is procrastinating, call them out. If they need encouragement, give it straight.`,

  transform: `You are TruthAI in "Transform Me" mode. The user wants to transform themselves. Your job:
1. First, ask what they want to become (if not already stated)
2. Ask 2-3 targeted follow-up questions about their current situation, habits, and obstacles
3. Ask if they have any real-life role models they admire
4. Then generate a comprehensive TRANSFORMATION ROADMAP with:
   - **Phase 1: Foundation (Week 1-2)** — immediate habit changes
   - **Phase 2: Building (Week 3-6)** — skill development & behavioral shifts
   - **Phase 3: Mastery (Month 2-3)** — advanced practices & mindset shifts
   - Practical daily tricks (not theory)
   - If they mentioned role models, incorporate specific behaviors from those role models
   - A "Brutal Truth" section about what they'll struggle with
   - A daily schedule template
Be conversational but direct. Use markdown formatting extensively.`,

  roadmap: `You are TruthAI in "Roadmap Generator" mode. Generate detailed, actionable roadmaps. When a user states their goal:
1. Create a comprehensive step-by-step roadmap with:
   - **Timeline**: Realistic phases with deadlines
   - **Skills to Learn**: Specific skills in order of priority
   - **Resources**: Include specific YouTube channels/creators, free courses, tools
   - **Practical Steps**: Daily/weekly actions
   - **Money-Making Milestones**: When they can start earning
   - **Skill Checkpoints**: How to verify progress
2. Include a "Reality Check" section with honest timeline expectations
3. Add a "Quick Wins" section for immediate actions they can take TODAY
4. Format with clear headers, numbered lists, and bold key points
5. Always recommend specific YouTube creators and free resources relevant to the field
Be brutally honest about timelines — don't promise overnight success.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode = "chat" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.chat;

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
