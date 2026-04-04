import { create } from "zustand";
import { api } from "@/lib/api";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_dt: string;
  end_dt: string;
  color: string;
  all_day: boolean;
  created_at: string;
}

interface CalendarState {
  events: CalendarEvent[];
  fetchEvents: (start?: string, end?: string) => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, "id" | "created_at">) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  events: [],

  fetchEvents: async (start, end) => {
    const params = new URLSearchParams();
    if (start) params.append("start_dt", start);
    if (end) params.append("end_dt", end);
    const { data } = await api.get<CalendarEvent[]>(`/calendar/events?${params.toString()}`);
    set({ events: data });
  },

  createEvent: async (event) => {
    await api.post("/calendar/events", event);
    await get().fetchEvents();
  },

  updateEvent: async (id, updates) => {
    await api.patch(`/calendar/events/${id}`, updates);
    await get().fetchEvents();
  },

  deleteEvent: async (id) => {
    await api.delete(`/calendar/events/${id}`);
    await get().fetchEvents();
  }
}));
