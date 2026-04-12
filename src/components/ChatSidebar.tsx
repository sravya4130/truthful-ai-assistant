import { Plus, MessageSquare, Sparkles, Image, Video, FileText, Globe, ChevronLeft } from "lucide-react";
import { ChatSession } from "@/types/chat";
import { motion, AnimatePresence } from "framer-motion";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const creationTools = [
  { icon: Sparkles, label: "Transform Me", id: "transform" },
  { icon: Image, label: "Image Generator", id: "image" },
  { icon: Video, label: "Video Generator", id: "video" },
  { icon: FileText, label: "PPT Generator", id: "ppt" },
  { icon: Globe, label: "Website Generator", id: "website" },
];

export function ChatSidebar({ sessions, activeSessionId, onSelectSession, onNewChat, isOpen, onToggle }: ChatSidebarProps) {
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
            className="mx-4 mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity glow"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Chats</p>
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors truncate ${
                  activeSessionId === session.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">{session.title}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-sidebar-border p-2 space-y-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Create</p>
            {creationTools.map((tool) => (
              <button
                key={tool.id}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <tool.icon className="w-4 h-4 shrink-0" />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
