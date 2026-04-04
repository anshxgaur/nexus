import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        set({
          token: data.access_token,
          user: { id: data.user_id, name: data.name, email: data.email },
        });
      },

      register: async (name, email, password) => {
        const { data } = await api.post("/auth/register", { name, email, password });
        set({
          token: data.access_token,
          user: { id: data.user_id, name: data.name, email: data.email },
        });
      },

      logout: () => set({ user: null, token: null }),
    }),
    { name: "nexus-auth" }
  )
);
