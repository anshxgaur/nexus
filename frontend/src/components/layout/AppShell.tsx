import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ChatView } from "@/components/chat/ChatView";
import { MeetingView } from "@/components/meeting/MeetingView";
import { AIPanel } from "@/components/ai/AIPanel";
import { useChatStore } from "@/stores/chatStore";
import { useMeetingStore } from "@/stores/meetingStore";

export type View = "chat" | "meetings" | "ai";

export function AppShell() {
  const [view, setView] = useState<View>("chat");
  const fetchChannels = useChatStore((s) => s.fetchChannels);
  const fetchMeetings = useMeetingStore((s) => s.fetchMeetings);

  useEffect(() => {
    fetchChannels();
    fetchMeetings();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar activeView={view} onViewChange={setView} />
      <main className="flex-1 flex overflow-hidden">
        {view === "chat" && <ChatView />}
        {view === "meetings" && <MeetingView />}
        {view === "ai" && <AIPanel />}
      </main>
    </div>
  );
}
