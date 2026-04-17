import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../auth";
import { useEscape } from "../hooks";

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  useEscape(onClose);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(u, p);
      onClose();
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="panel rounded-xl p-6 w-[360px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider">Admin Sign In</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <label className="block text-xs text-slate-400 mb-1">Username</label>
        <input autoFocus value={u} onChange={(e) => setU(e.target.value)}
               className="w-full mb-3 bg-bg0 border border-white/10 rounded-md px-3 py-2 text-sm
                          focus:border-accent/50 outline-none" />
        <label className="block text-xs text-slate-400 mb-1">Password</label>
        <input type="password" value={p} onChange={(e) => setP(e.target.value)}
               className="w-full mb-4 bg-bg0 border border-white/10 rounded-md px-3 py-2 text-sm
                          focus:border-accent/50 outline-none" />
        {err && <div className="text-xs text-red-400 mb-3">{err}</div>}
        <button disabled={busy}
                className="w-full bg-accent/20 hover:bg-accent/30 border border-accent/50
                           text-accent rounded-md py-2 text-sm font-semibold disabled:opacity-50">
          {busy ? "..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
