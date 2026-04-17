import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { useData } from "../filters";
import { useEscape } from "../hooks";
import type { Project } from "../types";


export function useSearchPaletteHotkey(open: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}


export function SearchPalette({ onClose, onOpenProject }: {
  onClose: () => void;
  onOpenProject: (id: number) => void;
}) {
  useEscape(onClose);
  const { allProjects } = useData();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => scoreProjects(allProjects, q).slice(0, 20), [allProjects, q]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    // scroll focused item into view
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && results[idx]) {
      e.preventDefault();
      onOpenProject(results[idx].p.id);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-4"
         onClick={onClose}>
      <div className="panel rounded-xl w-[640px] max-h-[70vh] overflow-hidden flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <Search size={16} className="text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                 onKeyDown={onKeyDown}
                 placeholder="Search projects, vendors, tools, tags, leads…"
                 className="flex-1 bg-transparent outline-none text-sm" />
          <span className="text-[10px] text-slate-500 mono border border-white/10 rounded px-1.5 py-0.5">
            Esc to close
          </span>
        </div>
        <div ref={listRef} className="flex-1 overflow-auto">
          {results.length === 0 ? (
            <div className="text-xs text-slate-500 mono py-10 text-center">
              {q ? "no matches" : "start typing to search"}
            </div>
          ) : (
            <div className="py-1">
              {results.map((r, i) => (
                <button key={r.p.id} data-i={i}
                        onMouseEnter={() => setIdx(i)}
                        onClick={() => { onOpenProject(r.p.id); onClose(); }}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3
                          ${i === idx ? "bg-accent/10" : "hover:bg-white/[0.02]"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="mono text-sm text-slate-100 truncate">
                      {r.p.name}
                      <span className="text-slate-500 ml-2 text-xs">
                        {r.p.project_type} · {r.p.campaign_hub}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {r.snippet}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex-shrink-0
                    ${r.p.status === "open"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-500/15 text-slate-400 border border-slate-500/30"}`}>
                    {r.p.status}
                  </span>
                  {i === idx && <CornerDownLeft size={12} className="text-accent flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-white/5 text-[10px] text-slate-500 mono flex gap-4">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}


type Scored = { p: Project; score: number; snippet: string };

function scoreProjects(projects: Project[], q: string): Scored[] {
  const query = q.trim().toLowerCase();
  if (!query) {
    return projects
      .slice()
      .sort((a, b) => (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date))
      .map((p) => ({ p, score: 1, snippet: snippetFor(p) }));
  }
  const scored: Scored[] = [];
  for (const p of projects) {
    const fields: [string, number][] = [
      [p.name.toLowerCase(), 10],
      [p.project_type.toLowerCase(), 3],
      [p.campaign_hub.toLowerCase(), 3],
      [p.project_lead.toLowerCase(), 5],
      [p.end_customer.toLowerCase(), 4],
      [p.target_vendor.toLowerCase(), 6],
      [p.target_product.toLowerCase(), 6],
      [p.ticket_ref.toLowerCase(), 4],
      [p.technologies.join(" ").toLowerCase(), 4],
      [p.tools.join(" ").toLowerCase(), 4],
      [p.tags.join(" ").toLowerCase(), 4],
      [p.languages.join(" ").toLowerCase(), 3],
      [p.description.toLowerCase(), 1],
    ];
    let score = 0;
    for (const [hay, weight] of fields) {
      if (!hay) continue;
      if (hay.startsWith(query)) score += weight * 2;
      else if (hay.includes(query)) score += weight;
    }
    if (score > 0) scored.push({ p, score, snippet: snippetFor(p) });
  }
  return scored.sort((a, b) => b.score - a.score);
}


function snippetFor(p: Project): string {
  const bits: string[] = [];
  if (p.target_vendor || p.target_product) bits.push(`${p.target_vendor} ${p.target_product}`.trim());
  if (p.project_lead) bits.push(`lead ${p.project_lead}`);
  if (p.tags.length) bits.push(p.tags.slice(0, 3).join(", "));
  if (p.tools.length) bits.push(`${p.tools.slice(0, 3).join(", ")}`);
  return bits.filter(Boolean).join(" · ");
}
