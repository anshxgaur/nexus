import { create } from "zustand";
import { api, WS_URL } from "@/lib/api";
import { useAuthStore } from "./authStore";

export interface Meeting {
  id: string;
  title: string;
  room_name: string;
  status: "scheduled" | "active" | "ended";
  created_by: string;
  summary: string | null;
  created_at: string;
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker: string | null;
  text: string;
  start_time: number | null;
  end_time: number | null;
  confidence: number | null;
  created_at: string;
}

interface MeetingState {
  meetings: Meeting[];
  activeMeeting: Meeting | null;
  liveKitToken: string | null;
  liveKitUrl: string | null;
  transcripts: Record<string, TranscriptSegment[]>;
  transcriptWs: WebSocket | null;

  fetchMeetings: () => Promise<void>;
  createMeeting: (title: string) => Promise<Meeting>;
  joinMeeting: (meetingId: string) => Promise<void>;
  endMeeting: (meetingId: string) => Promise<void>;
  fetchTranscripts: (meetingId: string) => Promise<void>;
  connectTranscriptWS: (meetingId: string) => void;
  disconnectTranscriptWS: () => void;
  setActiveMeeting: (m: Meeting | null) => void;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  activeMeeting: null,
  liveKitToken: null,
  liveKitUrl: null,
  transcripts: {},
  transcriptWs: null,

  fetchMeetings: async () => {
    const { data } = await api.get<Meeting[]>("/meetings");
    set({ meetings: data });
  },

  createMeeting: async (title) => {
    const { data } = await api.post<Meeting>("/meetings", { title });
    set((s) => ({ meetings: [data, ...s.meetings] }));
    return data;
  },

  joinMeeting: async (meetingId) => {
    const { data } = await api.post(`/meetings/${meetingId}/join`);
    set({
      activeMeeting: data.meeting,
      liveKitToken: data.livekit_token,
      liveKitUrl: data.livekit_url,
    });
    get().connectTranscriptWS(meetingId);
  },

  endMeeting: async (meetingId) => {
    await api.post(`/meetings/${meetingId}/end`);
    get().disconnectTranscriptWS();
    set({ activeMeeting: null, liveKitToken: null });
    get().fetchMeetings();
  },

  fetchTranscripts: async (meetingId) => {
    const { data } = await api.get<TranscriptSegment[]>(`/transcripts/${meetingId}`);
    set((s) => ({ transcripts: { ...s.transcripts, [meetingId]: data } }));
  },

  connectTranscriptWS: (meetingId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const socket = new WebSocket(
      `${WS_URL}/ws/meeting/${meetingId}/transcript?token=${token}`
    );
    let ping: ReturnType<typeof setInterval>;

    socket.onopen = () => {
      ping = setInterval(() => socket.readyState === 1 && socket.send("ping"), 25_000);
    };

    socket.onmessage = (e) => {
      if (e.data === "pong") return;
      try {
        const seg = JSON.parse(e.data);
        if (seg.type !== "transcript") return;
        set((s) => {
          const prev = s.transcripts[meetingId] ?? [];
          return { transcripts: { ...s.transcripts, [meetingId]: [...prev, seg] } };
        });
      } catch {}
    };

    socket.onclose = () => clearInterval(ping);
    set({ transcriptWs: socket });
  },

  disconnectTranscriptWS: () => {
    get().transcriptWs?.close();
    set({ transcriptWs: null });
  },

  setActiveMeeting: (m) => set({ activeMeeting: m }),
}));
