import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isLoading,
  placeholder = "Hey 👋 what do you want help with?"
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ✅ Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ✅ Auto focus on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();

    if (!trimmed || isLoading) return;

    onSend(trimmed);
    setInput("");

    // reset height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ✅ Enter = send, Shift+Enter = new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 pb-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative flex items-end gap-2 bg-secondary rounded-2xl border border-border p-3 focus-within:border-primary/50 focus-within:glow transition-all"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading} // ✅ prevents typing while loading
          className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-40 font-body disabled:opacity-60"
        />

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="shrink-0 p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </motion.div>

      <p className="text-center text-sm text-muted-foreground mt-2">
        Friendly, honest, and here to help ✨
      </p>
    </div>
  );
}
