import { create } from "zustand";
import { api } from "@/lib/api";

export interface Todo {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  is_done: boolean;
  priority: string;
  source: string;
  completed_at?: string;
  created_at: string;
}

interface TodoState {
  todos: Todo[];
  isSummarising: boolean;
  fetchTodos: () => Promise<void>;
  createTodo: (title: string, priority?: string, due_date?: string) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  summariseTodos: () => Promise<void>;
}

export const useTodoStore = create<TodoState>()((set, get) => ({
  todos: [],
  isSummarising: false,

  fetchTodos: async () => {
    const { data } = await api.get<Todo[]>("/todos");
    set({ todos: data });
  },

  createTodo: async (title, priority = "medium", due_date) => {
    await api.post("/todos", { title, priority, due_date });
    await get().fetchTodos();
  },

  updateTodo: async (id, updates) => {
    await api.patch(`/todos/${id}`, updates);
    await get().fetchTodos();
  },

  deleteTodo: async (id) => {
    await api.delete(`/todos/${id}`);
    await get().fetchTodos();
  },

  summariseTodos: async () => {
    set({ isSummarising: true });
    try {
      await api.post("/todos/summarise");
      await get().fetchTodos();
    } finally {
      set({ isSummarising: false });
    }
  }
}));
