import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech layer for the VRAI-AI experience.
 * Picks the most natural available female English voice, speaks with calm
 * pacing, and exposes a live 0..1 amplitude that drives the visualization.
 */

const FEMALE_HINTS = [
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

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  for (const hint of FEMALE_HINTS) {
    const found = pool.find((v) => v.name.toLowerCase().includes(hint));
    if (found) return found;
  }
  return pool[0] ?? null;
}

export function useVraiVoice() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const amplitude = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
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

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      try {
        window.speechSynthesis.cancel();
        // natural pauses: split into clauses spoken back to back
        const parts = text
          .split(/(?<=[.!?,])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        parts.forEach((part, i) => {
          const u = new SpeechSynthesisUtterance(part);
          if (voiceRef.current) u.voice = voiceRef.current;
          u.lang = voiceRef.current?.lang || "en-US";
          u.rate = 0.94;
          u.pitch = 1.02;
          u.volume = 1;
          if (i === 0) u.onstart = () => setSpeaking(true);
          if (i === parts.length - 1) {
            u.onend = () => setSpeaking(false);
            u.onerror = () => setSpeaking(false);
          }
          window.speechSynthesis.speak(u);
        });
      } catch {
        setSpeaking(false);
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
