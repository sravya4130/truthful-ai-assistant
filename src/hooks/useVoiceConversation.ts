import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/streamChat";
import { useVraiVoice } from "@/hooks/useVraiVoice";
import {
  autoSelectPersonality,
  getPersonality,
  type PersonalityId,
} from "@/lib/personalities";
import {
  appendVoiceTurn,
  ensureVoiceSession,
  type VoiceTurn,
} from "@/lib/voiceHistory";
import { useAuth } from "@/hooks/useAuth";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

type Recog = any;

function getRecognition(): Recog | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "en-US";
  r.continuous = false;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

/**
 * Real two-way voice conversation loop for VRAI-AI.
 * listen -> transcribe -> think (AI) -> speak -> listen again.
 * Transcripts are persisted so the main chat shares the same history.
 */
export function useVoiceConversation(options: {
  personality: PersonalityId;
  auto: boolean;
  muted?: boolean;
}) {
  const { personality, auto, muted } = options;
  const { user } = useAuth();
  const { speak, stop: stopSpeech, speaking, amplitude, supported: ttsSupported } = useVraiVoice();

  const [state, setState] = useState<VoiceState>("idle");
  const [active, setActive] = useState(false);
  const [partial, setPartial] = useState("");
  const [caption, setCaption] = useState("");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [activePersonality, setActivePersonality] = useState<PersonalityId>(personality);
  const [error, setError] = useState<string | null>(null);

  const recogRef = useRef<Recog | null>(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const turnsRef = useRef<VoiceTurn[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const micAmp = useRef(0);
  const sttSupported = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  /* ---------- microphone amplitude (drives the visualization) ---------- */
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  const startMeter = useCallback(async () => {
    if (audioRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const holder = { ctx, stream, raf: 0 };
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const level = Math.min(1, sum / data.length / 90);
        micAmp.current += (level - micAmp.current) * 0.2;
        holder.raf = requestAnimationFrame(loop);
      };
      holder.raf = requestAnimationFrame(loop);
      audioRef.current = holder;
    } catch {
      setError("Microphone access is blocked. Enable it to talk with VRAI-AI.");
    }
  }, []);

  const stopMeter = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.stream.getTracks().forEach((t) => t.stop());
    a.ctx.close().catch(() => {});
    audioRef.current = null;
    micAmp.current = 0;
  }, []);

  /* ---------- merged amplitude feed ---------- */
  const feed = useRef(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      feed.current = Math.max(amplitude.current, micAmp.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [amplitude]);

  /* ---------- listening ---------- */
  const listen = useCallback(() => {
    if (!activeRef.current || busyRef.current) return;
    const r = recogRef.current;
    if (!r) return;
    try {
      setPartial("");
      setState("listening");
      r.start();
    } catch {
      /* already started */
    }
  }, []);

  const handleUtterance = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) {
        listen();
        return;
      }
      busyRef.current = true;
      setPartial("");
      setState("thinking");
      setCaption(clean);

      const chosen = auto ? autoSelectPersonality(clean) : personality;
      setActivePersonality(chosen);

      const nextTurns: VoiceTurn[] = [...turnsRef.current, { role: "user", content: clean }];
      turnsRef.current = nextTurns;
      setTurns(nextTurns);

      if (user && !sessionIdRef.current) {
        sessionIdRef.current = await ensureVoiceSession(user.id);
      }
      appendVoiceTurn(sessionIdRef.current, user?.id, { role: "user", content: clean });

      let reply = "";
      await streamChat({
        messages: nextTurns.map((t) => ({ role: t.role, content: t.content })),
        personality: chosen,
        voice: true,
        onDelta: (chunk) => {
          reply += chunk;
          setCaption(reply);
        },
        onDone: () => {},
        onError: (err) => setError(err),
      });

      const finalReply = reply.trim();
      if (!finalReply) {
        busyRef.current = false;
        setState(activeRef.current ? "listening" : "idle");
        listen();
        return;
      }

      const withReply: VoiceTurn[] = [...turnsRef.current, { role: "assistant", content: finalReply }];
      turnsRef.current = withReply;
      setTurns(withReply);
      appendVoiceTurn(sessionIdRef.current, user?.id, { role: "assistant", content: finalReply });
      setCaption(finalReply);

      const done = () => {
        busyRef.current = false;
        if (activeRef.current) listen();
        else setState("idle");
      };

      if (muted || !ttsSupported) {
        setState("speaking");
        window.setTimeout(done, Math.min(6000, 1200 + finalReply.length * 35));
        return;
      }
      setState("speaking");
      speak(finalReply, getPersonality(chosen).voice, done);
    },
    [auto, personality, user, muted, ttsSupported, speak, listen],
  );

  /* ---------- recognition wiring ---------- */
  useEffect(() => {
    if (!sttSupported) return;
    const r = getRecognition();
    if (!r) return;
    recogRef.current = r;

    r.onresult = (ev: any) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (interim) setPartial(interim);
      if (final) handleUtterance(final);
    };
    r.onerror = (ev: any) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setError("Microphone access is blocked. Enable it to talk with VRAI-AI.");
        activeRef.current = false;
        setActive(false);
        setState("idle");
      }
    };
    r.onend = () => {
      if (activeRef.current && !busyRef.current) {
        window.setTimeout(() => listen(), 250);
      }
    };
    return () => {
      try {
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.abort();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    };
  }, [sttSupported, handleUtterance, listen]);

  const start = useCallback(async () => {
    setError(null);
    activeRef.current = true;
    setActive(true);
    await startMeter();
    listen();
  }, [listen, startMeter]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    busyRef.current = false;
    stopSpeech();
    stopMeter();
    try {
      recogRef.current?.abort();
    } catch {
      /* ignore */
    }
    setPartial("");
    setState("idle");
  }, [stopSpeech, stopMeter]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  /** speak a line without listening (used for the greeting) */
  const say = useCallback(
    (text: string, id: PersonalityId = personality) => {
      setCaption(text);
      if (muted || !ttsSupported) {
        setState("speaking");
        window.setTimeout(() => setState(activeRef.current ? "listening" : "idle"), 2600);
        return;
      }
      setState("speaking");
      speak(text, getPersonality(id).voice, () => {
        if (activeRef.current) listen();
        else setState("idle");
      });
    },
    [personality, muted, ttsSupported, speak, listen],
  );

  useEffect(() => {
    if (speaking) setState("speaking");
  }, [speaking]);

  useEffect(() => () => { stopMeter(); }, [stopMeter]);

  return {
    state,
    active,
    partial,
    caption,
    turns,
    activePersonality,
    error,
    amplitude: feed,
    sttSupported,
    ttsSupported,
    start,
    stop,
    toggle,
    say,
    stopSpeech,
  };
}
