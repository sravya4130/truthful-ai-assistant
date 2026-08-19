import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceProfile } from "@/lib/personalities";

/**
 * Speech layer for the VRAI-AI experience.
 * Picks the most natural available female English voice for the active
 * personality, speaks with calm pacing, and exposes a live 0..1 amplitude
 * that drives the visualization.
 */

const FALLBACK_HINTS = [
  "google uk english female",
  "google us english",
  "samantha",
  "zira",
  "aria",
  "jenny",
  "libby",
  "sonia",
  "karen",
  "moira",
  "tessa",
  "victoria",
  "female",
];

function pickVoice(voices: SpeechSynthesisVoice[], hints: string[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  for (const hint of [...hints, ...FALLBACK_HINTS]) {
    const found = pool.find((v) => v.name.toLowerCase().includes(hint));
    if (found) return found;
  }
  return pool[0] ?? null;
}

export function useVraiVoice() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const amplitude = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  // organic amplitude envelope while speaking (no per-word jitter)
  useEffect(() => {
    if (!speaking) {
      const decay = () => {
        amplitude.current *= 0.9;
        if (amplitude.current > 0.001) rafRef.current = requestAnimationFrame(decay);
        else amplitude.current = 0;
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(decay);
      return () => cancelAnimationFrame(rafRef.current);
    }
    let t = 0;
    const loop = () => {
      t += 0.016;
      const env =
        0.42 +
        Math.sin(t * 7.3) * 0.2 +
        Math.sin(t * 3.1 + 1.4) * 0.14 +
        Math.sin(t * 13.7) * 0.08;
      amplitude.current += (Math.max(0.05, env) - amplitude.current) * 0.14;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speaking]);

  /**
   * Speak text with an optional personality voice profile.
   * `onEnd` fires once the whole utterance queue finishes (or errors).
   */
  const speak = useCallback(
    (text: string, profile?: VoiceProfile, onEnd?: () => void) => {
      if (!supported || !text.trim()) {
        onEnd?.();
        return;
      }
      const hints = profile?.hints ?? [];
      const voice = pickVoice(voicesRef.current, hints);
      try {
        window.speechSynthesis.cancel();
        // natural pauses: split into clauses spoken back to back
        const parts = text
          .replace(/```[\s\S]*?```/g, " code block, see the transcript. ")
          .replace(/[*_#>`]/g, "")
          .split(/(?<=[.!?,])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (!parts.length) {
          onEnd?.();
          return;
        }
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          setSpeaking(false);
          onEnd?.();
        };
        parts.forEach((part, i) => {
          const u = new SpeechSynthesisUtterance(part);
          if (voice) u.voice = voice;
          u.lang = voice?.lang || "en-US";
          u.rate = profile?.rate ?? 0.94;
          u.pitch = profile?.pitch ?? 1.02;
          u.volume = 1;
          if (i === 0) u.onstart = () => setSpeaking(true);
          if (i === parts.length - 1) {
            u.onend = finish;
            u.onerror = finish;
          }
          window.speechSynthesis.speak(u);
        });
      } catch {
        setSpeaking(false);
        onEnd?.();
      }
    },
    [supported],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { speak, stop, speaking, amplitude, supported };
}
