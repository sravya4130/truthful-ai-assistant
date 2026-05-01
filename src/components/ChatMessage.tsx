import { ChatMessage as ChatMessageType } from "@/types/chat";
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 max-w-3xl mx-auto px-4 py-3 ${
        isAssistant ? "" : "flex-row-reverse"
      }`}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isAssistant
            ? "bg-primary/20 text-primary"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {isAssistant ? (
          <Bot className="w-4 h-4" />
        ) : (
          <User className="w-4 h-4" />
        )}
      </div>

      {/* Message */}
      <div
        className={`flex-1 text-sm leading-snug ${
          isAssistant ? "text-foreground" : "text-foreground"
        }`}
      >
        {isAssistant ? (
          <div className="max-w-[75%] whitespace-pre-wrap rounded-xl px-4 py-2 bg-muted/40">
            {message.content}
          </div>
        ) : (
          <div className="max-w-[75%] bg-secondary rounded-xl px-4 py-2 inline-block">
            {message.content}
          </div>
        )}
      </div>
    </motion.div>
  );
}
