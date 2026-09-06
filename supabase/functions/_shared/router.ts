/**
 * VRAI ROUTER
 * -----------
 * Lightweight intent classifier. Stage 1 is a zero-cost rule pass; only when
 * the rules are not confident do we spend one tiny call on the LIGHT model.
 * This is the core of the efficiency architecture: the big models are never
 * used just to decide what to do.
 */

export type Category =
  | "smalltalk"
  | "general"
  | "coding"
  | "math"
  | "reasoning"
  | "science"
  | "education"
  | "writing"
  | "summarization"
  | "planning"
  | "image"
  | "other";

export interface Classification {
  category: Category;
  confidence: number;
  reason: string;
  method: "rules" | "light-model" | "override";
}

const RULES: { category: Category; weight: number; patterns: RegExp[] }[] = [
  {
    category: "coding",
    weight: 0.95,
    patterns: [
      /\b(code|coding|debug|bug|stack ?trace|refactor|compile|typescript|javascript|python|react|three\.?js|shader|glsl|sql|api|function|component|npm|error:|exception|regex)\b/i,
      /```/,
    ],
  },
  {
    category: "math",
    weight: 0.9,
    patterns: [
      /\b(solve|equation|derivative|integral|matrix|probability|algebra|calculus|geometry|percentage|calculate)\b/i,
      /\d+\s*[\+\-\*\/\^]\s*\d+/,
    ],
  },
  {
    category: "summarization",
    weight: 0.9,
    patterns: [/\b(summar(y|ise|ize)|tldr|key takeaways|shorten|condense)\b/i],
  },
  {
    category: "planning",
    weight: 0.88,
    patterns: [/\b(roadmap|plan|schedule|step by step plan|timeline|routine|habit|glow ?up|transform me)\b/i],
  },
  {
    category: "science",
    weight: 0.85,
    patterns: [/\b(physics|chemistry|biology|molecule|photosynthesis|quantum|astronomy|dna|reaction)\b/i],
  },
  {
    category: "education",
    weight: 0.82,
    patterns: [/\b(explain|teach|what is|how does|define|meaning of|difference between|study|exam|syllabus)\b/i],
  },
  {
    category: "writing",
    weight: 0.85,
    patterns: [/\b(write|draft|essay|caption|email|poem|story|rewrite|tone|copy for|script)\b/i],
  },
  {
    category: "image",
    weight: 0.9,
    patterns: [/\b(generate an image|draw|illustration|picture of|image of|logo|poster)\b/i],
  },
  {
    category: "reasoning",
    weight: 0.8,
    patterns: [/\b(why|compare|analy(se|ze)|pros and cons|trade ?offs?|strategy|decide|evaluate|prove)\b/i],
  },
  {
    category: "smalltalk",
    weight: 0.9,
    patterns: [
      /^(hi|hey|hello|yo|sup|hey there|good (morning|evening|night)|thanks|thank you|ok|okay|cool|nice|lol|bye)[\s!.?]*$/i,
      /\b(how are you|what's up|who are you)\b/i,
    ],
  },
];

const PERSONALITY_CATEGORY: Record<string, Category> = {
  code: "coding",
  study: "education",
  creative: "writing",
  research: "reasoning",
};

const MODE_CATEGORY: Record<string, Category> = {
  roadmap: "planning",
  transform: "planning",
};

export function classifyByRules(text: string): Classification | null {
  const t = (text || "").trim();
  if (!t) return { category: "smalltalk", confidence: 0.5, reason: "empty input", method: "rules" };

  const scores = new Map<Category, number>();
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (p.test(t)) {
        scores.set(rule.category, Math.max(scores.get(rule.category) ?? 0, rule.weight));
        break;
      }
    }
  }
  if (scores.size === 0) {
    // Very short, no signals -> smalltalk. Long, no signals -> needs the light model.
    if (t.length < 25) {
      return { category: "smalltalk", confidence: 0.6, reason: "short message, no task signals", method: "rules" };
    }
    return null;
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [category, confidence] = sorted[0];
  // Long messages are rarely smalltalk.
  if (category === "smalltalk" && t.length > 60) return null;
  return {
    category,
    confidence,
    reason: `rule match: ${sorted.map(([c, w]) => `${c}(${w})`).join(", ")}`,
    method: "rules",
  };
}

const CATEGORIES: Category[] = [
  "smalltalk", "general", "coding", "math", "reasoning",
  "science", "education", "writing", "summarization", "planning", "image",
];

/** Cheap single-call classification on the LIGHT model. Returns null on any failure. */
export async function classifyByLightModel(
  text: string,
  lightModelId: string,
  apiKey: string,
): Promise<Classification | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "direct-fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: lightModelId,
        max_tokens: 12,
        messages: [
          {
            role: "system",
            content:
              `Classify the user's request into exactly one category from this list: ${CATEGORIES.join(", ")}. ` +
              `Reply with the single category word only. No punctuation, no explanation.`,
          },
          { role: "user", content: text.slice(0, 1200) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? "").toLowerCase().trim();
    const match = CATEGORIES.find((c) => raw.includes(c));
    if (!match) return null;
    return { category: match, confidence: 0.75, reason: "light-model classification", method: "light-model" };
  } catch (e) {
    console.warn("router: light model classification failed", String(e));
    return null;
  }
}

/**
 * Full routing decision. Order: explicit personality/mode override →
 * rules → light model → general fallback.
 */
export async function classify(opts: {
  text: string;
  mode?: string;
  personality?: string;
  lightModelId: string;
  apiKey: string;
}): Promise<Classification> {
  const { text, mode, personality, lightModelId, apiKey } = opts;

  if (personality && PERSONALITY_CATEGORY[personality]) {
    return {
      category: PERSONALITY_CATEGORY[personality],
      confidence: 1,
      reason: `user selected VRAI ${personality.toUpperCase()}`,
      method: "override",
    };
  }
  if (mode && MODE_CATEGORY[mode]) {
    return {
      category: MODE_CATEGORY[mode],
      confidence: 1,
      reason: `mode: ${mode}`,
      method: "override",
    };
  }

  const rules = classifyByRules(text);
  if (rules && rules.confidence >= 0.8) return rules;

  const light = await classifyByLightModel(text, lightModelId, apiKey);
  if (light) return light;
  if (rules) return rules;

  return { category: "general", confidence: 0.4, reason: "no signal, default route", method: "rules" };
}
