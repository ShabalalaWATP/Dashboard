import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MessageSquare, Send, X, Bot, Maximize2, Minimize2,
  Trash2, Copy, RotateCcw, AlertTriangle,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useData } from "../filters";
import { DynamicChart } from "./charts/DynamicChart";
import { MarkdownBody } from "./Markdown";
import { ProjectDetail } from "./ProjectDetail";
import type { Project } from "../types";

type Chart = {
  type: string;
  title: string;
  data: { label: string; value: number }[];
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  charts?: Chart[];
  chart_errors?: string[];
  error?: boolean;
};

const MIN_W = 420;
const MIN_H = 420;
const DEFAULT_W = 560;
const DEFAULT_H = 680;


export function ChatPanel() {
  const { user } = useAuth();
  const { allProjects: projects } = useData();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Project | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Probe LLM readiness on mount so the floating nudge can decide whether
  // to show. Re-probe on every open so settings changes are picked up.
  useEffect(() => {
    api.get<{ configured: boolean }>("/api/llm/status")
      .then((s) => setLlmReady(s.configured))
      .catch(() => setLlmReady(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api.get<{ suggestions: string[] }>("/api/llm/suggestions")
      .then((s) => setSuggestions(s.suggestions))
      .catch(() => setSuggestions([]));
  }, [open]);

  // Auto-scroll to bottom on new messages
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  const askRef = useRef<(text: string, overrideHistory?: Msg[]) => Promise<void>>();
  askRef.current = async (text: string, overrideHistory?: Msg[]) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const baseHistory = overrideHistory ?? msgs;
    const next: Msg[] = [...baseHistory, { role: "user", content: trimmed }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<{
        answer: string;
        charts: Chart[];
        chart_errors: string[];
        cited_project_ids: number[];
      }>("/api/llm/chat", {
        message: trimmed,
        history: next.slice(0, -1)
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs([...next, {
        role: "assistant",
        content: res.answer,
        charts: res.charts || [],
        chart_errors: res.chart_errors || [],
      }]);
    } catch (e: any) {
      setMsgs([...next, {
        role: "assistant",
        content: `**Assistant unavailable.**\n\n${e.message}\n\nCheck **Admin → LLM** settings or verify the endpoint is reachable.`,
        error: true,
      }]);
    } finally {
      setBusy(false);
    }
  };

  const ask = useCallback((text: string, overrideHistory?: Msg[]) => {
    return askRef.current!(text, overrideHistory);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await ask(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  function regenerate() {
    // Find the last user message, truncate to just before the following assistant reply, re-ask
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        const history = msgs.slice(0, i);
        const last = msgs[i].content;
        setMsgs(history);
        ask(last, history);
        return;
      }
    }
  }

  function clearThread() {
    if (msgs.length === 0) return;
    if (!confirm("Clear the current conversation?")) return;
    setMsgs([]);
  }

  if (!user) return null;

  // Resize (bottom-left corner drag). Simple pointer-events driven.
  function onResizeDown(e: React.PointerEvent) {
    if (fullscreen) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const move = (ev: PointerEvent) => {
      const dx = startX - ev.clientX;
      const dy = startY - ev.clientY;
      setSize({
        w: Math.max(MIN_W, Math.min(window.innerWidth - 32, startW + dx)),
        h: Math.max(MIN_H, Math.min(window.innerHeight - 32, startH + dy)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const panelStyle: React.CSSProperties = fullscreen
    ? { position: "fixed", inset: 16, zIndex: 50 }
    : {
        position: "fixed", right: 20, bottom: 20, zIndex: 50,
        width: size.w, height: size.h,
      };

  return (
    <>
      {!open && (
        <>
          <ChatNudge
            ready={llmReady}
            onOpen={() => setOpen(true)}
          />
          <button onClick={() => setOpen(true)}
                  aria-label="Open assistant"
                  className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full
                             bg-accent/20 hover:bg-accent/30 border border-accent/50 text-accent
                             flex items-center justify-center shadow-glow">
            <MessageSquare size={20} />
          </button>
        </>
      )}

      {open && (
        <div style={panelStyle} className="panel rounded-xl flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-accent" />
              <span className="text-sm font-semibold">Analytics Assistant</span>
              {!llmReady && (
                <span className="text-[10px] text-amber-400 font-mono border border-amber-400/30 px-1.5 py-0.5 rounded">
                  offline
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {msgs.some((m) => m.role === "user") && (
                <IconBtn onClick={regenerate} title="Regenerate last response" disabled={busy}>
                  <RotateCcw size={14}/>
                </IconBtn>
              )}
              {msgs.length > 0 && (
                <IconBtn onClick={clearThread} title="Clear conversation">
                  <Trash2 size={14}/>
                </IconBtn>
              )}
              <IconBtn onClick={() => setFullscreen((v) => !v)}
                       title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                {fullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
              </IconBtn>
              <IconBtn onClick={() => setOpen(false)} title="Close"><X size={14}/></IconBtn>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
            {msgs.length === 0 && (
              <EmptyState
                ready={llmReady}
                suggestions={suggestions}
                onPick={(s) => ask(s)}
              />
            )}
            {msgs.map((m, i) => (
              <MessageBubble key={i} msg={m} projects={projects}
                             onCite={(p) => setViewing(p)} />
            ))}
            {busy && <ThinkingBubble />}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form onSubmit={submit} className="border-t border-white/5 p-3 flex gap-2 items-end flex-shrink-0">
            <textarea ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder={llmReady ? "Ask about the portfolio…  (Enter to send, Shift+Enter for newline)" : "Assistant offline — configure in Admin → LLM"}
                      disabled={busy || !llmReady}
                      rows={1}
                      className="flex-1 bg-bg0 border border-white/10 rounded-md px-3 py-2 text-sm outline-none
                                 focus:border-accent/50 resize-none disabled:opacity-50"
                      style={{ maxHeight: 140 }} />
            <button disabled={busy || !llmReady || !input.trim()}
                    aria-label="Send"
                    className="px-3 py-2 rounded-md bg-accent/20 border border-accent/50 text-accent
                               hover:bg-accent/30 disabled:opacity-40 flex-shrink-0">
              <Send size={14} />
            </button>
          </form>

          {/* Resize handle (top-left corner) */}
          {!fullscreen && (
            <div
              onPointerDown={onResizeDown}
              className="absolute top-0 left-0 h-5 w-5 cursor-nwse-resize group"
              title="Drag to resize"
            >
              <div className="absolute top-1 left-1 h-2 w-2 border-l border-t border-white/25 group-hover:border-accent" />
            </div>
          )}
        </div>
      )}

      {viewing && <ProjectDetail project={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}


/** Floating promo bubble above the chat button. Appears 2.5s after mount if
 *  the LLM is configured and the user hasn't dismissed it this session.
 *  Click anywhere on the card to open the chat. */
function ChatNudge({ ready, onOpen }: { ready: boolean; onOpen: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("chat_nudge_dismissed") === "1") return;
    const t = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setVisible(false);
    try { sessionStorage.setItem("chat_nudge_dismissed", "1"); } catch { /* ignore */ }
  }

  return (
    <div className="fixed bottom-20 right-5 z-40 w-[280px] animate-[nudge-in_420ms_ease-out]">
      <button onClick={onOpen}
              className="w-full text-left panel-solid rounded-lg px-3.5 py-3 pr-9
                         hover:border-accent/60 transition-colors relative
                         shadow-[0_8px_24px_rgba(0,0,0,0.55)] group">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent mb-1.5 flex items-center gap-1.5">
          <Bot size={10}/> Analyst
        </div>
        <div className="text-[13px] text-slate-100 font-medium leading-snug">
          Need a hand exploring the portfolio?
        </div>
        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
          Ask the analyst — it can pull insights across every project, stage, and outcome.
        </div>
        <div className="text-[10px] mono text-accent/70 mt-2 group-hover:text-accent">
          click to start →
        </div>
      </button>
      <button onClick={dismiss}
              aria-label="Dismiss"
              className="absolute top-2 right-2 h-5 w-5 rounded flex items-center justify-center
                         text-slate-500 hover:text-slate-200 hover:bg-white/5">
        <X size={11} />
      </button>
      {/* tiny tail pointing at the chat button below */}
      <div className="absolute -bottom-1 right-6 w-2.5 h-2.5 rotate-45
                      bg-[#0d1014] border-r border-b border-white/10" />

      <style>{`
        @keyframes nudge-in {
          from { opacity: 0; transform: translateY(12px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}


function IconBtn({ children, title, onClick, disabled }: {
  children: React.ReactNode; title?: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
            className="h-7 w-7 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200
                       disabled:opacity-30 flex items-center justify-center">
      {children}
    </button>
  );
}


function EmptyState({ ready, suggestions, onPick }: {
  ready: boolean; suggestions: string[]; onPick: (s: string) => void;
}) {
  if (!ready) {
    return (
      <div className="text-center text-xs text-slate-500 mt-10 px-6">
        <Bot size={28} className="mx-auto mb-3 text-slate-600" />
        The assistant isn't configured yet.<br />
        An admin can enable it in <span className="text-slate-300">Admin → LLM</span>.
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs text-slate-400">
        Ask anything about the portfolio. Some starters:
      </div>
      <div className="flex flex-col gap-2">
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onPick(s)}
                  className="text-left text-xs px-3 py-2 rounded-md
                             bg-white/[0.02] hover:bg-accent/10 border border-white/10
                             hover:border-accent/40 text-slate-300 hover:text-slate-100
                             transition-colors">
            {s}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-600 mt-4 mono">
        TIP: the assistant cites projects as chips — click one to open its details.
      </div>
    </div>
  );
}


function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-400 mono">
        <span className="inline-flex gap-1">
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0ms" }} />
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: "150ms" }} />
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: "300ms" }} />
        </span>
        <span className="ml-2">thinking</span>
      </div>
    </div>
  );
}


function MessageBubble({ msg, projects, onCite }: {
  msg: Msg; projects: Project[]; onCite: (p: Project) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore */ }
  }

  // Derive referenced projects so we can surface them under the message even
  // if the model phrased citations inline.
  const cited = useMemo(() => {
    const ids = new Set<number>();
    const re = /\[\[(\d+)\]\]/g;
    let m;
    while ((m = re.exec(msg.content))) ids.add(Number(m[1]));
    return projects.filter((p) => ids.has(p.id));
  }, [msg.content, projects]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] rounded-lg px-3 py-2 relative group
        ${isUser
          ? "bg-accent/15 border border-accent/30 text-slate-100"
          : msg.error
            ? "bg-red-500/5 border border-red-500/30"
            : "bg-white/[0.03] border border-white/10"}`}>
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        ) : (
          <>
            <MarkdownBody text={msg.content} projects={projects} onCite={onCite} />

            {msg.chart_errors && msg.chart_errors.length > 0 && (
              <div className="mt-2 text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20
                              rounded-md p-2 flex gap-2">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <div className="mono">
                  Some chart data from the model couldn't be rendered:
                  <ul className="mt-1 list-disc pl-4">
                    {msg.chart_errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {msg.charts && msg.charts.length > 0 && (
              <div className="mt-2 grid grid-cols-1 gap-2">
                {msg.charts.map((c, idx) => <DynamicChart key={idx} chart={c} />)}
              </div>
            )}

            {cited.length > 0 && (
              <div className="mt-3 pt-2 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                  Referenced
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cited.map((p) => (
                    <button key={p.id} onClick={() => onCite(p)}
                            className="text-[10px] mono px-2 py-0.5 rounded
                                       bg-accent/10 border border-accent/30 text-accent
                                       hover:bg-accent/20">
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={copy}
                    title={copied ? "Copied" : "Copy"}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100
                               transition-opacity h-6 w-6 rounded flex items-center justify-center
                               text-slate-500 hover:text-slate-200 hover:bg-white/5">
              <Copy size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
