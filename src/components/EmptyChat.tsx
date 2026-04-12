import { motion } from "framer-motion";
import { Zap, Target, TrendingUp, Brain } from "lucide-react";

const suggestions = [
  { icon: Target, text: "Create a roadmap to become a full-stack developer" },
  { icon: TrendingUp, text: "How do I start making money online at 18?" },
  { icon: Brain, text: "Transform me into a disciplined person" },
  { icon: Zap, text: "Give me a brutal honest review of my career plan" },
];

interface EmptyChatProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h2 className="font-heading text-4xl md:text-5xl font-bold mb-3 text-gradient">
          No Sugarcoating.
        </h2>
        <p className="text-muted-foreground text-lg">
          Ask anything. Get the brutal truth.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.map((s, i) => (
          <motion.button
            key={i}
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
