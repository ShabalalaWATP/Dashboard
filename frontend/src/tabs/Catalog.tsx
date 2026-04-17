import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { useData } from "../filters";
import type { Project, FilterState, PublicSettings } from "../types";
import { Layers, Wrench, Users2, Briefcase, Code2, Cpu, Tag, Target } from "lucide-react";
import { fmtDate } from "../dates";


type Tab = "target_technologies" | "technologies" | "tools" | "languages"
         | "architectures" | "customers" | "collaborators" | "tags";


type CatalogRow = {
  name: string;
  count: number;
  project_ids: number[];
  first_seen: string;
  last_seen: string;
  total_days: number;
};


function buildCatalog(
  projects: Project[],
  getKeys: (p: Project) => string[],
): CatalogRow[] {
  const m = new Map<string, CatalogRow>();
  const today = new Date().toISOString().slice(0, 10);
  for (const p of projects) {
    const end = p.end_date || today;
    const days = Math.max(0, (new Date(end).getTime() - new Date(p.start_date).getTime()) / 86400000);
    for (const k of getKeys(p)) {
      if (!k) continue;
      const row = m.get(k) ?? {
        name: k, count: 0, project_ids: [],
        first_seen: p.start_date, last_seen: p.start_date, total_days: 0,
      };
      row.count++;
      row.project_ids.push(p.id);
      if (p.start_date < row.first_seen) row.first_seen = p.start_date;
      const lastOn = p.end_date || p.start_date;
      if (lastOn > row.last_seen) row.last_seen = lastOn;
      row.total_days += days;
      m.set(k, row);
    }
  }
  return Array.from(m.values()).sort((a, b) => b.count - a.count);
}


export function Catalog({ onOpenProject }: {
  onOpenProject: (id: number) => void;
  settings?: PublicSettings;
}) {
  const { filtered, toggleFilter } = useData();
  const [tab, setTab] = useState<Tab>("target_technologies");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const byTab: Record<Tab, (p: Project) => string[]> = {
      target_technologies: (p) => (p.target_product ? [p.target_product] : []),
      technologies:  (p) => p.technologies,
      tools:         (p) => p.tools,
      languages:     (p) => p.languages,
      architectures: (p) => (p.cpu_arch ? [p.cpu_arch] : []),
      customers:     (p) => (p.end_customer ? [p.end_customer] : []),
      collaborators: (p) => p.collaborators,
      tags:          (p) => p.tags,
    };
    const base = buildCatalog(filtered, byTab[tab]);
    const ql = q.trim().toLowerCase();
    return ql ? base.filter((r) => r.name.toLowerCase().includes(ql)) : base;
  }, [filtered, tab, q]);

  function clickRow(row: CatalogRow) {
    // target_technologies, languages, architectures, collaborators don't have
    // a first-class filter; their click is a no-op.
    const filterKey: Partial<Record<Tab, keyof FilterState>> = {
      technologies:  "technologies",
      tools:         "tools",
      customers:     "customers",
      collaborators: "collaborators",
      languages:     "languages",
      architectures: "architectures",
      tags:          "tags",
    };
    const k = filterKey[tab];
    if (k) toggleFilter(k as any, row.name);
  }

  const maxCount = rows[0]?.count || 1;

  return (
    <div className="space-y-4">
      <Card title="Catalogs" subtitle="What the team has worked on. Counts reflect the active filter set.">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <TabBtn active={tab === "target_technologies"} onClick={() => setTab("target_technologies")}
                  icon={<Target size={13}/>}>Target Technologies</TabBtn>
          <TabBtn active={tab === "technologies"} onClick={() => setTab("technologies")}
                  icon={<Layers size={13}/>}>Technologies</TabBtn>
          <TabBtn active={tab === "tools"} onClick={() => setTab("tools")}
                  icon={<Wrench size={13}/>}>Tools</TabBtn>
          <TabBtn active={tab === "languages"} onClick={() => setTab("languages")}
                  icon={<Code2 size={13}/>}>Languages</TabBtn>
          <TabBtn active={tab === "architectures"} onClick={() => setTab("architectures")}
                  icon={<Cpu size={13}/>}>Architectures</TabBtn>
          <TabBtn active={tab === "customers"} onClick={() => setTab("customers")}
                  icon={<Briefcase size={13}/>}>Customers</TabBtn>
          <TabBtn active={tab === "collaborators"} onClick={() => setTab("collaborators")}
                  icon={<Users2 size={13}/>}>Collaborators</TabBtn>
          <TabBtn active={tab === "tags"} onClick={() => setTab("tags")}
                  icon={<Tag size={13}/>}>Tags</TabBtn>
          <div className="flex-1" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="filter this catalog…"
                 className="bg-bg0 border border-white/10 rounded-md px-2.5 py-1 text-xs outline-none focus:border-accent/50 w-[220px]" />
        </div>

        {rows.length === 0 ? (
          <div className="text-xs text-slate-500 mono py-6 text-center">nothing to show</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left border-b border-white/5">
                  <th className="py-2 pr-3 font-medium w-[22%]">Name</th>
                  <th className="py-2 pr-3 font-medium w-[32%]">Usage</th>
                  <th className="py-2 pr-3 font-medium">Projects</th>
                  <th className="py-2 pr-3 font-medium">First Seen</th>
                  <th className="py-2 pr-3 font-medium">Last Seen</th>
                  <th className="py-2 pr-3 font-medium">Examples</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 pr-3">
                      <button onClick={() => clickRow(r)}
                              className="mono font-medium text-slate-100 hover:text-accent text-left">
                        {r.name}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/5 rounded">
                          <div className="h-full bg-accent/60 rounded"
                               style={{ width: `${(r.count / maxCount) * 100}%` }} />
                        </div>
                        <span className="mono text-[11px] text-slate-300 w-6 text-right">{r.count}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 mono text-slate-300">{r.count}</td>
                    <td className="py-2 pr-3 mono text-slate-400 whitespace-nowrap">{fmtDate(r.first_seen)}</td>
                    <td className="py-2 pr-3 mono text-slate-400 whitespace-nowrap">{fmtDate(r.last_seen)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {r.project_ids.slice(0, 3).map((pid) => (
                          <button key={pid}
                                  onClick={() => onOpenProject(pid)}
                                  className="text-[10px] mono px-1.5 py-0.5 rounded
                                             bg-accent/10 border border-accent/30 text-accent
                                             hover:bg-accent/20">
                            #{pid}
                          </button>
                        ))}
                        {r.project_ids.length > 3 && (
                          <span className="text-[10px] mono text-slate-500">
                            +{r.project_ids.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


function TabBtn({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border
        ${active
          ? "bg-accent/15 border-accent/40 text-accent"
          : "bg-bg0 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/30"}`}>
      {icon}{children}
    </button>
  );
}
