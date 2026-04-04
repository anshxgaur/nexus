import { useEffect, useState } from "react";
import { useCalendarStore, CalendarEvent } from "@/stores/calendarStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { Video, Calendar } from "lucide-react";

export function CalendarView() {
  const { events, fetchEvents, createEvent, deleteEvent } = useCalendarStore();
  const { createMeeting } = useMeetingStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [isMeeting, setIsMeeting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();

  const handleCreate = async () => {
    if (!draftTitle || !draftDate) return;
    const start_dt = new Date(draftDate).toISOString();
    // Default 1h duration
    const end_dt = new Date(new Date(draftDate).getTime() + 3600000).toISOString();
    
    // If it's a meeting, create it through the meeting store
    if (isMeeting) {
      await createMeeting(draftTitle);
    }

    await createEvent({
      title: draftTitle,
      start_dt,
      end_dt,
      color: isMeeting ? "#8b5cf6" : ["#6c63ff", "#ff6b6b", "#4ecdc4", "#feca57", "#ff9f43"][Math.floor(Math.random() * 5)],
      all_day: false,
      description: isMeeting ? "Scheduled Video Meeting" : ""
    });

    setShowModal(false);
    setDraftTitle("");
    setDraftDate("");
    setIsMeeting(false);
  };

  const getDayEvents = (d: number) => {
    return events.filter(e => {
      const ed = new Date(e.start_dt);
      return ed.getDate() === d && ed.getMonth() === month && ed.getFullYear() === year;
    });
  };

  return (
    <div className="flex-1 flex flex-col p-8 bg-transparent overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-6">
            <h1 className="text-4xl font-extrabold text-ink-primary tracking-tight w-64 bg-clip-text text-transparent bg-gradient-to-r from-white to-ink-muted">
              {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h1>
            <div className="flex bg-black/30 backdrop-blur-md p-1 border border-white/5 rounded-2xl shadow-glass">
              <button className="p-2 w-10 text-ink-secondary hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>←</button>
              <button className="px-5 text-sm font-bold text-ink-primary hover:bg-white/5 hover:text-white rounded-xl tracking-wider uppercase transition-all" onClick={() => setCurrentDate(new Date())}>Today</button>
              <button className="p-2 w-10 text-ink-secondary hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>→</button>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-gradient-to-r from-accent to-purple-600 hover:opacity-90 text-white shadow-glow hover:shadow-accent/40 px-6 font-bold py-2.5 rounded-xl transition-all active:scale-95">New Event</button>
        </div>

        <div className="rounded-3xl border border-white/5 bg-black/20 backdrop-blur-xl overflow-hidden shadow-glass relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
          {/* Header */}
          <div className="grid grid-cols-7 border-b border-white/5 bg-white/5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-4 text-center text-xs font-bold text-ink-muted uppercase tracking-widest">{d}</div>
            ))}
          </div>
          
          {/* Grid */}
          <div className="grid grid-cols-7 auto-rows-[140px] bg-white/5 gap-px border-t border-white/5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-black/20" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const dayEvents = getDayEvents(d);
              return (
                <div key={d} className={`p-2 transition-colors relative group bg-black/20 hover:bg-white/5 flex flex-col`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold w-sm h-8 flex items-center justify-center min-w-[2rem] px-2 rounded-full ${isToday ? "bg-accent/80 text-white shadow-glow" : "text-ink-muted group-hover:text-white"}`}>
                      {d}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar pb-1">
                    {dayEvents.map(e => (
                      <div key={e.id} className="text-[10px] px-2 py-1 rounded-lg font-semibold truncate flex items-center justify-between group/event transition-transform hover:scale-[1.02] cursor-pointer" style={{ backgroundColor: `${e.color}15`, borderLeft: `3px solid ${e.color}`, color: e.color }}>
                        <div className="flex items-center gap-1.5 truncate">
                          {e.description?.includes("Video Meeting") && <Video size={10} className="flex-shrink-0" />}
                          <span className="truncate">{e.title}</span>
                        </div>
                        <button onClick={(ev) => { ev.stopPropagation(); deleteEvent(e.id); }} className="opacity-0 group-hover/event:opacity-100 hover:bg-white/20 w-4 h-4 rounded flex items-center justify-center transition-all">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Fill remaining cells to complete the grid */}
            {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }).map((_, i) => (
              <div key={`end-empty-${i}`} className="bg-black/20" />
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in zoom-in duration-200">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] w-full max-w-md shadow-glass relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-[40px] pointer-events-none" />
            <h3 className="text-2xl font-bold text-ink-primary mb-6 tracking-tight">Create Event</h3>
            <div className="space-y-4 mb-8 relative z-10">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1">Event Title</label>
                <input className="w-full bg-black/40 border border-white/10 text-ink-primary rounded-xl px-4 py-3 outline-none focus:border-accent/50 transition-colors placeholder:text-ink-muted" placeholder="e.g. Team Sync" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1">Start Time</label>
                <input className="w-full bg-black/40 border border-white/10 text-ink-secondary rounded-xl px-4 py-3 outline-none focus:border-accent/50 transition-colors" type="datetime-local" value={draftDate} onChange={e => setDraftDate(e.target.value)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 mt-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isMeeting ? "bg-accent/20 text-accent font-bold" : "bg-white/5 text-ink-muted font-bold"}`}>
                    <Video size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-primary">Video Meeting</p>
                    <p className="text-[10px] text-ink-muted">Create a virtual conference room</p>
                  </div>
                </div>
                <button onClick={() => setIsMeeting(!isMeeting)} className={`w-12 h-6 rounded-full transition-all relative ${isMeeting ? "bg-accent" : "bg-white/10"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isMeeting ? "left-7" : "left-1"}`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 relative z-10">
              <button onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-white/10 text-ink-muted hover:text-white hover:bg-white/5 transition-all text-sm font-semibold">Cancel</button>
              <button onClick={handleCreate} className="bg-gradient-to-r from-accent to-purple-600 hover:opacity-90 text-white shadow-glow hover:shadow-accent/40 px-6 font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50" disabled={!draftTitle || !draftDate}>Create Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
