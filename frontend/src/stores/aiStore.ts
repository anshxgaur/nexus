import { create } from "zustand";
import { api } from "@/lib/api";

export interface SearchResult {
  text: string;
  source: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface AIState {
  searching: boolean;
  searchResults: SearchResult[];
  searchAnswer: string;
  lastQuery: string;

  summarizing: boolean;
  lastSummary: { summary: string; tasks: string[]; decisions: string[] } | null;

  search: (query: string) => Promise<void>;
  summarizeMeeting: (meetingId: string, style?: string) => Promise<void>;
  extractFromText: (text: string) => Promise<{ tasks: string[]; decisions: string[]; key_points: string[] }>;
  clearSearch: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  searching: false,
  searchResults: [],
  searchAnswer: "",
  lastQuery: "",

  summarizing: false,
  lastSummary: null,

  search: async (query) => {
    set({ searching: true, lastQuery: query, searchResults: [], searchAnswer: "" });
    try {
      const { data } = await api.post("/ai/search", {
        query,
        collections: ["chat_messages", "transcripts", "documents"],
        limit: 10,
        score_threshold: 0.25,
      });
      set({ searchResults: data.results, searchAnswer: data.answer });
    } finally {
      set({ searching: false });
    }
  },

  summarizeMeeting: async (meetingId, style = "bullet") => {
    set({ summarizing: true, lastSummary: null });
    try {
      const { data } = await api.post("/ai/summarize", { meeting_id: meetingId, style });
      set({ lastSummary: data });
    } finally {
      set({ summarizing: false });
    }
  },

  extractFromText: async (text) => {
    const { data } = await api.post("/ai/extract", { text });
    return data;
  },

  clearSearch: () =>
    set({ searchResults: [], searchAnswer: "", lastQuery: "" }),
}));
