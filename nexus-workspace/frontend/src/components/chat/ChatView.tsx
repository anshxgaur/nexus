import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Send, Hash, Info, User as UserIcon, Bot } from "lucide-react";

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
      className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold ${
        isAI ? "bg-accent/10 text-accent border border-accent/20" : "bg-white/5 text-ink-secondary border border-white/10"
      }`}
    >
      {isAI ? <Bot size={16} /> : initials}
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
    // Avoid smooth scroll if there are too many messages to prevent jitters
    const behavior = channelMessages.length > 50 ? "auto" : "smooth";
    bottomRef.current?.scrollIntoView({ behavior });
  }, [channelMessages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    try {
      await sendMessage(text);
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
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
      <div className="flex-1 flex flex-col items-center justify-center text-ink-muted bg-transparent">
        <div className="w-20 h-20 bg-white/[0.03] rounded-[2rem] border border-white/5 flex items-center justify-center mb-6">
          <Hash size={32} className="opacity-20" />
        </div>
        <h3 className="text-xl font-bold text-ink-primary mb-2">Select a Channel</h3>
        <p className="text-sm max-w-xs text-center opacity-60">Join the conversation or start a new discussion thread from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-white/[0.01] backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/5 text-ink-muted">
            <Hash size={18} />
          </div>
          <div>
            <h2 className="font-bold text-ink-primary text-base">{activeChannel?.name ?? "Loading..."}</h2>
            <p className="text-[10px] text-ink-muted font-medium uppercase tracking-wider">
              {activeChannel?.description || "Public Channel"}
            </p>
          </div>
        </div>
        <button className="p-2 rounded-xl hover:bg-white/5 text-ink-muted transition-colors">
          <Info size={18} />
        </button>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar h-full">
        {channelMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-accent/5 rounded-[2rem] flex items-center justify-center mb-6 border border-accent/10">
              <Bot size={28} className="text-accent opacity-40" />
            </div>
            <p className="text-sm font-medium text-ink-muted">Start of <span className="text-white">#{activeChannel?.name}</span></p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {channelMessages.map((msg, i) => {
            const isOwn = msg.user_id === user?.id;
            const prevMsg = channelMessages[i - 1];
            const sameAuthor = prevMsg?.user_id === msg.user_id && !prevMsg?.is_ai;
            const showHeader = !sameAuthor || msg.is_ai;
            const authorName = msg.user?.name ?? (msg.is_ai ? "FlowMind AI" : "Anonymous");

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${showHeader ? "mt-2" : "-mt-4"}`}
              >
                <div className="w-9 flex-shrink-0">
                  {showHeader && <Avatar name={authorName} isAI={msg.is_ai} />}
                </div>
                <div className="flex-1 min-w-0">
                  {showHeader && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold leading-none ${msg.is_ai ? "text-accent" : isOwn ? "text-indigo-400" : "text-ink-primary"}`}>
                        {authorName}
                      </span>
                      <span className="text-[10px] text-ink-muted font-medium opacity-60">{formatTs(msg.created_at)}</span>
                    </div>
                  )}
                  <div className={`text-sm text-ink-primary leading-relaxed whitespace-pre-wrap break-words bg-white/[0.03] border border-white/5 p-4 rounded-2xl rounded-tl-none group hover:bg-white/[0.04] transition-colors ${!showHeader ? 'mt-1' : ''}`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Composer Container */}
      <div className="px-8 pb-8 pt-2">
        <div className="glass-card p-2 group focus-within:border-accent/30 transition-all duration-300">
          <div className="flex items-end gap-3 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Communicate in #${activeChannel?.name ?? "..."}`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted/50 resize-none outline-none leading-relaxed py-2 max-h-48 overflow-y-auto no-scrollbar"
              style={{ minHeight: "24px" }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-20 disabled:scale-95 transition-all active:scale-90 flex items-center justify-center shadow-lg shadow-accent/20"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 px-4">
          <p className="text-[9px] text-ink-muted font-bold uppercase tracking-wider">
            Markdown Supported
          </p>
          <p className="text-[9px] text-ink-muted font-medium">
            <span className="font-bold">Enter</span> to send · <span className="font-bold">Shift+Enter</span> for new line
          </p>
        </div>
      </div>
    </div>
  );
}
