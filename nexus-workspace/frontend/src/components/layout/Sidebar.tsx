import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { useMailStore } from "@/stores/mailStore";
import { useEffect } from "react";
import { 
  MessageSquare, 
  Video, 
  Search, 
  Mail, 
  CheckSquare, 
  Calendar, 
  BarChart3, 
  Users, 
  LogOut,
  Hash,
  Plus
} from "lucide-react";

interface SidebarProps {
  activeView: any;
  onViewChange: (v: any) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const channels = useChatStore((s) => s.channels);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const meetings = useMeetingStore((s) => s.meetings);
  const unreadCount = useMailStore((s) => s.inbox.filter((m) => !m.is_read).length);

  useEffect(() => {
    useMailStore.getState().fetchInbox();
  }, []);

  const sections = [
    {
      title: "Navigation",
      items: [
        { id: "chat",        label: "Chat",        icon: <MessageSquare size={18} /> },
        { id: "meetings",    label: "Meetings",    icon: <Video size={18} /> },
        { id: "ai",          label: "FlowMind AI", icon: <Search size={18} /> },
      ]
    },
    {
      title: "Productivity",
      items: [
        { id: "mail",        label: "Inbox",       icon: <Mail size={18} />, badge: unreadCount > 0 ? unreadCount : undefined },
        { id: "todos",       label: "Task List",   icon: <CheckSquare size={18} /> },
        { id: "calendar",    label: "Calendar",    icon: <Calendar size={18} /> },
      ]
    },
    {
      title: "Workspace",
      items: [
        { id: "performance", label: "Analytics",   icon: <BarChart3 size={18} /> },
        { id: "users",       label: "Directory",   icon: <Users size={18} /> },
      ]
    }
  ];

  const initials = user?.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col glass text-ink-primary h-full border-r border-white/5 relative z-20">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-accent to-indigo-600 shadow-glow flex items-center justify-center text-white font-bold text-lg">
          N
        </div>
        <div>
          <h1 className="font-bold text-ink-primary text-base tracking-tight leading-none">Nexus</h1>
          <p className="text-[10px] text-accent font-bold tracking-[0.2em] uppercase mt-1 opacity-80">Workspace</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 space-y-8 overflow-y-auto no-scrollbar">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em] mb-3">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id as any)}
                    className={`sidebar-item w-full ${isActive ? "active" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${isActive ? 'text-accent' : 'text-ink-muted group-hover:text-ink-primary'}`}>
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="badge-err px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Stable Nested Lists (Prevents Jumping) */}
            {section.title === "Navigation" && activeView === "chat" && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 pl-4 space-y-1 border-l border-white/5 ml-5"
              >
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Channels</span>
                  <button className="text-ink-muted hover:text-accent transition-colors"><Plus size={12} /></button>
                </div>
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-all ${
                      activeChannelId === ch.id ? "text-accent bg-accent/5 font-semibold" : "text-ink-secondary hover:text-ink-primary hover:bg-white/[0.02]"
                    }`}
                  >
                    <Hash size={12} className="opacity-40" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        ))}
      </nav>

      {/* User Session Footer */}
      <div className="p-4 bg-white/[0.02] border-t border-white/5">
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-ink-primary flex-shrink-0">
            {initials || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-ink-primary truncate">{user?.name || "Member"}</p>
            <p className="text-[10px] text-ink-muted truncate font-mono">Verified</p>
          </div>
          <button
            onClick={logout}
            className="text-ink-muted hover:text-rose-500 transition-colors p-1.5"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

