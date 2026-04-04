import { create } from "zustand";
import { api } from "@/lib/api";

export interface DailyActivity {
  date: string;
  count: number;
}

export interface PerformanceStats {
  tasks_done: number;
  tasks_pending: number;
  meetings_attended: number;
  completion_rate: number;
  daily_activity: DailyActivity[];
}

interface PerformanceState {
  stats: PerformanceStats | null;
  fetchStats: () => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>()((set) => ({
  stats: null,

  fetchStats: async () => {
    const { data } = await api.get<PerformanceStats>("/performance/me");
    set({ stats: data });
  }
}));
