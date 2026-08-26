/**
 * VRAI-AI personality architecture.
 * Each personality has its own purpose, response style, system instructions
 * and voice profile. VRAI CODE is the deepest implementation.
 */

export type PersonalityId = "core" | "study" | "creative" | "research" | "code";

export interface VoiceProfile {
  /** ordered name hints used to pick a synthesis voice */
  hints: string[];
  rate: number;
  pitch: number;
}

export interface Personality {
  id: PersonalityId;
  name: string;
  tagline: string;
  /** short accent colour token pair used by the visualization/UI */
  accent: string;
  voice: VoiceProfile;
  /** extra system instructions appended by the chat backend */
  brief: string;
}

export const PERSONALITIES: Personality[] = [
  {
    id: "core",
    name: "VRAI CORE",
    tagline: "General AI",
    accent: "262 83% 68%",
    voice: { hints: ["google uk english female", "samantha", "aria", "female"], rate: 0.96, pitch: 1.02 },
    brief: "General everyday assistance: planning, decisions, questions. Calm, balanced, intelligent, helpful.",
  },
  {
    id: "study",
    name: "VRAI STUDY",
    tagline: "Learn anything",
    accent: "199 89% 62%",
    voice: { hints: ["libby", "jenny", "samantha", "female"], rate: 0.9, pitch: 1.06 },
    brief: "Learning and education: explain concepts step by step, patient, encouraging, teacher-like, check understanding.",
  },
  {
    id: "creative",
    name: "VRAI CREATIVE",
    tagline: "Create anything",
    accent: "330 81% 66%",
    voice: { hints: ["sonia", "aria", "google us english", "female"], rate: 1.04, pitch: 1.12 },
    brief: "Creative thinking: ideas, writing, brainstorming, content. Energetic, imaginative, expressive, idea-first.",
  },
  {
    id: "research",
    name: "VRAI RESEARCH",
    tagline: "Research & analyze",
    accent: "168 76% 52%",
    voice: { hints: ["moira", "tessa", "victoria", "female"], rate: 0.94, pitch: 0.98 },
    brief: "Research and analysis: precise, calm, analytical, professional. Structure facts, compare options, note uncertainty.",
  },
  {
    id: "code",
    name: "VRAI CODE",
    tagline: "Build & debug",
    accent: "150 84% 55%",
    voice: { hints: ["zira", "karen", "google uk english female", "female"], rate: 0.98, pitch: 0.96 },
    brief: "Software engineering agent: write, explain, debug, refactor, test and architect code. Calm, precise, technical.",
  },
];

export const DEFAULT_PERSONALITY: PersonalityId = "core";

export function getPersonality(id: PersonalityId | string | null | undefined): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
}

/* ------------------------------------------------------------------ */
/* AUTO MODE — pick the best personality for a request                 */
/* ------------------------------------------------------------------ */

const SIGNALS: Record<Exclude<PersonalityId, "core">, RegExp[]> = {
  code: [
    /\b(code|coding|bug|debug|error|stack ?trace|compile|build fail|refactor|function|api|component|typescript|javascript|python|java\b|c\+\+|c#|golang|\bgo\b|rust|php|ruby|swift|kotlin|dart|sql|bash|shell|powershell|react|node|next\.?js|three\.?js|webgl|glsl|shader|npm|yarn|pip|docker|git\b|regex|unit test|deploy)\b/i,
  ],
  study: [
    /\b(explain|what is|how does|teach|learn|study|revision|exam|syllabus|homework|assignment|chapter|theorem|formula|derive|concept|definition|physics|chemistry|biology|maths?|history|economics)\b/i,
  ],
  creative: [
    /\b(idea|ideas|brainstorm|write me|story|poem|caption|slogan|name for|script|content|creative|design concept|hook|tagline|reel|blog post)\b/i,
  ],
  research: [
    /\b(compare|comparison|vs\.?|versus|pros and cons|analy[sz]e|analysis|research|survey|market|statistics|data on|which is better|evaluate|report on)\b/i,
  ],
};

export function autoSelectPersonality(text: string): PersonalityId {
  const t = text || "";
  // code wins ties: it is the most specialized
  const order: Exclude<PersonalityId, "core">[] = ["code", "research", "study", "creative"];
  for (const id of order) {
    if (SIGNALS[id].some((re) => re.test(t))) return id;
  }
  return "core";
}

/* ------------------------------------------------------------------ */
/* PERSISTENCE — the chosen personality survives reloads & route moves */
/* ------------------------------------------------------------------ */

const PERSONALITY_KEY = "vrai-personality";

export function readStoredPersonality(): PersonalityId {
  try {
    const raw = localStorage.getItem(PERSONALITY_KEY);
    if (raw && PERSONALITIES.some((p) => p.id === raw)) return raw as PersonalityId;
  } catch {
    /* ignore */
  }
  return DEFAULT_PERSONALITY;
}

export function storePersonality(id: PersonalityId) {
  try {
    localStorage.setItem(PERSONALITY_KEY, id);
  } catch {
    /* ignore */
  }
}
