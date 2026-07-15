import { useState, useCallback, useRef, useEffect } from "react";
import { Menu, Loader2 } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessageBubble } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { EmptyChat } from "@/components/EmptyChat";
import { OnboardingModal } from "@/components/OnboardingModal";
import { ChatSession, ChatMessage, ChatMode } from "@/types/chat";
import { streamChat } from "@/lib/streamChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<ChatMode>("chat");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Load sessions from DB
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingSessions(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      const { data: sess, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error("Couldn’t load saved chats. Your data is still safe — the backend may be waking up.");
        setLoadingSessions(false);
        return;
      }
      const sessionList: ChatSession[] = (sess || []).map((s) => ({
        id: s.id,
        title: s.title,
        mode: s.mode as ChatMode,
        createdAt: new Date(s.created_at),
        messages: [],
      }));
      setSessions(sessionList);
      setLoadingSessions(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Load messages for active session if not loaded
  useEffect(() => {
    if (!activeSessionId) return;
    if (!user || activeSessionId.startsWith("guest-")) return;
    const sess = sessions.find((s) => s.id === activeSessionId);
    if (!sess || sess.messages.length > 0) return;
    (async () => {
      const { data: msgs, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeSessionId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Couldn’t load this chat right now. Please try again in a moment.");
        return;
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: (msgs || []).map((m) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  timestamp: new Date(m.created_at),
                })),
              }
            : s
        )
      );
    })();
  }, [activeSessionId, sessions, user]);

  const handleSetMode = useCallback((mode: ChatMode) => {
    setCurrentMode(mode);
    setActiveSessionId(null);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentMode("chat");
    setActiveSessionId(null);
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (user && !id.startsWith("guest-")) {
        const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
        if (error) {
          toast.error("Delete failed");
          return;
        }
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
      toast.success("Chat deleted");
    },
    [activeSessionId, user]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const mode = activeSession?.mode || currentMode;

      // GUEST MODE: in-memory only, no DB persistence
      if (!user) {
        const guestSessionId = activeSessionId || `guest-${Date.now()}`;
        let workingSession = activeSession;
        if (!activeSessionId) {
          workingSession = {
            id: guestSessionId,
            title: content.slice(0, 40),
            mode,
            createdAt: new Date(),
            messages: [],
          };
          setSessions((prev) => [workingSession!, ...prev]);
          setActiveSessionId(guestSessionId);
        }
        const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date() };
        const assistantId = `a-${Date.now()}`;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === guestSessionId
              ? { ...s, messages: [...s.messages, userMsg, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }] }
              : s
          )
        );
        scrollToBottom();
        setIsLoading(true);
        const history = [
          ...((workingSession?.messages || []).map((m) => ({ role: m.role, content: m.content }))),
          { role: "user" as const, content },
        ];
        let assistantContent = "";
        await streamChat({
          messages: history,
          mode,
          onDelta: (chunk) => {
            assistantContent += chunk;
            const captured = assistantContent;
            setSessions((prev) =>
              prev.map((s) =>
                s.id !== guestSessionId
                  ? s
                  : { ...s, messages: s.messages.map((m) => (m.id === assistantId ? { ...m, content: captured } : m)) }
              )
            );
            scrollToBottom();
          },
          onDone: () => { setIsLoading(false); scrollToBottom(); },
          onError: (err) => { toast.error(err); setIsLoading(false); },
        });
        return;
      }

      let sessionId = activeSessionId;
      let workingSession = activeSession;

      // Create session in DB if needed
      if (!sessionId) {
        const prefix = mode === "transform" ? "🔄 " : mode === "roadmap" ? "🗺️ " : "";
        const title = prefix + content.slice(0, 40);
        const { data: created, error } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id, title, mode })
          .select()
          .single();
        if (error || !created) {
          toast.error("Couldn’t save a new chat. The backend may be waking up — try again in a moment.");
          return;
        }
        sessionId = created.id;
        workingSession = {
          id: created.id,
          title: created.title,
          mode: created.mode as ChatMode,
          createdAt: new Date(created.created_at),
          messages: [],
        };
        setSessions((prev) => [workingSession!, ...prev]);
        setActiveSessionId(sessionId);
      }

      // Insert user message
      const { data: userMsgRow, error: userMsgErr } = await supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: user.id, role: "user", content })
        .select()
        .single();
      if (userMsgErr || !userMsgRow) {
        toast.error("Couldn’t save your message. Please try again in a moment.");
        return;
      }

      const userMsg: ChatMessage = {
        id: userMsgRow.id,
        role: "user",
        content,
        timestamp: new Date(userMsgRow.created_at),
      };

      // Insert empty assistant placeholder
      const { data: asstRow, error: asstErr } = await supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: user.id, role: "assistant", content: "" })
        .select()
        .single();
      if (asstErr || !asstRow) {
        toast.error("Couldn’t start the response. Please try again in a moment.");
        return;
      }

      const assistantId = asstRow.id;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  userMsg,
                  { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() },
                ],
              }
            : s
        )
      );
      scrollToBottom();
      setIsLoading(true);

      // Build history from current state
      const history = [
        ...((workingSession?.messages || []).map((m) => ({ role: m.role, content: m.content }))),
        { role: "user" as const, content },
      ];

      let assistantContent = "";
      await streamChat({
        messages: history,
        mode,
        onDelta: (chunk) => {
          assistantContent += chunk;
          const captured = assistantContent;
          setSessions((prev) =>
            prev.map((s) =>
              s.id !== sessionId
                ? s
                : { ...s, messages: s.messages.map((m) => (m.id === assistantId ? { ...m, content: captured } : m)) }
            )
          );
          scrollToBottom();
        },
        onDone: async () => {
          setIsLoading(false);
          scrollToBottom();
          if (assistantContent) {
            await supabase.from("chat_messages").update({ content: assistantContent }).eq("id", assistantId);
            await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
          }
        },
        onError: async (err) => {
          toast.error(err);
          setIsLoading(false);
          await supabase.from("chat_messages").delete().eq("id", assistantId);
          setSessions((prev) =>
            prev.map((s) =>
              s.id !== sessionId ? s : { ...s, messages: s.messages.filter((m) => m.id !== assistantId) }
            )
          );
        },
      });
    },
    [activeSessionId, activeSession, currentMode, user, scrollToBottom]
  );

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      const session = sessions.find((s) => s.id === id);
      if (session) setCurrentMode(session.mode);
      if (window.innerWidth < 768) setSidebarOpen(false);
    },
    [sessions]
  );

  const displayMode = activeSession?.mode || currentMode;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--gradient-surface)" }}>
      <OnboardingModal />
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onSetMode={handleSetMode}
        onDeleteSession={handleDeleteSession}
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
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors mr-3"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <span className="text-sm text-muted-foreground font-medium truncate">
            {activeSession?.title ||
              (displayMode === "transform"
                ? "Transform Me"
                : displayMode === "roadmap"
                ? "Roadmap Generator"
                : "New conversation")}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !activeSession || activeSession.messages.length === 0 ? (
            <EmptyChat onSuggestionClick={sendMessage} mode={displayMode} />
          ) : (
            <div className="py-4">
              {activeSession.messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} onOptionClick={sendMessage} />
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
              ? "what do you wanna become?"
              : displayMode === "roadmap"
              ? "what's the goal?"
              : "type something..."
          }
        />
      </div>
    </div>
  );
}
