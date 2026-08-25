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

/** full voice state machine */
export type VoiceState =
  | "idle"
  | "listening"
  | "user_speaking"
  | "thinking"
  | "speaking"
  | "error";

type Recog = any;

/** silence (ms) after the user stops talking before we send the turn */
const SILENCE_MS = 1250;
/** mic level that counts as "the user is talking" */
const SPEECH_LEVEL = 0.12;
/** sustained mic level that interrupts VRAI while it is speaking */
const INTERRUPT_LEVEL = 0.22;
const INTERRUPT_MS = 320;

function getRecognition(): Recog | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "en-US";
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

/**
 * Real continuous two-way voice conversation for VRAI-AI.
 * greet -> listen -> detect speech start/stop (VAD) -> think -> speak -> listen ...
 * VRAI speech is interruptible; every turn is persisted as normal chat text.
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
  const speakingRef = useRef(false);
  const turnsRef = useRef<VoiceTurn[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const micAmp = useRef(0);
  const pendingRef = useRef("");
  const silenceTimer = useRef<number | null>(null);
  const interruptSince = useRef<number>(0);
  const personalityRef = useRef<PersonalityId>(personality);
  const autoRef = useRef(auto);
  const mutedRef = useRef(!!muted);
  const handleRef = useRef<(text: string) => void>(() => {});

  const sttSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => { personalityRef.current = personality; setActivePersonality(personality); }, [personality]);
  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { mutedRef.current = !!muted; }, [muted]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);

  const setPhase = useCallback((s: VoiceState) => {
    setState(s);
  }, []);

  /* ---------- microphone meter (VAD + visualization) ---------- */
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  const startMeter = useCallback(async () => {
    if (audioRef.current) return true;
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
        micAmp.current += (level - micAmp.current) * 0.25;

        // interruption detection while VRAI is talking
        if (speakingRef.current && micAmp.current > INTERRUPT_LEVEL) {
          if (!interruptSince.current) interruptSince.current = performance.now();
          else if (performance.now() - interruptSince.current > INTERRUPT_MS) {
            interruptSince.current = 0;
            stopSpeech();
          }
        } else if (!speakingRef.current) {
          interruptSince.current = 0;
        }

        holder.raf = requestAnimationFrame(loop);
      };
      holder.raf = requestAnimationFrame(loop);
      audioRef.current = holder;
      return true;
    } catch {
      setError("Microphone access is blocked. Enable it in your browser to talk with VRAI-AI.");
      setPhase("error");
      return false;
    }
  }, [stopSpeech, setPhase]);

  const stopMeter = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.stream.getTracks().forEach((t) => t.stop());
    a.ctx.close().catch(() => {});
    audioRef.current = null;
    micAmp.current = 0;
  }, []);

  /* ---------- merged amplitude feed for the visualization ---------- */
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

  /* ---------- recognition control ---------- */
  const startRecognition = useCallback(() => {
    const r = recogRef.current;
    if (!r || !activeRef.current) return;
    try {
      r.start();
    } catch {
      /* already running */
    }
  }, []);

  const listen = useCallback(() => {
    if (!activeRef.current) return;
    busyRef.current = false;
    pendingRef.current = "";
    setPartial("");
    setPhase("listening");
    startRecognition();
  }, [setPhase, startRecognition]);

  const clearSilence = () => {
    if (silenceTimer.current) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  const armSilence = useCallback(() => {
    clearSilence();
    silenceTimer.current = window.setTimeout(() => {
      silenceTimer.current = null;
      const text = pendingRef.current.trim();
      pendingRef.current = "";
      if (text) handleRef.current(text);
      else if (activeRef.current && !busyRef.current) setPhase("listening");
    }, SILENCE_MS);
  }, [setPhase]);

  /* ---------- one conversation turn ---------- */
  const handleUtterance = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busyRef.current) return;
      busyRef.current = true;
      clearSilence();
      stopSpeech();
      setPartial("");
      setPhase("thinking");
      setCaption(clean);

      const chosen = autoRef.current ? autoSelectPersonality(clean) : personalityRef.current;
      setActivePersonality(chosen);

      const nextTurns: VoiceTurn[] = [...turnsRef.current, { role: "user", content: clean }];
      turnsRef.current = nextTurns;
      setTurns(nextTurns);

      if (user && !sessionIdRef.current) {
        sessionIdRef.current = await ensureVoiceSession(user.id);
      }
      appendVoiceTurn(sessionIdRef.current, user?.id, { role: "user", content: clean });

      let reply = "";
      let failed = false;
      await streamChat({
        messages: nextTurns.map((t) => ({ role: t.role, content: t.content })),
        personality: chosen,
        voice: true,
        onDelta: (chunk) => {
          reply += chunk;
          setCaption(reply);
        },
        onDone: () => {},
        onError: (err) => {
          failed = true;
          setError(err);
        },
      });

      const finalReply = reply.trim();
      if (!finalReply) {
        if (failed) setPhase("error");
        busyRef.current = false;
        if (activeRef.current) listen();
        else setPhase("idle");
        return;
      }

      setError(null);
      const withReply: VoiceTurn[] = [...turnsRef.current, { role: "assistant", content: finalReply }];
      turnsRef.current = withReply;
      setTurns(withReply);
      appendVoiceTurn(sessionIdRef.current, user?.id, { role: "assistant", content: finalReply });
      setCaption(finalReply);

      const done = () => {
        busyRef.current = false;
        if (activeRef.current) listen();
        else setPhase("idle");
      };

      setPhase("speaking");
      if (mutedRef.current || !ttsSupported) {
        window.setTimeout(done, Math.min(6000, 900 + finalReply.length * 30));
        return;
      }
      speak(finalReply, getPersonality(chosen).voice, done);
    },
    [user, ttsSupported, speak, stopSpeech, listen, setPhase],
  );

  useEffect(() => { handleRef.current = handleUtterance; }, [handleUtterance]);

  /* ---------- recognition wiring (created once) ---------- */
  useEffect(() => {
    if (!sttSupported) return;
    const r = getRecognition();
    if (!r) return;
    recogRef.current = r;

    r.onresult = (ev: any) => {
      if (busyRef.current) return;
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) final += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      if (interim.trim() || final.trim()) setPhase("user_speaking");
      if (final) pendingRef.current += final;
      setPartial((pendingRef.current + " " + interim).trim());
      armSilence();
    };

    r.onspeechstart = () => {
      if (!busyRef.current) setPhase("user_speaking");
    };

    r.onerror = (ev: any) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setError("Microphone access is blocked. Enable it in your browser to talk with VRAI-AI.");
        activeRef.current = false;
        setActive(false);
        setPhase("error");
      }
      // "no-speech" / "aborted" / "network" -> onend restarts the loop
    };

    r.onend = () => {
      if (activeRef.current && !busyRef.current) {
        window.setTimeout(() => startRecognition(), 250);
      }
    };

    return () => {
      try {
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.onspeechstart = null;
        r.abort();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    };
  }, [sttSupported, armSilence, setPhase, startRecognition]);

  /* ---------- greeting generated by the real AI, then straight to listening ---------- */
  const greetAndListen = useCallback(async () => {
    busyRef.current = true;
    setPhase("thinking");
    const chosen = autoRef.current ? "core" : personalityRef.current;
    setActivePersonality(chosen as PersonalityId);

    let reply = "";
    await streamChat({
      messages: [
        {
          role: "user",
          content:
            "(The user just opened voice mode and hasn't said anything yet. Greet them out loud in ONE short friendly spoken sentence and invite them to talk. No options, no markdown.)",
        },
      ],
      personality: chosen,
      voice: true,
      onDelta: (chunk) => {
        reply += chunk;
        setCaption(reply);
      },
      onDone: () => {},
      onError: () => {},
    });

    const greeting = reply.trim() || "Hey, hi there! How can I help you today?";
    setCaption(greeting);
    turnsRef.current = [...turnsRef.current, { role: "assistant", content: greeting }];
    setTurns(turnsRef.current);
    if (user && !sessionIdRef.current) sessionIdRef.current = await ensureVoiceSession(user.id);
    appendVoiceTurn(sessionIdRef.current, user?.id, { role: "assistant", content: greeting });

    const done = () => {
      busyRef.current = false;
      if (activeRef.current) listen();
      else setPhase("idle");
    };

    setPhase("speaking");
    if (mutedRef.current || !ttsSupported) {
      window.setTimeout(done, Math.min(5000, 900 + greeting.length * 30));
      return;
    }
    speak(greeting, getPersonality(chosen as PersonalityId).voice, done);
  }, [user, ttsSupported, speak, listen, setPhase]);

  /* ---------- public controls ---------- */
  const start = useCallback(async () => {
    if (activeRef.current) return;
    setError(null);
    activeRef.current = true;
    setActive(true);
    const ok = await startMeter();
    if (!ok) {
      activeRef.current = false;
      setActive(false);
      return;
    }
    await greetAndListen();
  }, [startMeter, greetAndListen]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    busyRef.current = false;
    clearSilence();
    pendingRef.current = "";
    stopSpeech();
    stopMeter();
    try {
      recogRef.current?.abort();
    } catch {
      /* ignore */
    }
    setPartial("");
    setPhase("idle");
  }, [stopSpeech, stopMeter, setPhase]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    if (speaking) setPhase("speaking");
  }, [speaking, setPhase]);

  useEffect(() => () => { stopMeter(); clearSilence(); }, [stopMeter]);

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
    say: undefined as undefined,
    stopSpeech,
  };
}
