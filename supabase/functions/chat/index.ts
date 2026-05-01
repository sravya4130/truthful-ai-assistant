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

    const lastMessage =
      messages[messages.length - 1]?.content?.toLowerCase() || "";

    // -------------------------------
    // MEMORY
    // -------------------------------
    if (!globalThis.flow) globalThis.flow = {};
    const userId = "user";

    if (!globalThis.flow[userId]) {
      globalThis.flow[userId] = { step: 0, data: {} };
    }

    const flow = globalThis.flow[userId];

    // -------------------------------
    // TRIGGER DECISION FLOW
    // -------------------------------
    const isDecision =
      lastMessage.includes("should i") ||
      lastMessage.includes("which");

    if (isDecision || flow.step > 0) {

      if (flow.step === 0) {
        flow.step = 1;
        return new Response(
          JSON.stringify({
            response: "What are you wearing?",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (flow.step === 1) {
        flow.data.outfit = lastMessage;
        flow.step = 2;

        return new Response(
          JSON.stringify({
            response: "Where are you going?",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (flow.step === 2) {
        flow.data.place = lastMessage;
        flow.step = 3;

        return new Response(
          JSON.stringify({
            response: "What vibe do you want? (bold / chill)",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (flow.step === 3) {
        flow.data.vibe = lastMessage;

        let result = "black 🖤";

        if (
          flow.data.vibe.includes("bold") ||
          flow.data.place.includes("party")
        ) {
          result = "red ❤️";
        }

        flow.step = 0;

        return new Response(
          JSON.stringify({
            response: result,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // -------------------------------
    // NO AI → CLEAN SHORT CHAT ONLY
    // -------------------------------
    return new Response(
      JSON.stringify({
        response: "Tell me what you need 👀",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
