import { useEffect, useState } from "react";
import { useMailStore } from "@/stores/mailStore";

export function MailView() {
  const { inbox, sent, users, fetchInbox, fetchSent, fetchUsers, sendMail, markAsRead, deleteMail } = useMailStore();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [composing, setComposing] = useState(false);
  const [draftTo, setDraftTo] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [selectedMail, setSelectedMail] = useState<string | null>(null);

  useEffect(() => {
    fetchInbox();
    fetchSent();
    fetchUsers();
  }, []);

  const handleSend = async () => {
    if (!draftTo || !draftSubject || !draftBody) return;
    await sendMail(draftTo, draftSubject, draftBody);
    setComposing(false);
    setDraftTo("");
    setDraftSubject("");
    setDraftBody("");
    setTab("sent");
  };

  const handleOpen = async (id: string, isRead: boolean) => {
    setSelectedMail(id);
    if (!isRead && tab === "inbox") {
      await markAsRead(id);
    }
  };

  const mails = tab === "inbox" ? inbox : sent;
  const currentMail = mails.find((m) => m.id === selectedMail);

  return (
    <div className="flex w-full h-full bg-transparent">
      {/* Left List */}
      <div className="w-1/3 flex flex-col border-r border-white/5 bg-black/10 backdrop-blur-sm z-10 shadow-glass">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink-primary tracking-tight">Mail</h2>
          <button onClick={() => setComposing(true)} className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 text-accent hover:bg-accent hover:text-white transition-all shadow-glow hover:shadow-accent/40 flex items-center justify-center font-bold text-lg leading-none pb-0.5">+</button>
        </div>
        <div className="flex p-3 gap-2 border-b border-white/5 bg-black/20">
          <button onClick={() => setTab("inbox")} className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${tab === "inbox" ? "bg-white/10 text-white font-semibold shadow-sm" : "text-ink-muted hover:bg-white/5"}`}>
            Inbox ({inbox.filter((m) => !m.is_read).length})
          </button>
          <button onClick={() => setTab("sent")} className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${tab === "sent" ? "bg-white/10 text-white font-semibold shadow-sm" : "text-ink-muted hover:bg-white/5"}`}>
            Sent
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mails.length === 0 && <p className="text-center text-ink-muted mt-8 text-sm px-4">No mail found</p>}
          {mails.map((m) => (
            <div key={m.id} onClick={() => handleOpen(m.id, m.is_read)} className={`p-4 border-b border-white/5 cursor-pointer transition-all ${selectedMail === m.id ? "bg-white/10 border-l-2 border-l-accent" : "hover:bg-white/5"}`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm ${m.is_read ? "text-ink-secondary" : "text-ink-primary font-bold"}`}>
                  {tab === "inbox" ? m.sender?.name : m.recipient?.name}
                </span>
                <span className="text-xs text-ink-muted uppercase tracking-wider font-semibold">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <div className={`text-sm truncate mb-1 ${m.is_read ? "text-ink-secondary" : "text-ink-primary font-medium"}`}>
                {!m.is_read && tab === "inbox" && <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 shadow-glow animate-pulse" />}
                {m.subject}
              </div>
              <div className="text-xs text-ink-muted truncate">{m.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent">
        <div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        {composing ? (
          <div className="p-8 flex flex-col h-full animate-in fade-in zoom-in-95 duration-200 z-10">
            <div className="bg-black/30 backdrop-blur-xl border border-white/5 shadow-glass rounded-3xl p-8 flex-1 flex flex-col">
              <h3 className="text-2xl font-bold text-ink-primary mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-ink-muted">New Message</h3>
              <select className="bg-black/40 border border-white/10 text-ink-primary rounded-xl px-4 py-3 outline-none focus:border-accent/50 transition-colors mb-4" value={draftTo} onChange={(e) => setDraftTo(e.target.value)}>
                <option value="" disabled>Select Recipient...</option>
                {users.map((u) => <option key={u.id} value={u.id} className="bg-surface text-ink-primary">{u.name}</option>)}
              </select>
              <input className="bg-black/40 border border-white/10 text-ink-primary rounded-xl px-4 py-3 outline-none focus:border-accent/50 transition-colors mb-4 placeholder:text-ink-muted" placeholder="Subject" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
              <textarea className="bg-black/40 border border-white/10 text-ink-primary rounded-xl px-4 py-3 outline-none focus:border-accent/50 transition-colors mb-6 flex-1 resize-none placeholder:text-ink-muted" placeholder="Write your message..." value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
              <div className="flex gap-3 justify-end mt-auto">
                <button onClick={() => setComposing(false)} className="px-6 py-2.5 rounded-xl border border-white/10 text-ink-muted hover:text-white hover:bg-white/5 transition-all text-sm font-semibold">Discard</button>
                <button onClick={handleSend} className="bg-gradient-to-r from-accent to-purple-600 text-white font-bold text-sm px-8 py-2.5 rounded-xl transition-all shadow-glow hover:shadow-accent/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!draftTo || !draftSubject || !draftBody}>Send 🚀</button>
              </div>
            </div>
          </div>
        ) : currentMail ? (
          <div className="p-8 flex flex-col h-full animate-in fade-in duration-200 z-10 overflow-y-auto">
            <div className="flex justify-between items-start mb-8 bg-black/20 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-glass">
              <div>
                <h3 className="text-3xl font-extrabold text-ink-primary mb-4 tracking-tight">{currentMail.subject}</h3>
                <div className="flex items-center gap-3 text-sm text-ink-secondary">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/30 flex items-center justify-center font-bold text-accent shadow-glow">
                    {currentMail.sender?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-1">
                    <span className="font-bold text-ink-primary block text-base">{currentMail.sender?.name}</span>
                    <span className="text-xs text-ink-muted">to <span className="text-ink-secondary">{currentMail.recipient?.name}</span></span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{new Date(currentMail.created_at).toLocaleString()}</span>
                <button onClick={() => { deleteMail(currentMail.id); setSelectedMail(null); }} className="px-4 py-1.5 text-xs font-bold text-err hover:text-white transition-all rounded-lg border border-err/30 hover:border-err bg-err/10 hover:bg-err hover:shadow-lg shadow-err/20">Delete</button>
              </div>
            </div>
            <div className="p-8 bg-black/10 backdrop-blur-sm rounded-3xl border border-white/5 text-base text-ink-primary whitespace-pre-wrap leading-relaxed shadow-inner min-h-[300px]">
              {currentMail.body}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-muted z-10 animate-in fade-in">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 text-3xl border border-white/10 shadow-glass relative text-ink-muted/50">
              <div className="absolute inset-0 bg-accent/10 rounded-3xl blur-xl" />
              ✉️
            </div>
            <p className="text-ink-primary font-medium">Select a conversation</p>
            <p className="text-sm">or create a new message</p>
          </div>
        )}
      </div>
    </div>
  );
}
