import { create } from "zustand";
import { api, WS_URL } from "@/lib/api";
import { useAuthStore } from "./authStore";

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  text: string;
  is_ai: boolean;
  thread_id: string | null;
  created_at: string;
  user?: { id: string; name: string; avatar_url: string | null };
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
}

interface ChatState {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>; // channelId → messages
  ws: WebSocket | null;

  fetchChannels: () => Promise<void>;
  setActiveChannel: (id: string) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  connectWS: (channelId: string) => void;
  disconnectWS: () => void;
  createChannel: (name: string, description?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  messages: {},
  ws: null,

  fetchChannels: async () => {
    const { data } = await api.get<Channel[]>("/channels");
    set({ channels: data });
  },

  setActiveChannel: (id) => {
    const { disconnectWS, connectWS, fetchMessages } = get();
    disconnectWS();
    set({ activeChannelId: id });
    fetchMessages(id);
    connectWS(id);
  },

  fetchMessages: async (channelId) => {
    const { data } = await api.get<Message[]>(`/messages/${channelId}`);
    set((s) => ({ messages: { ...s.messages, [channelId]: data } }));
  },

  sendMessage: async (text) => {
    const { activeChannelId } = get();
    if (!activeChannelId) return;
    await api.post("/messages", { channel_id: activeChannelId, text });
    // Message arrives via WebSocket
  },

  connectWS: (channelId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const socket = new WebSocket(`${WS_URL}/ws/chat/${channelId}?token=${token}`);
    let pingInterval: ReturnType<typeof setInterval>;

    socket.onopen = () => {
      pingInterval = setInterval(() => socket.readyState === 1 && socket.send("ping"), 25_000);
    };

    socket.onmessage = (e) => {
      if (e.data === "pong") return;
      try {
        const msg: Message = JSON.parse(e.data);
        if (msg.type !== "message") return;
        set((s) => {
          const prev = s.messages[channelId] ?? [];
          // Deduplicate
          if (prev.some((m) => m.id === msg.id)) return s;
          return { messages: { ...s.messages, [channelId]: [...prev, msg] } };
        });
      } catch {}
    };

    socket.onclose = () => clearInterval(pingInterval);
    set({ ws: socket });
  },

  disconnectWS: () => {
    const { ws } = get();
    ws?.close();
    set({ ws: null });
  },

  createChannel: async (name, description) => {
    const { data } = await api.post<Channel>("/channels", { name, description });
    set((s) => ({ channels: [...s.channels, data] }));
  },
}));
