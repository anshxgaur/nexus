import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeetingStore } from "@/stores/meetingStore";
import { useAIStore } from "@/stores/aiStore";

import { format, parseISO } from "date-fns";

import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Calendar, Clock, Users, Video, Plus, Copy, CheckCircle2, Radio, Archive } from "lucide-react";

// ── Meeting status helpers ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled: { label: "Scheduled", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  active: { label: "Live", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)" },
  ended: { label: "Ended", color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.25)" },
};

// ── Meeting card ────────────────────────────────────────────────────────────
function MeetingCard({ meeting }: { meeting: ReturnType<typeof useMeetingStore.getState>["meetings"][0] }) {
  const { joinMeeting } = useMeetingStore();
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = STATUS_CONFIG[meeting.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${meeting.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 hover:border-white/15 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              {meeting.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {cfg.label}
            </span>
          </div>
          <h3 className="font-bold text-ink-primary text-base truncate">{meeting.title}</h3>
          <div className="flex items-center gap-4 mt-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Calendar size={11} />
              {format(parseISO(meeting.created_at), "MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {format(parseISO(meeting.created_at), "h:mm a")}
            </span>
          </div>
          {meeting.summary && (
            <p className="text-xs text-ink-secondary mt-3 leading-relaxed line-clamp-2 border-l-2 border-accent/30 pl-3">
              {meeting.summary}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {meeting.status !== "ended" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all shadow-lg"
              style={{
                background: meeting.status === "active"
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : "linear-gradient(135deg, #8b5cf6, #4f46e5)",
                boxShadow: meeting.status === "active"
                  ? "0 4px 16px rgba(16,185,129,0.3)"
                  : "0 4px 16px rgba(139,92,246,0.3)",
              }}
              disabled={joining}
              onClick={async () => {
                setJoining(true);
                try { await joinMeeting(meeting.id); }
                finally { setJoining(false); }
              }}
            >
              {joining ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <Video size={14} />}
              {joining ? "Joining…" : meeting.status === "active" ? "Join Now" : "Start"}
            </motion.button>
          )}

          {/* Share link */}
          {meeting.status !== "ended" && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy invite link"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Create meeting modal ────────────────────────────────────────────────────
function CreateMeetingModal({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, scheduled?: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const scheduledAt = isScheduled && scheduleDate && scheduleTime
        ? `${scheduleDate}T${scheduleTime}:00`
        : undefined;
      await onCreate(title.trim(), scheduledAt);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  // Default to now+1h for scheduled time
  useEffect(() => {
    const now = new Date(Date.now() + 3600000);
    setScheduleDate(now.toISOString().slice(0, 10));
    setScheduleTime(now.toTimeString().slice(0, 5));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0 }}
        className="w-full max-w-md rounded-3xl p-6 border shadow-2xl"
        style={{ background: "rgba(18,18,22,0.95)", backdropFilter: "blur(40px)", borderColor: "rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-1">New Meeting</h3>
        <p className="text-sm text-zinc-500 mb-6">Schedule a meeting or start one instantly</p>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Meeting Title</label>
          <input
            autoFocus
            className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            placeholder="e.g. Q3 Strategy Review, Sprint Planning…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          />
        </div>

        {/* Toggle scheduled */}
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="w-10 h-5 rounded-full transition-all relative"
              style={{ background: isScheduled ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.1)" }}
              onClick={() => setIsScheduled(!isScheduled)}
            >
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: isScheduled ? "calc(100% - 18px)" : "2px" }} />
            </div>
            <span className="text-sm text-zinc-400">Schedule for later</span>
          </label>
        </div>

        {/* Date/time pickers */}
        <AnimatePresence>
          {isScheduled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-2xl px-4 py-3 text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Time</label>
                  <input
                    type="time"
                    className="w-full rounded-2xl px-4 py-3 text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3 mt-2">
          <button
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-zinc-400 hover:text-white transition-all border border-white/10 hover:bg-white/5"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-all shadow-lg disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
              boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
            }}
            disabled={!title.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? "Creating…" : isScheduled ? "Schedule Meeting" : "Start Now"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Transcript panel ────────────────────────────────────────────────────────
function TranscriptPanel({ meetingId }: { meetingId: string }) {
  const transcripts = useMeetingStore((s) => s.transcripts[meetingId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcripts.length]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-l border-surface-border" style={{ background: "rgba(0,0,0,0.2)" }}>
      <div className="px-4 h-12 flex items-center justify-between border-b border-surface-border flex-shrink-0">
        <span className="text-xs font-bold text-ink-secondary uppercase tracking-widest">Live Transcript</span>
        {transcripts.length > 0 && (
          <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcripts.length === 0 ? (
          <p className="text-xs text-ink-muted text-center mt-8 leading-relaxed">
            Transcript will appear here as people speak in the meeting
          </p>
        ) : (
          transcripts.map((seg) => (
            <motion.div key={seg.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="space-y-0.5">
              {seg.speaker && (
                <span className="text-[10px] font-bold text-accent uppercase tracking-wide">{seg.speaker}</span>
              )}
              <p className="text-xs text-ink-primary leading-relaxed">{seg.text}</p>
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Active meeting room ─────────────────────────────────────────────────────
function ActiveMeetingRoom() {
  const { activeMeeting, liveKitToken, liveKitUrl, endMeeting, fetchTranscripts } = useMeetingStore();
  const [ending, setEnding] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const { summarizeMeeting, lastSummary, summarizing } = useAIStore();


  useEffect(() => { if (activeMeeting?.id) fetchTranscripts(activeMeeting.id); }, [activeMeeting?.id]);
  if (!activeMeeting || !liveKitToken || !liveKitUrl) return null;

  const handleEnd = async () => {
    setEnding(true);
    try { await endMeeting(activeMeeting.id); }
    finally { setEnding(false); }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col">
        {/* Meeting header */}
        <div className="h-14 flex items-center px-5 border-b border-surface-border flex-shrink-0 gap-3"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-ink-primary">{activeMeeting.title}</span>
            <span className="badge badge-ok text-[10px]">LIVE</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn-ghost text-xs flex items-center gap-1.5"
              onClick={async () => { setShowSummary(true); await summarizeMeeting(activeMeeting.id); }}
            >
              📋 Summarize
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
              disabled={ending}
              onClick={handleEnd}
            >
              {ending ? "Ending…" : "End Meeting"}
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="flex-1 bg-black overflow-hidden">
          <LiveKitRoom token={liveKitToken} serverUrl={liveKitUrl} connect={true} video={true} audio={true} className="h-full">
            <VideoConference />
          </LiveKitRoom>
        </div>

        {/* Summary panel */}
        <AnimatePresence>
          {showSummary && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="border-t border-surface-border overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
              <div className="p-4 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-ink-secondary uppercase tracking-widest">AI Summary</span>
                  <button onClick={() => setShowSummary(false)} className="text-ink-muted hover:text-ink-primary text-xs">✕</button>
                </div>
                {summarizing ? (
                  <div className="flex items-center gap-2 text-ink-muted text-sm">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating summary…
                  </div>
                ) : lastSummary ? (
                  <div className="space-y-3 text-xs">
                    <p className="text-ink-primary leading-relaxed">{lastSummary.summary}</p>
                    {lastSummary.tasks.length > 0 && (
                      <div>
                        <p className="font-bold text-emerald-400 mb-1">✓ Action Items</p>
                        <ul className="space-y-1">
                          {lastSummary.tasks.map((t: string, i: number) => (
                            <li key={i} className="flex gap-2 text-ink-secondary"><span className="text-emerald-400 mt-0.5">▸</span>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lastSummary.decisions.length > 0 && (
                      <div>
                        <p className="font-bold text-accent mb-1">◆ Decisions</p>
                        <ul className="space-y-1">
                          {lastSummary.decisions.map((d: string, i: number) => (
                            <li key={i} className="flex gap-2 text-ink-secondary"><span className="text-accent mt-0.5">◆</span>{d}</li>
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
      <TranscriptPanel meetingId={activeMeeting.id} />
    </div>
  );
}

// ── Main meeting view ───────────────────────────────────────────────────────
export function MeetingView() {
  const { meetings, fetchMeetings, createMeeting, activeMeeting } = useMeetingStore();
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "active" | "past">("upcoming");

  if (activeMeeting) return <ActiveMeetingRoom />;

  const upcoming = meetings.filter((m) => m.status === "scheduled");
  const active = meetings.filter((m) => m.status === "active");
  const past = meetings.filter((m) => m.status === "ended");
  const tabMeetings = { upcoming, active, past }[tab];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-surface-border flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.15)" }}>
        <div>
          <h2 className="font-bold text-ink-primary">Meetings</h2>
          <p className="text-xs text-zinc-500">{active.length > 0 ? `${active.length} meeting live now` : "No active meetings"}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 4px 16px rgba(139,92,246,0.3)" }}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} />New Meeting
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-surface-border flex-shrink-0">
        {[
          { key: "active", label: "Live", icon: <Radio size={12} />, count: active.length },
          { key: "upcoming", label: "Upcoming", icon: <Calendar size={12} />, count: upcoming.length },
          { key: "past", label: "Past", icon: <Archive size={12} />, count: past.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tab === t.key ? "rgba(139,92,246,0.15)" : "transparent",
              color: tab === t.key ? "#a78bfa" : "#6b7280",
              border: tab === t.key ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
            }}
          >
            {t.icon}{t.label}
            {t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: tab === t.key ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {tabMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-muted">
            <div className="text-5xl mb-4 opacity-20">🎥</div>
            <p className="text-sm font-semibold">No {tab} meetings</p>
            <p className="text-xs mt-1 text-zinc-600">
              {tab === "upcoming" ? "Schedule a meeting to see it here." : tab === "active" ? "No live meetings right now." : "Past meetings will appear here."}
            </p>
            {tab === "upcoming" && (
              <button
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.4)" }}
                onClick={() => setCreating(true)}
              >
                + Schedule Meeting
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-2xl space-y-3">
            {tabMeetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <CreateMeetingModal
            onClose={() => setCreating(false)}
            onCreate={async (title, scheduled) => {
              await createMeeting(title);
              fetchMeetings();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
