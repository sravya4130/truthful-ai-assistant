import { ChatMessage as ChatMessageType } from "@/types/chat";
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: ChatMessageType;
  onOptionClick?: (text: string) => void;
  route?: {
    category: string;
    modelName: string;
    confidence: number;
    compute: number;
    fallback: boolean;
  } | null;
}


// Pull out lines like "[[OPT]] some answer" so we can render them as buttons.
function extractOptions(content: string): { clean: string; options: string[] } {
  const options: string[] = [];
  const clean = content
    .split("\n")
    .filter((line) => {
      const m = line.trim().match(/^\[\[OPT\]\]\s*(.+)$/i);
      if (m) {
        options.push(m[1].trim());
        return false;
      }
      return true;
    })
    .join("\n")
    .trimEnd();
  return { clean, options };
}

export function ChatMessageBubble({ message, onOptionClick, route }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const { clean, options } = isAssistant
    ? extractOptions(message.content)
    : { clean: message.content, options: [] };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 max-w-3xl mx-auto px-4 py-4 ${isAssistant ? "" : "flex-row-reverse"}`}
    >
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isAssistant ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
        }`}
      >
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      <div
        className={`flex-1 text-sm leading-relaxed ${
          isAssistant ? "text-foreground" : "text-foreground/90"
        }`}
      >
        {isAssistant && route && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
              {route.category}
            </span>
            <span className="px-2 py-0.5 rounded-full border border-border/60">{route.modelName}</span>
            <span className="px-2 py-0.5 rounded-full border border-border/60">
              cost {route.compute.toFixed(1)}
            </span>
            {route.fallback && (
              <span className="px-2 py-0.5 rounded-full border border-border/60">fallback</span>
            )}
          </div>
        )}
        {isAssistant ? (
          <>
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:font-heading prose-a:text-primary">

              <ReactMarkdown
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                }}
              >
                {clean}
              </ReactMarkdown>
            </div>
            {options.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onOptionClick?.(opt)}
                    disabled={!onOptionClick}
                    className="px-3 py-1.5 text-sm rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground transition-colors disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-secondary rounded-xl px-4 py-3 inline-block whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    </motion.div>
  );
}
