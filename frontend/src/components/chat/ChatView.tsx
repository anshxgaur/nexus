import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { format, isToday, isYesterday, parseISO } from "date-fns";

function formatTs(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

function Avatar({ name, isAI }: { name: string; isAI?: boolean }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div
      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
        isAI ? "bg-info/20 border border-info/30 text-info" : "bg-accent/15 border border-accent/25 text-accent"
      }`}
    >
      {isAI ? "AI" : initials}
    </div>
  );
}

export function ChatView() {
  const { activeChannelId, channels, messages, sendMessage, setActiveChannel } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const channelMessages = activeChannelId ? (messages[activeChannelId] ?? []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length]);

  // Auto-select first channel
  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannel(channels[0].id);
    }
  }, [channels]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    try {
      await sendMessage(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeChannelId) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">#</div>
          <p className="text-sm">Select or create a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center px-5 border-b border-surface-border bg-surface-raised flex-shrink-0">
        <span className="text-ink-muted mr-1.5 text-sm">#</span>
        <h2 className="font-semibold text-ink-primary text-sm">{activeChannel?.name ?? "…"}</h2>
        {activeChannel?.description && (
          <>
            <div className="w-px h-4 bg-surface-border mx-3" />
            <span className="text-xs text-ink-secondary truncate">{activeChannel.description}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {channelMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-ink-muted">
            <div className="text-5xl mb-4 opacity-20">💬</div>
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {channelMessages.map((msg, i) => {
            const isOwn = msg.user_id === user?.id;
            const prevMsg = channelMessages[i - 1];
            const sameAuthor = prevMsg?.user_id === msg.user_id && !prevMsg?.is_ai;
            const showHeader = !sameAuthor || msg.is_ai;
            const authorName = msg.user?.name ?? (msg.is_ai ? "Nexus AI" : "Unknown");

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex gap-3 ${showHeader ? "mt-4" : "mt-0.5"}`}
              >
                <div className="w-8 flex-shrink-0">
                  {showHeader && <Avatar name={authorName} isAI={msg.is_ai} />}
                </div>
                <div className="flex-1 min-w-0">
                  {showHeader && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${msg.is_ai ? "text-info" : isOwn ? "text-accent" : "text-ink-primary"}`}>
                        {authorName}
                      </span>
                      <span className="text-[10px] text-ink-muted">{formatTs(msg.created_at)}</span>
                    </div>
                  )}
                  <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-5 py-4 border-t border-surface-border bg-surface-raised flex-shrink-0">
        <div className="flex items-end gap-3 bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${activeChannel?.name ?? "…"}`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: "20px" }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-ink-muted mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
