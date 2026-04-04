import { create } from "zustand";
import { api } from "@/lib/api";

export interface UserPreview {
  id: string;
  name: string;
}

export interface Mail {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
  sender?: UserPreview;
  recipient?: UserPreview;
}

interface MailState {
  inbox: Mail[];
  sent: Mail[];
  users: UserPreview[];
  fetchInbox: () => Promise<void>;
  fetchSent: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  sendMail: (recipient_id: string, subject: string, body: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  deleteMail: (id: string) => Promise<void>;
}

export const useMailStore = create<MailState>()((set, get) => ({
  inbox: [],
  sent: [],
  users: [],

  fetchInbox: async () => {
    const { data } = await api.get<Mail[]>("/mail/inbox");
    set({ inbox: data });
  },

  fetchSent: async () => {
    const { data } = await api.get<Mail[]>("/mail/sent");
    set({ sent: data });
  },

  fetchUsers: async () => {
    const { data } = await api.get<UserPreview[]>("/mail/users");
    set({ users: data });
  },

  sendMail: async (recipient_id, subject, body) => {
    await api.post("/mail/send", { recipient_id, subject, body });
    await get().fetchSent();
  },

  markAsRead: async (id) => {
    await api.patch(`/mail/${id}/read`);
    await get().fetchInbox();
  },

  deleteMail: async (id) => {
    await api.delete(`/mail/${id}`);
    await get().fetchInbox();
  }
}));
