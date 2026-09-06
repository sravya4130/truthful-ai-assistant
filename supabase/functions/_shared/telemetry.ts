/**
 * VRAI TELEMETRY
 * Writes routing decisions + usage estimates so the efficiency research
 * dashboard has real data. Failures here must never break a chat response.
 */

export interface RoutingLog {
  user_id?: string | null;
  session_id?: string | null;
  category: string;
  router_confidence: number;
  router_reason: string;
  model_key: string;
  model_id: string;
  fallback_used?: boolean;
  fallback_from?: string | null;
  latency_ms?: number | null;
  prompt_chars?: number | null;
  context_messages?: number | null;
  estimated_compute?: number | null;
  error?: string | null;
}

function creds() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? { url, key } : null;
}

/** Fire-and-forget insert. Returns the created row id when available. */
export async function logRouting(row: RoutingLog): Promise<string | null> {
  const c = creds();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/routing_logs`, {
      method: "POST",
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${c.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([row]),
    });
    if (!res.ok) {
      console.warn("telemetry: routing log failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.[0]?.id ?? null;
  } catch (e) {
    console.warn("telemetry: routing log error", String(e));
    return null;
  }
}

export async function logUsage(row: {
  user_id?: string | null;
  routing_log_id?: string | null;
  model_key: string;
  category: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  latency_ms?: number | null;
  estimated_compute?: number | null;
}) {
  const c = creds();
  if (!c) return;
  try {
    await fetch(`${c.url}/rest/v1/usage_metrics`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify([row]),
    });
  } catch (e) {
    console.warn("telemetry: usage log error", String(e));
  }
}

/** Resolves the caller's user id from the Authorization header, if any. */
export async function userIdFromAuth(req: Request): Promise<string | null> {
  const c = creds();
  const auth = req.headers.get("Authorization");
  if (!c || !auth) return null;
  try {
    const res = await fetch(`${c.url}/auth/v1/user`, {
      headers: { apikey: c.key, Authorization: auth },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
