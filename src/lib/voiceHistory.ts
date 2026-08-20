import { supabase } from "@/integrations/supabase/client";

/**
 * Voice transcripts are saved as normal text messages so the voice
 * conversation and the main chat share one history.
 * Signed-in users -> database. Guests -> localStorage handoff that the
 * chat page imports on load.
 */

export const GUEST_VOICE_KEY = "vrai-voice-transcript";

export interface VoiceTurn {
  role: "user" | "assistant";
  content: string;
}

export async function ensureVoiceSession(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userId, title: "🎙️ Voice session", mode: "chat" })
      .select()
      .single();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export async function appendVoiceTurn(
  sessionId: string | null,
  userId: string | null | undefined,
  turn: VoiceTurn,
) {
  if (!turn.content.trim()) return;
  if (userId && sessionId) {
    try {
      await supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: userId, role: turn.role, content: turn.content });
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    } catch {
      /* transcript is best-effort */
    }
    return;
  }
  // guest handoff
  try {
    const raw = localStorage.getItem(GUEST_VOICE_KEY);
    const list: VoiceTurn[] = raw ? JSON.parse(raw) : [];
    list.push(turn);
    localStorage.setItem(GUEST_VOICE_KEY, JSON.stringify(list.slice(-60)));
  } catch {
    /* ignore */
  }
}

export function readGuestVoiceTranscript(): VoiceTurn[] {
  try {
    const raw = localStorage.getItem(GUEST_VOICE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearGuestVoiceTranscript() {
  try {
    localStorage.removeItem(GUEST_VOICE_KEY);
  } catch {
    /* ignore */
  }
}
