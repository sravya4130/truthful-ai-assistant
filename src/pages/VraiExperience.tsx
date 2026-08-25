import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Mic, MicOff, Volume2, VolumeX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import VraiNexus, { type NexusState } from "@/components/vrai/VraiNexus";
import { useVoiceConversation, type VoiceState } from "@/hooks/useVoiceConversation";
import {
  PERSONALITIES,
  getPersonality,
  readStoredPersonality,
  storePersonality,
  type PersonalityId,
} from "@/lib/personalities";

const STATUS_LABEL: Record<VoiceState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  user_speaking: "HEARING YOU",
  thinking: "THINKING",
  speaking: "SPEAKING",
  error: "ATTENTION",
};

/** map the voice state machine onto the visualization states */
const NEXUS: Record<VoiceState, NexusState> = {
  idle: "idle",
  listening: "listening",
  user_speaking: "listening",
  thinking: "thinking",
  speaking: "speaking",
  error: "idle",
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
  const stored = readStoredPersonality();
  const [muted, setMuted] = useState(false);
  const [auto, setAuto] = useState(stored.auto);
  const [picked, setPicked] = useState<PersonalityId>(stored.id);

  const conv = useVoiceConversation({ personality: picked, auto, muted });
  const state = conv.state;
  const active = getPersonality(auto ? conv.activePersonality : picked);

  // keep the selection in sync with the text chat (same personality everywhere)
  useEffect(() => {
    storePersonality(picked, auto);
  }, [picked, auto]);

  const caption = conv.partial || conv.caption;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <h1 className="sr-only">VRAI-AI — living AI presence</h1>

      {/* living energy nexus */}
      <VraiNexus state={NEXUS[state]} amplitudeRef={conv.amplitude} className="absolute inset-0" />

      {/* readability veil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/55 via-transparent to-background/85" />

      {/* HUD frame */}
      <div
        className={`pointer-events-none absolute inset-4 rounded-2xl border transition-colors duration-500 ${
          state === "error" ? "border-destructive/50" : "border-primary/15"
        }`}
      />

      <HudPanel
        title="Core telemetry"
        delay={0.2}
        className="left-8 top-24"
        rows={[
          ["Signal", state === "error" ? "CHECK MIC" : "STABLE"],
          ["Threads", state === "thinking" ? "1 284" : "312"],
          ["Latency", "18 ms"],
        ]}
      />
      <HudPanel
        title="Neural flux"
        delay={0.35}
        className="left-8 bottom-32"
        rows={[
          ["Streams", conv.active ? "ACTIVE" : "IDLE"],
          ["Density", state === "thinking" ? "94%" : "61%"],
          ["Turns", String(conv.turns.length)],
        ]}
      />
      <HudPanel
        title="Session"
        delay={0.45}
        className="right-8 top-24"
        rows={[
          ["Mode", STATUS_LABEL[state]],
          ["Persona", active.name.replace("VRAI ", "")],
          ["Voice", muted ? "MUTED" : "ONLINE"],
          ["Mic", conv.active ? "OPEN" : "CLOSED"],
        ]}
      />

      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-7 py-6">
        <span className="font-heading text-lg font-bold tracking-[0.35em] text-foreground/90">VRAI-AI</span>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.22em] backdrop-blur-md ${
              state === "error"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-background/50 text-primary"
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            {STATUS_LABEL[state]}
          </span>
        </div>
      </div>

      {/* personality rail */}
      <div className="absolute inset-x-0 top-16 z-10 flex flex-wrap items-center justify-center gap-2 px-6">
        <button
          onClick={() => setAuto((a) => !a)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-md transition ${
            auto
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border/60 bg-background/40 text-muted-foreground"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          Auto
        </button>
        {PERSONALITIES.map((p) => {
          const on = !auto && picked === p.id;
          const live = auto && conv.activePersonality === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setAuto(false);
                setPicked(p.id);
              }}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-md transition ${
                on || live
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.name.replace("VRAI ", "")}
            </button>
          );
        })}
      </div>

      {/* centre stage content */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 px-6 pb-10 text-center sm:pb-14">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.p
              key={caption.slice(0, 40)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl font-heading text-xl leading-snug text-foreground drop-shadow-[0_0_24px_hsl(var(--primary)/0.45)] sm:text-3xl"
            >
              {caption}
            </motion.p>
          )}
        </AnimatePresence>

        {conv.error && (
          <div className="flex flex-col items-center gap-2">
            <p className="max-w-md text-xs text-destructive">{conv.error}</p>
            <button
              onClick={() => conv.start()}
              className="rounded-full border border-primary/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"
            >
              Retry
            </button>
          </div>
        )}
        {!conv.sttSupported && (
          <p className="max-w-md font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Voice input needs Chrome or Edge — chat still works
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            size="lg"
            className="glow h-13 px-8 text-base"
            onClick={() => conv.toggle()}
            disabled={!conv.sttSupported}
          >
            {conv.active ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {conv.active ? "End conversation" : "Talk to VRAI-AI"}
          </Button>
          <Link to="/app">
            <Button
              variant="outline"
              size="lg"
              className="h-13 border-primary/30 bg-background/40 px-5 text-base backdrop-blur-md"
            >
              Continue with Chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="lg"
            className="h-13 px-4 text-muted-foreground"
            onClick={() => {
              if (!muted) {
                conv.stopSpeech();
                setMuted(true);
              } else {
                setMuted(false);
              }
            }}
          >
            {muted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            {muted ? "Unmute" : "Mute"}
          </Button>
        </motion.div>

        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
          {active.name} · {active.tagline} · transcript saved to your chat
        </p>
      </div>
    </main>
  );
}
