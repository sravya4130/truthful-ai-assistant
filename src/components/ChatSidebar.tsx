import { Plus, MessageSquare, Sparkles, Image, Video, FileText, Globe, ChevronLeft, Map, LogOut, Trash2, LogIn } from "lucide-react";
import { ChatSession, ChatMode } from "@/types/chat";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onSetMode: (mode: ChatMode) => void;
  onDeleteSession: (id: string) => void;
  currentMode: ChatMode;
  isOpen: boolean;
  onToggle: () => void;
}

const modeButtons = [
  { icon: Sparkles, label: "Transform Me", mode: "transform" as ChatMode },
  { icon: Map, label: "Roadmap Generator", mode: "roadmap" as ChatMode },
];

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onSetMode,
  onDeleteSession,
  currentMode,
  isOpen,
  onToggle,
}: ChatSidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const creationTools = [
    { icon: Image, label: "Image Generator", onClick: () => user ? navigate("/images") : toast.error("Sign up to use this"), enabled: true },
    { icon: FileText, label: "PPT Generator", onClick: () => user ? navigate("/ppt") : toast.error("Sign up to use this"), enabled: true },
    { icon: Video, label: "Video Generator", onClick: () => toast("Coming soon"), enabled: false },
    { icon: Globe, label: "Website Generator", onClick: () => toast("Coming soon"), enabled: false },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          exit={{ x: -280 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed md:relative z-40 w-[280px] h-full flex flex-col border-r border-border bg-sidebar"
        >
          <div className="p-4 flex items-center justify-between">
            <h1 className="font-heading text-xl font-bold text-gradient">TruthAI</h1>
            <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
              <ChevronLeft className="w-4 h-4 text-sidebar-foreground" />
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="mx-4 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity glow"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          <div className="mx-4 mb-4 space-y-1">
            {modeButtons.map((btn) => (
              <button
                key={btn.mode}
                onClick={() => onSetMode(btn.mode)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentMode === btn.mode
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <btn.icon className="w-4 h-4 shrink-0" />
                <span>{btn.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Chats</p>
            {!user ? (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">Sign up below to save your chats</p>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">No chats yet</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="group relative">
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 pr-8 rounded-lg text-sm text-left transition-colors truncate ${
                      activeSessionId === session.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    {session.mode === "transform" ? (
                      <Sparkles className="w-4 h-4 shrink-0 text-primary" />
                    ) : session.mode === "roadmap" ? (
                      <Map className="w-4 h-4 shrink-0 text-primary" />
                    ) : (
                      <MessageSquare className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{session.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this chat?")) onDeleteSession(session.id);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-sidebar-border p-2 space-y-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Create</p>
            {creationTools.map((tool) => (
              <button
                key={tool.label}
                onClick={tool.onClick}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${
                  !tool.enabled ? "opacity-50" : ""
                }`}
              >
                <tool.icon className="w-4 h-4 shrink-0" />
                <span>{tool.label}</span>
                {!tool.enabled && <span className="ml-auto text-[10px] text-muted-foreground">soon</span>}
              </button>
            ))}
          </div>

          {user ? (
            <div className="border-t border-sidebar-border p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                {(user.email?.[0] || "U").toUpperCase()}
              </div>
              <span className="text-xs text-sidebar-foreground truncate flex-1">{user.email}</span>
              <button
                onClick={signOut}
                className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="border-t border-sidebar-border p-3 space-y-2">
              <p className="text-xs text-muted-foreground px-1">Browsing as guest</p>
              <button
                onClick={() => navigate("/auth")}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity glow"
              >
                <LogIn className="w-4 h-4" />
                Sign up / Log in
              </button>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
