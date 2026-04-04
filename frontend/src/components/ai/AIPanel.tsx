import { useState, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIStore } from "@/stores/aiStore";

const SOURCE_LABELS: Record<string, string> = {
  chat_messages: "💬 Chat",
  transcripts: "🎙 Meeting",
  documents: "📄 Document",
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-surface-overlay text-ink-secondary border border-surface-border">
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

function ResultCard({
  result,
  index,
}: {
  result: { text: string; source: string; score: number; metadata: Record<string, unknown> };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shortText = result.text.length > 180 ? result.text.slice(0, 180) + "…" : result.text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="card p-4 hover:border-accent/30 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <SourceBadge source={result.source} />
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 bg-surface-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent/70 rounded-full"
              style={{ width: `${Math.round(result.score * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-ink-muted">{Math.round(result.score * 100)}%</span>
        </div>
      </div>
      <p className="text-xs text-ink-primary leading-relaxed">
        {expanded ? result.text : shortText}
      </p>
      {result.metadata.meeting_id && (
        <p className="text-[10px] text-ink-muted mt-1.5">
          Meeting: {String(result.metadata.meeting_title ?? result.metadata.meeting_id).slice(0, 40)}
        </p>
      )}
      {result.metadata.channel_id && (
        <p className="text-[10px] text-ink-muted mt-1.5">
          Channel: {String(result.metadata.channel_id).slice(0, 40)}
        </p>
      )}
    </motion.div>
  );
}

const EXAMPLE_QUERIES = [
  "What decisions were made last week?",
  "Who is responsible for the Q3 report?",
  "What were the action items from yesterday's standup?",
  "What did we decide about the product roadmap?",
];

export function AIPanel() {
  const { searching, searchResults, searchAnswer, lastQuery, search, clearSearch } = useAIStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || searching) return;
    setQuery(text);
    await search(text);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center px-5 border-b border-surface-border bg-surface-raised flex-shrink-0">
        <h2 className="font-semibold text-ink-primary text-sm">AI Knowledge Search</h2>
        <span className="ml-2 badge badge-info text-[10px]">RAG</span>
        {searchResults.length > 0 && (
          <button className="btn-ghost text-xs ml-auto" onClick={() => { clearSearch(); setQuery(""); }}>
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search box */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-surface-border px-5 py-4 z-10">
          <div className="flex gap-3 max-w-3xl">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <input
                ref={inputRef}
                className="input-base pl-9 pr-4"
                placeholder="Ask anything about your company knowledge…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={searching}
              />
            </div>
            <button
              className="btn-primary px-5 flex-shrink-0"
              onClick={() => handleSearch()}
              disabled={!query.trim() || searching}
            >
              {searching ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : "Search"}
            </button>
          </div>
        </div>

        <div className="p-5 max-w-3xl mx-auto w-full">
          {/* Initial state */}
          {!searchResults.length && !searching && !lastQuery && (
            <div className="mt-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4 text-3xl">
                  🧠
                </div>
                <h3 className="text-ink-primary font-semibold mb-2">Search your company knowledge</h3>
                <p className="text-ink-secondary text-sm max-w-md mx-auto leading-relaxed">
                  Ask questions in plain English. Nexus AI searches across all your chat messages,
                  meeting transcripts, and documents using semantic search.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Try asking
                </p>
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    className="w-full text-left px-4 py-3 rounded-xl border border-surface-border hover:border-accent/40 bg-surface-raised hover:bg-accent-muted transition-all text-sm text-ink-secondary hover:text-ink-primary"
                    onClick={() => { setQuery(q); handleSearch(q); }}
                  >
                    <span className="text-accent mr-2">↗</span>{q}
                  </button>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { icon: "💬", label: "Chat History", desc: "All channel messages" },
                  { icon: "🎙", label: "Transcripts", desc: "Meeting recordings" },
                  { icon: "📄", label: "Documents", desc: "Uploaded files" },
                ].map((item) => (
                  <div key={item.label} className="card p-4 text-center">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <p className="text-xs font-semibold text-ink-primary">{item.label}</p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {searching && (
            <div className="mt-8 flex flex-col items-center gap-4 text-ink-muted">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">🧠</div>
              </div>
              <p className="text-sm">Searching across your knowledge base…</p>
              <p className="text-xs text-ink-muted">Embedding query → Qdrant → Ollama</p>
            </div>
          )}

          {/* Results */}
          {!searching && searchAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* AI Answer */}
              <div className="card p-5 border-accent/30 bg-accent-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-xs">
                    ✦
                  </div>
                  <span className="text-xs font-semibold text-accent uppercase tracking-wide">AI Answer</span>
                  <span className="text-[10px] text-ink-muted ml-auto">for "{lastQuery}"</span>
                </div>
                <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">{searchAnswer}</p>
              </div>

              {/* Source results */}
              {searchResults.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                    {searchResults.length} Sources
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((r, i) => (
                      <ResultCard key={i} result={r} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* No results */}
          {!searching && lastQuery && !searchAnswer && (
            <div className="mt-8 text-center text-ink-muted">
              <div className="text-4xl mb-3 opacity-30">🔍</div>
              <p className="text-sm">No results found for "{lastQuery}"</p>
              <p className="text-xs mt-1 text-ink-muted">Try a different query or check if relevant data has been ingested</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
