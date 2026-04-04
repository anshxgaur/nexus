import { useEffect } from "react";
import { usePerformanceStore } from "@/stores/performanceStore";

export function PerformanceView() {
  const { stats, fetchStats } = usePerformanceStore();

  useEffect(() => {
    fetchStats();
  }, []);

  if (!stats) return <div className="p-8 flex items-center justify-center h-full text-ink-muted">Loading stats...</div>;

  const maxVal = Math.max(...stats.daily_activity.map(a => a.count), 1);

  return (
    <div className="flex-1 flex flex-col p-8 bg-transparent overflow-y-auto relative">
      <div className="absolute top-1/4 left-1/2 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2" />
      <div className="max-w-5xl mx-auto w-full relative z-10">
        <h1 className="text-4xl font-extrabold text-ink-primary mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-ink-muted">Performance Dashboard</h1>
        <p className="text-sm font-bold text-ink-muted mb-10 tracking-widest uppercase">Track your productivity and engagement</p>

        {/* Hero Stats */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          <StatCard title="Tasks Done" value={stats.tasks_done.toString()} color="text-emerald-500" bg="bg-emerald-500/10" icon="✅" />
          <StatCard title="Tasks Pending" value={stats.tasks_pending.toString()} color="text-amber-500" bg="bg-amber-500/10" icon="⏳" />
          <StatCard title="Completion Rate" value={`${stats.completion_rate}%`} color="text-accent" bg="bg-accent/10" icon="📈" />
          <StatCard title="Meetings Attended" value={stats.meetings_attended.toString()} color="text-blue-500" bg="bg-blue-500/10" icon="🎥" />
        </div>

        {/* Chart */}
        <div className="p-8 bg-black/30 backdrop-blur-xl border border-white/5 rounded-[2rem] shadow-glass relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
          <h3 className="text-xl font-bold text-ink-primary mb-8 tracking-tight relative z-10">Activity (Last 7 Days)</h3>
          <div className="h-64 flex items-end justify-between gap-4 px-4">
            {stats.daily_activity.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-ink-muted">
                <span className="text-4xl mb-4 opacity-50">📊</span>
                <span className="text-sm font-medium">Not enough data to display chart. Complete some tasks!</span>
              </div>
            ) : (
              stats.daily_activity.map((day, i) => {
                const height = `${(day.count / maxVal) * 100}%`;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end relative z-10">
                    <div className="w-full max-w-[60px] bg-white/5 rounded-t-2xl relative flex items-end justify-center transition-all h-full mx-auto shadow-inner border border-white/5 border-b-0 overflow-hidden">
                      <div className="w-full rounded-t-2xl bg-gradient-to-t from-accent to-purple-500 transition-all duration-700 ease-out group-hover:opacity-90 relative shadow-glow" style={{ height }}>
                        <div className="absolute inset-x-0 top-0 h-1 bg-white/40 rounded-t-2xl"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <span className="absolute -top-12 text-sm font-bold text-white opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/10 shadow-glass z-10">{day.count}</span>
                    </div>
                    <span className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color, bg, icon }: { title: string; value: string; color: string; bg: string; icon: string }) {
  return (
    <div className="p-6 bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl shadow-glass hover:shadow-lg hover:border-white/10 hover:bg-black/30 transition-all hover:scale-[1.02] relative overflow-hidden group">
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none ${bg.replace('/10', '')}`} />
      <div className="flex gap-4 justify-between items-start mb-6 relative z-10">
        <span className="text-ink-muted text-xs font-bold tracking-widest uppercase">{title}</span>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/5 ${bg} ${color}`}>
          {icon}
        </div>
      </div>
      <div className={`text-5xl font-black tracking-tighter ${color} drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] relative z-10`}>{value}</div>
    </div>
  );
}
