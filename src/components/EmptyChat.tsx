import { motion } from "framer-motion";
import { Zap, Target, TrendingUp, Brain, Sparkles, Map } from "lucide-react";
import { ChatMode } from "@/types/chat";

const suggestions: Record<ChatMode, { icon: typeof Zap; text: string }[]> = {
  chat: [
    { icon: Target, text: "Give me a brutal honest review of my career plan" },
    { icon: TrendingUp, text: "How do I start making money online at 18?" },
    { icon: Brain, text: "What skills should I learn to future-proof my career?" },
    { icon: Zap, text: "I'm stuck in analysis paralysis — help me decide" },
  ],
  transform: [
    { icon: Sparkles, text: "Transform me into a disciplined, focused person" },
    { icon: Target, text: "I want to become an extroverted, confident leader" },
    { icon: Brain, text: "Help me become a top student / class topper" },
    { icon: TrendingUp, text: "I want to transform into a productive morning person" },
  ],
  roadmap: [
    { icon: Map, text: "Create a roadmap to become a full-stack developer" },
    { icon: TrendingUp, text: "Roadmap to start freelancing and earning $5k/month" },
    { icon: Target, text: "Step-by-step plan to crack FAANG interviews" },
    { icon: Brain, text: "Roadmap to learn AI/ML from scratch" },
  ],
};

const titles: Record<ChatMode, { heading: string; sub: string }> = {
  chat: { heading: "No Sugarcoating.", sub: "Ask anything. Get the brutal truth." },
  transform: { heading: "Transform Me.", sub: "Tell me who you want to become. I'll build your blueprint." },
  roadmap: { heading: "Roadmap Generator.", sub: "State your goal. Get a step-by-step battle plan." },
};

interface EmptyChatProps {
  onSuggestionClick: (text: string) => void;
  mode?: ChatMode;
}

export function EmptyChat({ onSuggestionClick, mode = "chat" }: EmptyChatProps) {
  const items = suggestions[mode];
  const title = titles[mode];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
        key={mode}
      >
        <h2 className="font-heading text-4xl md:text-5xl font-bold mb-3 text-gradient">
          {title.heading}
        </h2>
        <p className="text-muted-foreground text-lg">{title.sub}</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {items.map((s, i) => (
          <motion.button
            key={`${mode}-${i}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            onClick={() => onSuggestionClick(s.text)}
            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary transition-colors text-left group"
          >
            <s.icon className="w-5 h-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-foreground/80">{s.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
