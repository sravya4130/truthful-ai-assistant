import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_GUIDANCE: Record<string, string> = {
  wedding: "Romantic, warm tone. Sections might include: cover (couple names + date), love story, venue, ceremony, reception, gallery moments, thank you. Use evocative, heartfelt language.",
  resume: "Professional CV style. Sections: cover (name + role), summary, experience, skills, education, projects, contact. Bullet points should be impact-focused.",
  school: "Educational, clear, age-appropriate. Sections: title, introduction, key facts, examples, diagrams (described as bullets), conclusion, sources. Use simple language.",
  work: "Corporate, executive tone. Sections: title, agenda, problem, approach, key insights, data points, recommendations, next steps. Be concise and outcome-focused.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, template, slideCount = 8 } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const templateKey = (template || "work").toLowerCase();
    const guidance = TEMPLATE_GUIDANCE[templateKey] || TEMPLATE_GUIDANCE.work;
    const count = Math.min(Math.max(parseInt(String(slideCount)) || 8, 3), 15);

    const sys = `You generate slide content for a presentation. Output ONLY valid JSON via the provided tool. No prose. Tone & structure: ${guidance}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Create a ${count}-slide presentation about: ${prompt}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_presentation",
            description: "Return slides for a presentation",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Overall presentation title" },
                subtitle: { type: "string", description: "Subtitle for cover slide" },
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      bullets: { type: "array", items: { type: "string" }, description: "3-6 bullet points" },
                      notes: { type: "string", description: "Optional speaker notes" },
                    },
                    required: ["title", "bullets"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "subtitle", "slides"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_presentation" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      console.error("No tool call", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "No content returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(JSON.stringify({ ...parsed, template: templateKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ppt-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
