import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNovaStore } from "@/stores/novaStore";
import { Plus, Trash2, Send, Mic, Paperclip, Zap, Cpu, WifiOff, Bot } from "lucide-react";

/* ── Markdown-like renderer for Nova responses ── */
function NovaText({ text, streaming }: { text: string; streaming?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <span className="nova-text">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{part.slice(1, -1)}</code>;
        if (part === "\n") return <br key={i} />;
        return <span key={i}>{part}</span>;
      })}
      {streaming && <span className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: "#8b5cf6" }} />}
    </span>
  );
}

/* ── Source status badge ── */
function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const config = {
    groq: { icon: <Zap size={10} />, label: "Groq", color: "#f59e0b" },
    ollama: { icon: <Cpu size={10} />, label: "Ollama", color: "#10b981" },
    offline: { icon: <WifiOff size={10} />, label: "Offline", color: "#ef4444" },
  }[source as string] ?? { icon: <Bot size={10} />, label: source, color: "#6b7280" };

  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border"
      style={{ color: config.color, borderColor: `${config.color}30`, background: `${config.color}10` }}>
      {config.icon}{config.label}
    </span>
  );
}

/* ── Conversation sidebar ── */
function ConvSidebar() {
  const { conversations, activeId, setActiveId, newConversation, deleteConversation } = useNovaStore();

  return (
    <div className="w-56 flex-shrink-0 flex flex-col border-r h-full overflow-hidden"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
      <div className="p-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button
          onClick={newConversation}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
        >
          <Plus size={14} /> New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-center text-xs text-zinc-600 mt-6 px-3">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => setActiveId(conv.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-xs transition-all group"
            style={{
              background: activeId === conv.id ? "rgba(139,92,246,0.12)" : "transparent",
              color: activeId === conv.id ? "#a78bfa" : "#71717a",
            }}
          >
            <Bot size={12} className="flex-shrink-0 opacity-60" />
            <span className="flex-1 truncate">{conv.label}</span>
            <span
              className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all p-0.5 rounded"
              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
            >
              <Trash2 size={10} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Suggestions ── */
const SUGGESTIONS = [
  { icon: "📋", title: "Summarize last meeting", desc: "Get key decisions & action items" },
  { icon: "📝", title: "Draft a project update email", desc: "Professional email template" },
  { icon: "🔍", title: "What's in our knowledge base?", desc: "Explore company documents" },
  { icon: "📊", title: "Analyze team performance data", desc: "Insights and recommendations" },
];

export function NovaChatPanel() {
  const { conversations, activeId, generating, novaStatus, checkStatus, sendMessage, newConversation, initConversation } =
    useNovaStore();

  const [input, setInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ text: string; name: string } | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{ data: string; name: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId);
  const messages = activeConv?.messages ?? [];

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  useEffect(() => {
    if (!activeId && conversations.length === 0) initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, generating]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && !uploadedFile && !uploadedImage) || generating) return;

    let payload = text;
    if (uploadedFile) {
      payload = `[Attached: ${uploadedFile.name}]\n\n${uploadedFile.text}\n\nUser: ${text || "Analyze this file."}`;
    }

    const img = uploadedImage?.data;
    setInput("");
    setUploadedFile(null);
    setUploadedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await sendMessage(payload, img);
  }, [input, generating, uploadedFile, uploadedImage, sendMessage]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = (ev) => setUploadedImage({ data: ev.target?.result as string, name: file.name });
      reader.readAsDataURL(file);
    } else {
      reader.onload = (ev) => setUploadedFile({ text: ev.target?.result as string, name: file.name });
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Sidebar */}
      <ConvSidebar />

      {/* Main Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-5 border-b flex-shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" }}>N</div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Nova</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Corporate AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SourceBadge source={novaStatus?.source ?? null} />
            <span className="text-xs text-zinc-600 font-mono">{novaStatus?.model?.slice(0, 20)}</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-8 px-6 pb-16">
              <div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 0 32px rgba(139,92,246,0.3)" }}>
                  ✦
                </div>
                <h3 className="text-xl font-bold text-white text-center">How can I help you?</h3>
                <p className="text-zinc-500 text-sm text-center mt-2">Your corporate AI assistant — connected to your workspace</p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xl w-full">
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s.title}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setInput(s.title); textareaRef.current?.focus(); }}
                    className="p-4 rounded-2xl text-left transition-all border"
                    style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
                  >
                    <div className="text-xl mb-2">{s.icon}</div>
                    <p className="text-sm font-semibold text-white leading-snug">{s.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{s.desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-1">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 py-5 border-b ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold self-start mt-0.5
                      ${msg.role === "user"
                        ? "bg-zinc-800 border border-zinc-700 text-zinc-300"
                        : "text-white"}`}
                      style={msg.role === "assistant" ? { background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" } : {}}>
                      {msg.role === "user" ? "U" : "✦"}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 min-w-0 ${msg.role === "user" ? "text-right" : ""}`}>
                      <div className={`flex items-center gap-2 mb-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                        <span className="text-xs font-semibold text-zinc-400">
                          {msg.role === "user" ? "You" : "Nova"}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {msg.image && (
                        <img src={msg.image} alt="uploaded" className="max-w-xs rounded-xl mb-2 border border-zinc-800" />
                      )}

                      <div className={`text-sm leading-relaxed ${msg.role === "user" ? "text-zinc-300" : "text-zinc-200"}`}>
                        {msg.role === "assistant"
                          ? <NovaText text={msg.text} streaming={msg.streaming} />
                          : <span className="whitespace-pre-wrap">{msg.text}</span>}
                      </div>

                      {/* Copy button */}
                      {msg.role === "assistant" && !msg.streaming && msg.text && (
                        <button
                          className="text-[10px] text-zinc-600 hover:text-zinc-400 mt-2 transition-colors"
                          onClick={() => navigator.clipboard.writeText(msg.text)}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {generating && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3 py-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" }}>✦</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                        style={{ background: "#8b5cf6", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment preview */}
            {(uploadedFile || uploadedImage) && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border"
                  style={{ background: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.3)", color: "#a78bfa" }}>
                  <Paperclip size={12} />
                  {uploadedFile?.name ?? uploadedImage?.name}
                  <button onClick={() => { setUploadedFile(null); setUploadedImage(null); }} className="ml-1 text-zinc-500 hover:text-rose-400">✕</button>
                </div>
              </div>
            )}

            <div className="rounded-3xl border overflow-hidden transition-all"
              style={{ background: "rgba(20,20,24,0.9)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 0 0 1px rgba(139,92,246,0)" }}>
              <textarea
                ref={textareaRef}
                className="w-full px-5 pt-4 pb-2 bg-transparent text-sm text-white placeholder:text-zinc-600 resize-none outline-none leading-relaxed"
                placeholder="Ask Nova anything about your workspace…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                disabled={generating}
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
                    accept="image/*,.txt,.md,.json,.csv,.py,.ts,.tsx,.js,.jsx" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
                    title="Attach file"
                  >
                    <Paperclip size={15} />
                  </button>
                  <span className="text-[10px] text-zinc-700">Shift+Enter for newline</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={(!input.trim() && !uploadedFile && !uploadedImage) || generating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", color: "white" }}
                >
                  {generating ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : <Send size={14} />}
                  {generating ? "Thinking…" : "Send"}
                </motion.button>
              </div>
            </div>

            <p className="text-center text-[10px] text-zinc-700 mt-2">
              Nova may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
