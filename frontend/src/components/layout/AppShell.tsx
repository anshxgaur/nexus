import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ChatView } from "@/components/chat/ChatView";
import { MeetingView } from "@/components/meeting/MeetingView";
import { AIPanel } from "@/components/ai/AIPanel";
import { MailView } from "@/components/mail/MailView";
import { TodoView } from "@/components/todos/TodoView";
import { CalendarView } from "@/components/calendar/CalendarView";
import { PerformanceView } from "@/components/performance/PerformanceView";
import { UserManagementView } from "@/components/performance/UserManagementView";
import { NovaChatPanel } from "@/components/nova/NovaChatPanel";
import { useChatStore } from "@/stores/chatStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { AnimatePresence, motion } from "framer-motion";

export type View = "chat" | "meetings" | "ai" | "mail" | "todos" | "calendar" | "performance" | "users" | "nova";

export function AppShell() {
  const [view, setView] = useState<View>("chat");
  const fetchChannels = useChatStore((s) => s.fetchChannels);
  const fetchMeetings = useMeetingStore((s) => s.fetchMeetings);

  useEffect(() => {
    fetchChannels();
    fetchMeetings();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden text-ink-primary relative bg-surface selection:bg-accent/30">
      {/* Dynamic Background Blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-accent/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-600/5 rounded-full blur-[160px] pointer-events-none animate-pulse" style={{ animationDelay: '3s' }} />
      
      <Sidebar activeView={view} onViewChange={setView} />
      
      <main className="flex-1 flex flex-col min-w-0 p-4 relative z-10">
        <div className="flex-1 flex flex-col glass rounded-[2.5rem] overflow-hidden relative border border-white/5 shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.005 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex-1 flex flex-col overflow-hidden h-full"
            >
              {view === "chat" && <ChatView />}
              {view === "meetings" && <MeetingView />}
              {view === "ai" && <AIPanel />}
              {view === "mail" && <MailView />}
              {view === "todos" && <TodoView />}
              {view === "calendar" && <CalendarView />}
              {view === "performance" && <PerformanceView />}
              {view === "users" && <UserManagementView />}
              {view === "nova" && <NovaChatPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
