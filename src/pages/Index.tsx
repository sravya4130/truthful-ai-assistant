import { useState, useCallback, useRef, useEffect } from "react";
import { Menu } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessageBubble } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { EmptyChat } from "@/components/EmptyChat";
import { ChatSession, ChatMessage } from "@/types/chat";

const generateId = () => Math.random().toString(36).slice(2, 10);

const mockResponse = (userMessage: string): string => {
  const responses = [
    `Here's the deal — **${userMessage.slice(0, 30)}**... is a solid question.\n\nLet me break it down for you:\n\n1. **Stop overthinking** — most people get stuck in analysis paralysis\n2. **Start doing** — action beats planning every single time\n3. **Track your progress** — what gets measured gets managed\n\nThe harsh truth? You already know what you need to do. You're just looking for someone to validate your procrastination. Don't.`,
    `Alright, let me be **brutally honest** with you.\n\nMost people who ask this are looking for a shortcut. There isn't one.\n\n### Here's what actually works:\n- **Consistency > Motivation** — motivation is a myth, discipline is real\n- **Show up every day** — even when it sucks\n- **Learn from failures** — they're not setbacks, they're data\n\n> "The only person standing between you and your goals is the person reading this."\n\nNow go do the work.`,
    `Let me give you the **no-BS answer**.\n\n### The Reality Check\nYou don't need another course. You don't need another book. You need to **execute**.\n\nHere's your action plan:\n1. Pick ONE thing to focus on\n2. Give it 90 days of relentless effort\n3. Measure results\n4. Adjust and repeat\n\nThe world rewards action, not intention. Start today — not Monday, not next month. **Today.**`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

export default function Index() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const createSession = useCallback((firstMessage?: string): string => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: firstMessage?.slice(0, 40) || "New Chat",
      messages: [],
      createdAt: new Date(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(id);
    return id;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession(content);
      }

      const userMsg: ChatMessage = { id: generateId(), role: "user", content, timestamp: new Date() };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            title: s.messages.length === 0 ? content.slice(0, 40) : s.title,
            messages: [...s.messages, userMsg],
          };
        })
      );
      scrollToBottom();

      setIsLoading(true);
      // Simulate AI response
      await new Promise((r) => setTimeout(r, 1200));

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: mockResponse(content),
        timestamp: new Date(),
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return { ...s, messages: [...s.messages, assistantMsg] };
        })
      );
      setIsLoading(false);
      scrollToBottom();
    },
    [activeSessionId, createSession, scrollToBottom]
  );

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
  }, []);

  // Close sidebar on mobile when selecting a chat
  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      if (window.innerWidth < 768) setSidebarOpen(false);
    },
    []
  );

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--gradient-surface)" }}>
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 flex items-center px-4 border-b border-border shrink-0">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors mr-3">
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <span className="text-sm text-muted-foreground font-medium truncate">
            {activeSession?.title || "New conversation"}
          </span>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession || activeSession.messages.length === 0 ? (
            <EmptyChat onSuggestionClick={sendMessage} />
          ) : (
            <div className="py-4">
              {activeSession.messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="max-w-3xl mx-auto px-4 py-4 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="flex gap-1 items-center pt-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
