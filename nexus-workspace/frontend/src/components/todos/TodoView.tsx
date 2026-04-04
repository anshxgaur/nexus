import { useEffect, useState } from "react";
import { useTodoStore, Todo } from "@/stores/todoStore";

export function TodoView() {
  const { todos, isSummarising, fetchTodos, createTodo, updateTodo, deleteTodo, summariseTodos } = useTodoStore();
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPriority, setDraftPriority] = useState("medium");

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    await createTodo(draftTitle, draftPriority);
    setDraftTitle("");
    setDraftPriority("medium");
  };

  const pending = todos.filter((t) => !t.is_done);
  const done = todos.filter((t) => t.is_done);

  return (
    <div className="p-8 w-full h-full flex flex-col items-center bg-transparent overflow-y-auto">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-ink-primary tracking-tight">My Day</h1>
            <p className="text-sm font-medium text-ink-secondary mt-1 tracking-widest uppercase">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <button 
            onClick={summariseTodos} 
            disabled={isSummarising}
            className="flex items-center gap-2 bg-gradient-to-r from-accent to-purple-600 hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:shadow-lg hover:shadow-accent/25 disabled:opacity-50 tracking-wide"
          >
            {isSummarising ? "✨ Summarising..." : "✨ Extract from Chats"}
          </button>
        </div>

        {/* Add Task Form */}
        <form onSubmit={handleAdd} className="flex gap-2 p-2 bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl mb-10 shadow-glass focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 transition-all group">
          <div className="w-4 h-4 rounded-full border-2 border-white/20 ml-3 self-center group-focus-within:border-accent transition-colors" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none text-base font-medium text-ink-primary placeholder:text-ink-muted outline-none px-3"
            placeholder="Add a new task..."
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
          <select 
            className="bg-black/50 border border-white/10 text-xs font-semibold uppercase text-ink-secondary rounded-xl px-3 py-1 outline-none cursor-pointer focus:border-accent/50 transition-colors"
            value={draftPriority}
            onChange={(e) => setDraftPriority(e.target.value)}
          >
            <option value="low">LOW</option>
            <option value="medium">MED</option>
            <option value="high">HIGH</option>
          </select>
          <button type="submit" className="bg-accent/20 hover:bg-accent text-accent hover:text-white font-bold text-sm px-6 py-2 rounded-xl transition-all ml-1 shadow-glow hover:shadow-accent/40 active:scale-95">
            Add
          </button>
        </form>

        {/* Pending Tasks */}
        <div className="space-y-3 mb-10">
          {pending.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={() => updateTodo(t.id, { is_done: true })} onDelete={() => deleteTodo(t.id)} />
          ))}
          {pending.length === 0 && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-glass relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-[50px] pointer-events-none" />
              <span className="text-4xl mb-4 animate-bounce">🎉</span>
              <p className="text-xl font-bold text-ink-primary mb-1 text-transparent bg-clip-text bg-gradient-to-r from-white to-ink-muted">You're all caught up!</p>
              <p className="text-sm text-ink-muted">No pending tasks for today.</p>
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        {done.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-4 px-1">Completed ({done.length})</h3>
            <div className="space-y-2 opacity-50 hover:opacity-100 transition-opacity">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => updateTodo(t.id, { is_done: false })} onDelete={() => deleteTodo(t.id)} isDone />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, isDone = false }: { task: Todo; onToggle: () => void; onDelete: () => void; isDone?: boolean }) {
  const pColors: Record<string, string> = { low: "bg-info/10 text-info border-info/20", medium: "bg-warn/10 text-warn border-warn/20", high: "bg-err/10 text-err border-err/20" };
  const sColors: Record<string, string> = { manual: "bg-white/5 text-ink-muted border-white/10", ai_summary: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
  
  return (
    <div className={`group flex items-center justify-between p-4 bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl transition-all shadow-glass hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] ${isDone ? "opacity-50" : "hover:border-accent/40"}`}>
      <div className="flex items-center gap-4">
        <button onClick={onToggle} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isDone ? "bg-accent border-accent text-white scale-95" : "border-white/20 hover:border-accent"}`}>
          {isDone && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
        </button>
        <span className={`text-base tracking-tight ${isDone ? "text-ink-muted line-through" : "text-ink-primary font-medium"}`}>
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded block border ${sColors[task.source] || sColors.manual}`}>{task.source === "ai_summary" ? "AI Extracted" : task.source}</span>
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded block border ${pColors[task.priority] || pColors.medium}`}>{task.priority}</span>
        <button onClick={onDelete} className="text-ink-muted hover:text-err hover:bg-err/10 transition-colors w-8 h-8 rounded-lg flex items-center justify-center text-xl pb-1 opacity-0 group-hover:opacity-100 focus:opacity-100">×</button>
      </div>
    </div>
  );
}
