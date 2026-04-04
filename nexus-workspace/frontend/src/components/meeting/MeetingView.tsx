import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAuthStore } from "@/stores/authStore";
import { format, parseISO } from "date-fns";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

// ── Meeting list ──────────────────────────────────────────────────────────────
function MeetingCard({ meeting }: { meeting: ReturnType<typeof useMeetingStore.getState>["meetings"][0] }) {
  const { joinMeeting } = useMeetingStore();
  const [joining, setJoining] = useState(false);

  const statusColor = {
    scheduled: "badge-warn",
    active: "badge-ok",
    ended: "text-ink-muted bg-surface-overlay",
  }[meeting.status] ?? "badge-info";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink-primary text-sm truncate">{meeting.title}</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {format(parseISO(meeting.created_at), "MMM d, yyyy · h:mm a")}
          </p>
          {meeting.summary && (
            <p className="text-xs text-ink-secondary mt-2 line-clamp-2">{meeting.summary}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`badge ${statusColor} capitalize`}>{meeting.status}</span>
          {meeting.status !== "ended" && (
            <button
              className="btn-primary text-xs px-3 py-1.5"
              disabled={joining}
              onClick={async () => {
                setJoining(true);
                try { await joinMeeting(meeting.id); }
                finally { setJoining(false); }
              }}
            >
              {joining ? "Joining…" : meeting.status === "active" ? "Join" : "Start"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Transcript panel ──────────────────────────────────────────────────────────
function TranscriptPanel({ meetingId }: { meetingId: string }) {
  const transcripts = useMeetingStore((s) => s.transcripts[meetingId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts.length]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-l border-surface-border bg-surface-raised">
      <div className="px-4 h-12 flex items-center border-b border-surface-border">
        <span className="text-xs font-semibold text-ink-secondary uppercase tracking-widest">Live Transcript</span>
        {transcripts.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-ok text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse_dot" />
            Live
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcripts.length === 0 ? (
          <p className="text-xs text-ink-muted text-center mt-8">
            Transcript will appear here as people speak
          </p>
        ) : (
          transcripts.map((seg) => (
            <motion.div
              key={seg.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-0.5"
            >
              {seg.speaker && (
                <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">
                  {seg.speaker}
                </span>
              )}
              <p className="text-xs text-ink-primary leading-relaxed">{seg.text}</p>
              {seg.confidence != null && (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-0.5 bg-surface-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ok/60 rounded-full"
                      style={{ width: `${Math.round(seg.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-ink-muted">{Math.round(seg.confidence * 100)}%</span>
                </div>
              )}
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Active meeting room ───────────────────────────────────────────────────────
function ActiveMeetingRoom() {
  const { activeMeeting, liveKitToken, liveKitUrl, endMeeting, fetchTranscripts } = useMeetingStore();
  const user = useAuthStore((s) => s.user);
  const [ending, setEnding] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const { summarizeMeeting, lastSummary, summarizing } = require("@/stores/aiStore").useAIStore();

  useEffect(() => {
    if (activeMeeting?.id) fetchTranscripts(activeMeeting.id);
  }, [activeMeeting?.id]);

  if (!activeMeeting || !liveKitToken || !liveKitUrl) return null;

  const handleEnd = async () => {
    setEnding(true);
    try { await endMeeting(activeMeeting.id); }
    finally { setEnding(false); }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Video area */}
      <div className="flex-1 flex flex-col">
        {/* Meeting header */}
        <div className="h-14 flex items-center px-5 border-b border-surface-border bg-surface-raised flex-shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ok animate-pulse_dot" />
            <span className="text-sm font-semibold text-ink-primary">{activeMeeting.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn-ghost text-xs"
              onClick={async () => {
                setShowSummary(true);
                await summarizeMeeting(activeMeeting.id);
              }}
            >
              📋 Summarize
            </button>
            <button
              className="btn-danger text-xs"
              disabled={ending}
              onClick={handleEnd}
            >
              {ending ? "Ending…" : "End Meeting"}
            </button>
          </div>
        </div>

        {/* LiveKit video grid */}
        <div className="flex-1 bg-black overflow-hidden">
          <LiveKitRoom
            token={liveKitToken}
            serverUrl={liveKitUrl}
            connect={true}
            video={true}
            audio={true}
            className="h-full"
          >
            <VideoConference />
          </LiveKitRoom>
        </div>

        {/* Summary panel */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-surface-border bg-surface-raised overflow-hidden"
            >
              <div className="p-4 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-ink-secondary uppercase tracking-widest">
                    AI Summary
                  </span>
                  <button onClick={() => setShowSummary(false)} className="text-ink-muted hover:text-ink-primary text-xs">✕</button>
                </div>
                {summarizing ? (
                  <div className="flex items-center gap-2 text-ink-muted text-sm">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Generating summary…
                  </div>
                ) : lastSummary ? (
                  <div className="space-y-3 text-xs">
                    <p className="text-ink-primary leading-relaxed">{lastSummary.summary}</p>
                    {lastSummary.tasks.length > 0 && (
                      <div>
                        <p className="font-semibold text-ok mb-1">Action Items</p>
                        <ul className="space-y-1">
                          {lastSummary.tasks.map((t, i) => (
                            <li key={i} className="flex gap-2 text-ink-secondary">
                              <span className="text-ok mt-0.5">▸</span>{t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lastSummary.decisions.length > 0 && (
                      <div>
                        <p className="font-semibold text-accent mb-1">Decisions</p>
                        <ul className="space-y-1">
                          {lastSummary.decisions.map((d, i) => (
                            <li key={i} className="flex gap-2 text-ink-secondary">
                              <span className="text-accent mt-0.5">◆</span>{d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transcript sidebar */}
      <TranscriptPanel meetingId={activeMeeting.id} />
    </div>
  );
}

// ── Main meetings view ────────────────────────────────────────────────────────
export function MeetingView() {
  const { meetings, fetchMeetings, createMeeting, activeMeeting } = useMeetingStore();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  if (activeMeeting) return <ActiveMeetingRoom />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center px-5 border-b border-surface-border bg-surface-raised flex-shrink-0">
        <h2 className="font-semibold text-ink-primary text-sm">Meetings</h2>
        <button
          className="btn-primary text-xs ml-auto"
          onClick={() => setCreating(true)}
        >
          + New Meeting
        </button>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCreating(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card p-6 w-full max-w-sm shadow-glass"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-ink-primary mb-4">New Meeting</h3>
              <input
                autoFocus
                className="input-base mb-4"
                placeholder="Meeting title…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newTitle.trim()) {
                    await createMeeting(newTitle.trim());
                    setNewTitle("");
                    setCreating(false);
                    fetchMeetings();
                  }
                }}
              />
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setCreating(false)}>Cancel</button>
                <button
                  className="btn-primary flex-1"
                  disabled={!newTitle.trim()}
                  onClick={async () => {
                    await createMeeting(newTitle.trim());
                    setNewTitle("");
                    setCreating(false);
                    fetchMeetings();
                  }}
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meetings list */}
      <div className="flex-1 overflow-y-auto p-5">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-muted">
            <div className="text-5xl mb-4 opacity-20">🎥</div>
            <p className="text-sm">No meetings yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-3">
            {meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}
