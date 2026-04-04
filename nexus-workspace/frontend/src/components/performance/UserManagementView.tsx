import { useEffect, useState } from "react";
import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import { Users, Mail, Shield, Calendar as CalendarIcon, MoreVertical } from "lucide-react";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export function UserManagementView() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get("http://localhost:8000/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const updateRole = async (userId: string, newRole: string) => {
    try {
      await axios.patch(`http://localhost:8000/users/${userId}`, 
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      alert("Permission denied: Admin credentials required.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p className="text-sm font-medium text-ink-muted">Accessing Directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-10 bg-transparent overflow-y-auto no-scrollbar">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/20">
                <Users size={24} />
              </div>
              <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">Personnel Management</span>
            </div>
            <h1 className="text-5xl font-black text-ink-primary tracking-tight">
              Employee <span className="text-gradient">Directory</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 p-2 rounded-2xl">
            <div className="px-4 py-2">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Total Staff</p>
              <p className="text-xl font-bold text-ink-primary">{users.length}</p>
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-8 py-5 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">Employee</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">Contact</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">Privileges</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">Registration</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em] text-right">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/20 flex items-center justify-center text-accent font-black text-lg shadow-inner">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-ink-primary text-base">{u.name}</p>
                          <p className="text-[10px] text-ink-muted font-medium uppercase tracking-wider">Active Status</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-ink-secondary text-sm font-medium">
                          <Mail size={14} className="opacity-40" />
                          {u.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className={u.role === 'admin' ? 'text-accent' : 'text-ink-muted'} />
                        <span className={u.role === 'admin' ? 'badge-info' : 'badge-ok bg-white/5 text-ink-muted border-white/10'}>
                          {u.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-ink-muted text-sm">
                        <CalendarIcon size={14} className="opacity-40" />
                        {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <select 
                        className="bg-black/40 border border-white/5 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:border-accent hover:bg-black/60 transition-all cursor-pointer text-ink-secondary"
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                      >
                        <option value="user">USER</option>
                        <option value="admin">ADMIN</option>
                        <option value="hr">HR MANAGER</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {users.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-center px-10">
              <div className="w-20 h-20 bg-white/[0.03] rounded-[2rem] flex items-center justify-center mb-6 border border-white/5">
                <Users size={32} className="text-ink-muted opacity-20" />
              </div>
              <h3 className="text-xl font-bold text-ink-primary mb-2">Workspace Empty</h3>
              <p className="text-sm text-ink-muted max-w-xs">No employee records currently synchronized with the central database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
