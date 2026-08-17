import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import VraiNexus, { type NexusState } from "@/components/vrai/VraiNexus";
import { useVraiVoice } from "@/hooks/useVraiVoice";

const GREETING = "Hey, hi there. How can I help you?";

const STATUS_LABEL: Record<NexusState, string> = {
  idle: "STANDBY",
  thinking: "THINKING",
  listening: "LISTENING",
  speaking: "SPEAKING",
};

/* small HUD readout, purely decorative telemetry */
function HudPanel({
  title,
  rows,
  className,
  delay = 0,
}: {
  title: string;
  rows: [string, string][];
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay }}
      className={`pointer-events-none absolute hidden md:block w-[190px] rounded-lg border border-primary/25 bg-background/40 px-3 py-2 backdrop-blur-md ${className ?? ""}`}
    >
      <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-primary/80">{title}</div>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
            <span className="uppercase tracking-wider">{k}</span>
            <span className="text-foreground/90">{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function VraiExperience() {
  const [state, setState] = useState<NexusState>("idle");
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const micAmp = useRef(0);
  const { speak, stop, speaking, amplitude, supported } = useVraiVoice();
  const greetedRef = useRef(false);

  // greet once the scene is alive
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (greetedRef.current) return;
      greetedRef.current = true;
      setState("thinking");
      window.setTimeout(() => {
        setCaption(GREETING);
        if (!muted && supported) speak(GREETING);
        setState("speaking");
        window.setTimeout(() => setState((s) => (s === "speaking" ? "idle" : s)), 3400);
      }, 1500);
    }, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (speaking) setState("speaking");
    else setState((s) => (s === "speaking" ? "idle" : s));
  }, [speaking]);

  // microphone reactivity for the listening state
  useEffect(() => {
    if (!micOn) {
      micAmp.current = 0;
      return;
    }
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return;
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        setState("listening");
        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const level = Math.min(1, sum / data.length / 90);
          micAmp.current += (level - micAmp.current) * 0.2;
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setMicOn(false);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
      setState((s) => (s === "listening" ? "idle" : s));
    };
  }, [micOn]);

  // merged amplitude feed for the visualization
  const feed = useRef(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      feed.current = Math.max(amplitude.current, micAmp.current);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [amplitude]);

  const replay = () => {
    setCaption(GREETING);
    if (muted || !supported) {
      setState("speaking");
      window.setTimeout(() => setState("idle"), 2600);
      return;
    }
    speak(GREETING);
  };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <h1 className="sr-only">VRAI-AI — living AI presence</h1>

      {/* living energy nexus */}
      <VraiNexus state={state} amplitudeRef={feed} className="absolute inset-0" />

      {/* readability veil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/55 via-transparent to-background/85" />

      {/* HUD frame */}
      <div className="pointer-events-none absolute inset-4 rounded-2xl border border-primary/15" />

      <HudPanel
        title="Core telemetry"
        delay={0.2}
        className="left-8 top-24"
        rows={[
          ["Signal", "STABLE"],
          ["Threads", state === "thinking" ? "1 284" : "312"],
          ["Latency", "18 ms"],
        ]}
      />
      <HudPanel
        title="Neural flux"
        delay={0.35}
        className="left-8 bottom-32"
        rows={[
          ["Streams", "ACTIVE"],
          ["Density", state === "thinking" ? "94%" : "61%"],
          ["Drift", "0.42"],
        ]}
      />
      <HudPanel
        title="Session"
        delay={0.45}
        className="right-8 top-24"
        rows={[
          ["Mode", STATUS_LABEL[state]],
          ["Voice", muted ? "MUTED" : "ONLINE"],
          ["Mic", micOn ? "OPEN" : "CLOSED"],
        ]}
      />

      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-7 py-6">
        <span className="font-heading text-lg font-bold tracking-[0.35em] text-foreground/90">VRAI-AI</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-background/50 px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-primary backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {STATUS_LABEL[state]}
          </span>
        </div>
      </div>

      {/* centre stage content */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 px-6 pb-10 text-center sm:pb-14">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.p
              key={caption}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="font-heading text-2xl leading-snug text-foreground drop-shadow-[0_0_24px_hsl(var(--primary)/0.45)] sm:text-4xl"
            >
              {caption}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/app">
            <Button size="lg" className="glow h-13 px-8 text-base">
              Continue with Chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="h-13 border-primary/30 bg-background/40 px-5 text-base backdrop-blur-md"
            onClick={() => setMicOn((m) => !m)}
          >
            {micOn ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {micOn ? "Stop listening" : "Listen"}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-13 px-4 text-muted-foreground"
            onClick={() => {
              if (speaking) {
                stop();
                setMuted(true);
              } else if (muted) {
                setMuted(false);
                replay();
              } else {
                replay();
              }
            }}
          >
            {muted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            {speaking ? "Mute" : "Replay greeting"}
          </Button>
        </motion.div>

        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
          VRAI-AI presence · realtime energy field
        </p>
      </div>
    </main>
  );
}
