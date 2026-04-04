import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { AuthPage } from "@/components/layout/AuthPage";
import { AppShell } from "@/components/layout/AppShell";

export default function App() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  if (!user || !token) return <AuthPage />;
  return <AppShell />;
}
