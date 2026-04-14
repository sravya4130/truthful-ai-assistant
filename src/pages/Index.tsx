import { useState, useCallback, useRef } from "react";
import { Menu } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessageBubble } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { EmptyChat } from "@/components/EmptyChat";
import { ChatSession, ChatMessage, ChatMode } from "@/types/chat";
import { streamChat } from "@/lib/streamChat";
import { toast } from "sonner";

const generateId = () => Math.random().toString(36).slice(2, 10);

export default function Index() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<ChatMode>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const createSession = useCallback((firstMessage: string, mode: ChatMode): string => {
    const id = generateId();
    const prefix = mode === "transform" ? "🔄 " : mode === "roadmap" ? "🗺️ " : "";
    const session: ChatSession = {
      id,
      title: prefix + (firstMessage.slice(0, 40) || "New Chat"),
      messages: [],
      createdAt: new Date(),
      mode,
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(id);
    return id;
  }, []);

  const handleSetMode = useCallback((mode: ChatMode) => {
    setCurrentMode(mode);
    setActiveSessionId(null);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentMode("chat");
    setActiveSessionId(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const mode = activeSession?.mode || currentMode;
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession(content, mode);
      }

      const userMsg: ChatMessage = { id: generateId(), role: "user", content, timestamp: new Date() };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            title: s.messages.length === 0 ? (mode === "transform" ? "🔄 " : mode === "roadmap" ? "🗺️ " : "") + content.slice(0, 40) : s.title,
            messages: [...s.messages, userMsg],
          };
        })
      );
      scrollToBottom();
      setIsLoading(true);

      // Build message history for AI
      const currentSession = sessions.find((s) => s.id === sessionId);
      const history = [
        ...(currentSession?.messages || []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content },
      ];

      const assistantId = generateId();
      let assistantContent = "";

      // Create empty assistant message
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: [...s.messages, { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() }],
          };
        })
      );

      await streamChat({
        messages: history,
        mode,
        onDelta: (chunk) => {
          assistantContent += chunk;
          const captured = assistantContent;
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) => (m.id === assistantId ? { ...m, content: captured } : m)),
              };
            })
          );
          scrollToBottom();
        },
        onDone: () => {
          setIsLoading(false);
          scrollToBottom();
        },
        onError: (err) => {
          toast.error(err);
          // Remove empty assistant message on error
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return { ...s, messages: s.messages.filter((m) => m.id !== assistantId) };
            })
          );
        },
      });
    },
    [activeSessionId, activeSession, currentMode, sessions, createSession, scrollToBottom]
  );

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    const session = sessions.find((s) => s.id === id);
    if (session) setCurrentMode(session.mode);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [sessions]);

  const displayMode = activeSession?.mode || currentMode;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--gradient-surface)" }}>
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onSetMode={handleSetMode}
        currentMode={displayMode}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center px-4 border-b border-border shrink-0">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors mr-3">
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <span className="text-sm text-muted-foreground font-medium truncate">
            {activeSession?.title || (displayMode === "transform" ? "Transform Me" : displayMode === "roadmap" ? "Roadmap Generator" : "New conversation")}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!activeSession || activeSession.messages.length === 0 ? (
            <EmptyChat onSuggestionClick={sendMessage} mode={displayMode} />
          ) : (
            <div className="py-4">
              {activeSession.messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && activeSession.messages[activeSession.messages.length - 1]?.content === "" && (
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

        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          placeholder={
            displayMode === "transform"
              ? "Tell me who you want to become..."
              : displayMode === "roadmap"
              ? "What's your goal? I'll build your roadmap..."
              : "Ask me anything — I'll be brutally honest..."
          }
        />
      </div>
    </div>
  );
}
