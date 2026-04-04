import { create } from "zustand";
import { persist } from "zustand/middleware";
import { streamNova, getNovaStatus, type AISource, type NovaStatus } from "@/lib/novaRouter";

export interface NovaMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  streaming?: boolean;
  image?: string;
  timestamp: number;
}

export interface NovaConversation {
  id: string;
  label: string;
  messages: NovaMessage[];
  createdAt: number;
}

interface NovaState {
  conversations: NovaConversation[];
  activeId: string | null;
  generating: boolean;
  novaStatus: NovaStatus | null;
  statusChecking: boolean;

  // Actions
  initConversation: () => string;
  setActiveId: (id: string) => void;
  sendMessage: (text: string, image?: string) => Promise<void>;
  newConversation: () => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;
  checkStatus: () => Promise<void>;
  getActive: () => NovaConversation | null;
}

const uid = () => crypto.randomUUID();

export const useNovaStore = create<NovaState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      generating: false,
      novaStatus: null,
      statusChecking: false,

      getActive: () => {
        const { conversations, activeId } = get();
        return conversations.find((c) => c.id === activeId) ?? null;
      },

      initConversation: () => {
        const id = uid();
        const conv: NovaConversation = {
          id,
          label: "New conversation",
          messages: [],
          createdAt: Date.now(),
        };
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: id }));
        return id;
      },

      newConversation: () => {
        get().initConversation();
      },

      setActiveId: (id) => set({ activeId: id }),

      deleteConversation: (id) => {
        set((s) => {
          const filtered = s.conversations.filter((c) => c.id !== id);
          const newActiveId =
            s.activeId === id ? (filtered[0]?.id ?? null) : s.activeId;
          return { conversations: filtered, activeId: newActiveId };
        });
      },

      clearAll: () => set({ conversations: [], activeId: null }),

      checkStatus: async () => {
        set({ statusChecking: true });
        try {
          const status = await getNovaStatus();
          set({ novaStatus: status });
        } finally {
          set({ statusChecking: false });
        }
      },

      sendMessage: async (text: string, image?: string) => {
        const { conversations, activeId, generating } = get();
        if (generating) return;

        let convId = activeId;
        if (!convId || !conversations.find((c) => c.id === convId)) {
          convId = get().initConversation();
        }

        const userMsgId = uid();
        const assistantMsgId = uid();

        const userMsg: NovaMessage = {
          id: userMsgId,
          role: "user",
          text,
          image,
          timestamp: Date.now(),
        };
        const assistantMsg: NovaMessage = {
          id: assistantMsgId,
          role: "assistant",
          text: "",
          streaming: true,
          timestamp: Date.now(),
        };

        // Add messages and update label if first
        set((s) => ({
          generating: true,
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c;
            const isFirst = c.messages.length === 0;
            return {
              ...c,
              label: isFirst ? text.slice(0, 45) + (text.length > 45 ? "…" : "") : c.label,
              messages: [...c.messages, userMsg, assistantMsg],
            };
          }),
        }));

        try {
          const conv = get().conversations.find((c) => c.id === convId)!;
          const history = conv.messages
            .filter((m) => m.id !== assistantMsgId)
            .map((m) => ({ role: m.role, content: m.text, image: m.image }));

          for await (const chunk of streamNova(history)) {
            set((s) => ({
              conversations: s.conversations.map((c) => {
                if (c.id !== convId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, text: m.text + chunk } : m
                  ),
                };
              }),
            }));
          }
        } catch (err: any) {
          set((s) => ({
            conversations: s.conversations.map((c) => {
              if (c.id !== convId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, text: `Error: ${err?.message ?? "Unknown error"}`, streaming: false }
                    : m
                ),
              };
            }),
          }));
        } finally {
          set((s) => ({
            generating: false,
            conversations: s.conversations.map((c) => {
              if (c.id !== convId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, streaming: false } : m
                ),
              };
            }),
          }));
        }
      },
    }),
    { name: "nexus-nova-store", partialize: (s) => ({ conversations: s.conversations, activeId: s.activeId }) }
  )
);
