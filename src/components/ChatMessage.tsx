import { ChatMessage as ChatMessageType } from "@/types/chat";
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

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
        {isAssistant ? (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:font-heading">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="bg-secondary rounded-xl px-4 py-3 inline-block">
            {message.content}
          </div>
        )}
      </div>
    </motion.div>
  );
}
