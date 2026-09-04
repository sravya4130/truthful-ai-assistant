/**
 * VRAI MODEL REGISTRY
 * -------------------
 * Single source of truth for every model slot VRAI can route to.
 *
 * The registry lives in the `public.models` table so slots can be swapped,
 * disabled, re-pointed at a local / Hugging Face / OpenAI-compatible endpoint,
 * or replaced with a quantized build WITHOUT touching routing code.
 * The static defaults below are only a bootstrap fallback for when the
 * database is unreachable.
 *
 * NOTE: none of these are proprietary VRAI-trained models. They are provider
 * models occupying named slots until real fine-tuned / distilled / quantized
 * models are connected.
 */

export type ModelProvider =
  | "lovable-gateway"
  | "openai-compatible"
  | "gemini-compatible"
  | "huggingface"
  | "local";

export interface ModelRecord {
  key: string;
  name: string;
  model_id: string;
  category: string;
  provider: ModelProvider | string;
  endpoint: string | null;
  parameter_count: string | null;
  precision: string | null;
  memory_requirement: string | null;
  estimated_compute_cost: number;
  priority: number;
  status: string;
  enabled: boolean;
}

const d = (
  key: string,
  name: string,
  model_id: string,
  category: string,
  cost: number,
): ModelRecord => ({
  key,
  name,
  model_id,
  category,
  provider: "lovable-gateway",
  endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
  parameter_count: "undisclosed",
  precision: "provider-default",
  memory_requirement: null,
  estimated_compute_cost: cost,
  priority: 10,
  status: "active",
  enabled: true,
});

export const DEFAULT_REGISTRY: ModelRecord[] = [
  d("LIGHT_MODEL", "VRAI Light", "google/gemini-3.1-flash-lite", "smalltalk", 0.4),
  d("GENERAL_MODEL", "VRAI General", "google/gemini-3.6-flash", "general", 1.0),
  d("CODING_MODEL", "VRAI Code", "google/gemini-3.7-flash", "coding", 2.0),
  d("MATH_MODEL", "VRAI Math", "openai/gpt-5.4-mini", "math", 2.5),
  d("REASONING_MODEL", "VRAI Reasoning", "openai/gpt-5.4", "reasoning", 4.0),
  d("EDUCATION_MODEL", "VRAI Education", "google/gemini-3.6-flash", "education", 1.2),
  d("WRITING_MODEL", "VRAI Writing", "google/gemini-3.6-flash", "writing", 1.2),
  d("SUMMARIZATION_MODEL", "VRAI Summarizer", "google/gemini-3.1-flash-lite", "summarization", 0.6),
  d("SCIENCE_MODEL", "VRAI Science", "google/gemini-3.6-flash", "science", 1.2),
  d("PLANNING_MODEL", "VRAI Planner", "google/gemini-3.6-flash", "planning", 1.3),
  d("IMAGE_MODEL", "VRAI Image", "google/gemini-3.1-flash-image", "image", 3.0),
];

/** category -> ordered model keys. First enabled entry wins; the rest are fallbacks. */
export const CATEGORY_ROUTES: Record<string, string[]> = {
  smalltalk: ["LIGHT_MODEL", "GENERAL_MODEL"],
  general: ["GENERAL_MODEL", "LIGHT_MODEL"],
  coding: ["CODING_MODEL", "GENERAL_MODEL"],
  math: ["MATH_MODEL", "REASONING_MODEL", "GENERAL_MODEL"],
  reasoning: ["REASONING_MODEL", "MATH_MODEL", "GENERAL_MODEL"],
  science: ["SCIENCE_MODEL", "EDUCATION_MODEL", "GENERAL_MODEL"],
  education: ["EDUCATION_MODEL", "GENERAL_MODEL"],
  writing: ["WRITING_MODEL", "GENERAL_MODEL"],
  summarization: ["SUMMARIZATION_MODEL", "GENERAL_MODEL"],
  planning: ["PLANNING_MODEL", "GENERAL_MODEL"],
  image: ["IMAGE_MODEL"],
  other: ["GENERAL_MODEL", "LIGHT_MODEL"],
};

let cache: { at: number; models: ModelRecord[] } | null = null;
const CACHE_MS = 60_000;

/** Loads the registry from the database, cached in-memory, with a static fallback. */
export async function loadRegistry(): Promise<ModelRecord[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.models;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return DEFAULT_REGISTRY;

  try {
    const res = await fetch(`${url}/rest/v1/models?select=*&enabled=eq.true`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`registry fetch ${res.status}`);
    const rows = (await res.json()) as ModelRecord[];
    if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_REGISTRY;
    const models = rows.map((r) => ({
      ...r,
      estimated_compute_cost: Number(r.estimated_compute_cost ?? 1),
    }));
    cache = { at: Date.now(), models };
    return models;
  } catch (e) {
    console.warn("registry: falling back to defaults", String(e));
    return DEFAULT_REGISTRY;
  }
}

export interface Resolution {
  model: ModelRecord;
  chain: ModelRecord[];
}

/**
 * Resolves a category to a primary model plus an ordered fallback chain.
 * Never returns more than the chain for the category — we do not call every model.
 */
export function resolveModels(
  registry: ModelRecord[],
  category: string,
  overrideKey?: string,
): Resolution {
  const byKey = new Map(registry.map((m) => [m.key, m]));
  const keys = overrideKey
    ? [overrideKey, ...(CATEGORY_ROUTES[category] ?? CATEGORY_ROUTES.other)]
    : CATEGORY_ROUTES[category] ?? CATEGORY_ROUTES.other;

  const chain: ModelRecord[] = [];
  for (const k of keys) {
    const m = byKey.get(k);
    if (m && m.enabled && m.status === "active" && !chain.some((c) => c.key === m.key)) {
      chain.push(m);
    }
  }
  if (chain.length === 0) {
    chain.push(byKey.get("GENERAL_MODEL") ?? DEFAULT_REGISTRY[1]);
  }
  return { model: chain[0], chain };
}
