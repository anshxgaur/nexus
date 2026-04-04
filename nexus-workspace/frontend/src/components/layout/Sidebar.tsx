import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { useMeetingStore } from "@/stores/meetingStore";
import type { View } from "./AppShell";

interface SidebarProps {
  activeView: View;
  onViewChange: (v: View) => void;
}

const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconVideo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const IconAI = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>
);

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const channels = useChatStore((s) => s.channels);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const meetings = useMeetingStore((s) => s.meetings);

  const navItems: { id: View; label: string; icon: JSX.Element }[] = [
    { id: "chat",     label: "Chat",     icon: <IconChat /> },
    { id: "meetings", label: "Meetings", icon: <IconVideo /> },
    { id: "ai",       label: "AI Search", icon: <IconAI /> },
  ];

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-surface-border bg-surface-raised">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-surface-border">
        <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-sm">
          ⬡
        </div>
        <span className="font-semibold text-ink-primary text-sm tracking-tight">Nexus</span>
      </div>

      {/* Main nav */}
      <nav className="px-2 pt-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`sidebar-item w-full ${activeView === item.id ? "active" : ""}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="h-px bg-surface-border mx-3 my-3" />

      {/* Channels list */}
      {activeView === "chat" && (
        <div className="flex-1 overflow-y-auto px-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">Channels</span>
            <button
              onClick={async () => {
                const name = prompt("Channel name:");
                if (name?.trim()) await useChatStore.getState().createChannel(name.trim());
              }}
              className="text-ink-muted hover:text-accent transition-colors text-lg leading-none"
              title="New channel"
            >
              +
            </button>
          </div>
          <div className="space-y-0.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => { onViewChange("chat"); setActiveChannel(ch.id); }}
                className={`sidebar-item w-full ${activeChannelId === ch.id && activeView === "chat" ? "active" : ""}`}
              >
                <span className="text-ink-muted text-xs">#</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
            {channels.length === 0 && (
              <p className="text-xs text-ink-muted px-3 py-2">No channels yet</p>
            )}
          </div>
        </div>
      )}

      {/* Meetings list */}
      {activeView === "meetings" && (
        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 mb-2">
            <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">Recent</span>
          </div>
          <div className="space-y-0.5">
            {meetings.slice(0, 15).map((m) => (
              <div key={m.id} className="sidebar-item flex-col items-start gap-0.5 h-auto py-2">
                <span className="truncate text-xs font-medium">{m.title}</span>
                <span className={`text-[10px] ${
                  m.status === "active" ? "text-ok" :
                  m.status === "scheduled" ? "text-warn" : "text-ink-muted"
                }`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === "ai" && <div className="flex-1" />}

      {/* User footer */}
      <div className="p-3 border-t border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-ink-primary truncate">{user?.name}</p>
            <p className="text-[10px] text-ink-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-ink-muted hover:text-err transition-colors p-1 rounded-lg hover:bg-err/10"
            title="Sign out"
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
