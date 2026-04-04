import { useState, FormEvent, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

/* ── Floating Orb component ── */
function FloatingOrb({ style }: { style: React.CSSProperties }) {
  return <div className="absolute rounded-full pointer-events-none" style={style} />;
}

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { login, register } = useAuthStore();

  /* ── Particle Canvas Background ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: { x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.opacity})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Something went wrong. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: "🧠", label: "RAG Knowledge Base", desc: "Search across all company data instantly" },
    { icon: "🤖", label: "Nova AI Assistant", desc: "Voice + chat AI powered by Groq & Ollama" },
    { icon: "🎙️", label: "Meeting Intelligence", desc: "Real-time transcription & action items" },
    { icon: "🔒", label: "End-to-End Secure", desc: "JWT auth, self-hosted, zero data leaks" },
  ];

  return (
    <div className="min-h-screen overflow-hidden relative flex" style={{ background: "rgb(7,7,9)" }}>
      {/* Animated particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Background radial glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <FloatingOrb style={{ top: "-15%", left: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
        <FloatingOrb style={{ bottom: "-20%", right: "-10%", width: "70vw", height: "70vw", background: "radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 70%)" }} />
        <FloatingOrb style={{ top: "40%", left: "35%", width: "30vw", height: "30vw", background: "radial-gradient(circle, rgba(16,163,127,0.06) 0%, transparent 70%)" }} />
      </div>

      {/* Left Panel — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="hidden lg:flex flex-col justify-between w-[52%] relative z-10 p-12"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" }}>N</div>
          <div>
            <p className="text-white font-bold text-lg tracking-tight leading-none">Nexus</p>
            <p className="text-purple-400 text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5">Workspace</p>
          </div>
        </div>

        {/* Hero Text */}
        <div className="space-y-6">
          <div>
            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              The AI-Powered<br />
              <span style={{ background: "linear-gradient(90deg, #8b5cf6, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Corporate OS
              </span>
            </h1>
            <p className="text-zinc-400 text-lg mt-4 leading-relaxed max-w-md">
              Everything your team needs — meetings, chats, tasks, and an AI that actually knows your company.
            </p>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            {features.map((f) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-3 p-4 rounded-2xl border"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{f.label}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer badges */}
        <div className="flex items-center gap-4 flex-wrap">
          {["Self-Hosted", "Open Source", "End-to-End AI", "GROQ Powered"].map((b) => (
            <span key={b} className="text-xs font-semibold text-zinc-500 border border-zinc-800 rounded-full px-3 py-1">
              {b}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" }}>N</div>
            <span className="text-white font-bold text-lg">Nexus Workspace</span>
          </div>

          {/* Card */}
          <div className="rounded-3xl p-8 border shadow-2xl"
            style={{ background: "rgba(18,18,22,0.85)", backdropFilter: "blur(40px)", borderColor: "rgba(255,255,255,0.07)" }}>

            {/* Header */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                {mode === "login" ? "Sign in to your workspace" : "Join your team on Nexus"}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-2xl p-1 mb-6 gap-1" style={{ background: "rgba(255,255,255,0.04)" }}>
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300"
                  style={{
                    background: mode === m ? "rgba(139,92,246,0.2)" : "transparent",
                    color: mode === m ? "#a78bfa" : "#71717a",
                    border: mode === m ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
                  }}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence>
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Full Name</label>
                    <input
                      className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      placeholder="Alex Johnson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    className="w-full rounded-2xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl px-4 py-3 text-sm font-medium"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
                  >
                    ⚠️ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm mt-2 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 4px 24px rgba(139,92,246,0.3)" }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {mode === "login" ? "Signing in…" : "Creating account…"}
                  </>
                ) : mode === "login" ? "Sign In →" : "Create Account →"}
              </motion.button>
            </form>

            <p className="text-center text-xs text-zinc-600 mt-6">
              By continuing you agree to our privacy policy · Self-hosted &amp; secure
            </p>
          </div>

          <p className="text-center text-xs text-zinc-700 mt-4">
            Nexus Workspace · AI-powered corporate ecosystem
          </p>
        </motion.div>
      </div>
    </div>
  );
}
