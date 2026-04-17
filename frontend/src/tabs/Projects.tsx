import { useEffect, useMemo, useState } from "react";
import {
  PieChart as RPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { Search, Bug, ShieldCheck, Activity, CheckCircle2, AlertTriangle, Ban, GitBranch, FileText, Ticket, ExternalLink, Target } from "lucide-react";
import { Card } from "../components/Card";
import { MarkdownBody } from "../components/Markdown";
import { useData } from "../filters";
import { STAGE_COLOURS, STAGE_ORDER } from "../stagePalette";
import { fmtDateRange } from "../dates";
import type { Project } from "../types";


const OUTCOME_STYLE: Record<string, string> = {
  "Success":     "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  "Partial":     "bg-amber-500/15 text-amber-400 border-amber-500/40",
  "Blocked":     "bg-rose-500/15 text-rose-400 border-rose-500/40",
  "Abandoned":   "bg-slate-500/15 text-slate-400 border-slate-500/40",
  "In Progress": "bg-sky-500/15 text-sky-400 border-sky-500/40",
};


/** Browse individual projects and their metrics in-page (not modal). */
export function Projects({
  externalSelectedId, onConsumeExternal,
}: {
  /** When set, the list jumps to this project and clears any text filter so
   *  it's definitely visible. Useful when other tabs route here from a chart
   *  click. The parent should then call onConsumeExternal to reset the prop. */
  externalSelectedId?: number | null;
  onConsumeExternal?: () => void;
} = {}) {
  const { filtered, allProjects } = useData();
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<number | null>(null);

  // Respond to externally-routed selections (e.g. a viewer clicking a chart
  // bar on the Overview tab).
  useEffect(() => {
    if (externalSelectedId != null) {
      setQ("");
      setSelId(externalSelectedId);
      onConsumeExternal?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedId]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = filtered.length > 0 ? filtered : allProjects;
    // If a specific project was routed to us from outside the tab, make sure
    // it's visible even when the global filters exclude it.
    if (selId != null && !base.find((p) => p.id === selId)) {
      const routed = allProjects.find((p) => p.id === selId);
      if (routed) base = [routed, ...base];
    }
    if (!s) return base;
    return base.filter((p) =>
      p.name.toLowerCase().includes(s) ||
      p.project_type.toLowerCase().includes(s) ||
      p.campaign_hub.toLowerCase().includes(s) ||
      p.project_lead.toLowerCase().includes(s) ||
      p.target_product.toLowerCase().includes(s));
  }, [filtered, allProjects, q, selId]);

  // Keep selection consistent with the visible list
  useEffect(() => {
    if (selId && !visible.find((p) => p.id === selId)) {
      setSelId(visible[0]?.id ?? null);
    } else if (!selId && visible.length > 0) {
      setSelId(visible[0].id);
    }
  }, [visible, selId]);

  const selected = visible.find((p) => p.id === selId);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left: list */}
      <div className="col-span-12 lg:col-span-4 panel p-3 h-[72vh] flex flex-col">
        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="filter projects…"
                 className="w-full bg-bg0 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-accent/50"/>
        </div>
        <div className="text-[10px] font-mono text-slate-500 mb-2">
          {visible.length} project{visible.length === 1 ? "" : "s"}
        </div>
        <div className="flex-1 overflow-auto pr-1 space-y-1">
          {visible.map((p) => {
            const sel = p.id === selId;
            return (
              <button key={p.id} onClick={() => setSelId(p.id)}
                      className={`w-full text-left px-2.5 py-2 rounded border text-xs transition-colors
                        ${sel ? "bg-accent/10 border-accent/40"
                             : "bg-bg0 border-white/5 hover:border-white/20 hover:bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`mono truncate ${sel ? "text-accent" : "text-slate-100"}`}>{p.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono flex-shrink-0
                    ${p.status === "open"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-500/15 text-slate-400 border border-slate-500/30"}`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mono mt-0.5">
                  {p.project_type} · {p.campaign_hub}
                </div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="text-xs text-slate-500 py-8 text-center mono">no projects</div>
          )}
        </div>
      </div>

      {/* Right: selected project detail */}
      <div className="col-span-12 lg:col-span-8">
        {selected ? <ProjectPage project={selected} /> : (
          <div className="panel p-10 text-center text-slate-500 text-xs mono">
            Select a project from the list.
          </div>
        )}
      </div>
    </div>
  );
}


function ProjectPage({ project }: { project: Project }) {
  const { allProjects, settings } = useData();
  const equitiesLabel = settings?.label_equities || "HS Equities";

  const totalStageDays = project.stages.reduce((a, s) => a + s.days_spent, 0);
  const duration = project.end_date
    ? Math.max(0, Math.round((new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / 86400000))
    : Math.round((Date.now() - new Date(project.start_date).getTime()) / 86400000);
  const personDays = duration * project.team_size;

  // Stage breakdown data for chart — in canonical order, colour-matched
  const stageOrder = new Map<string, number>(STAGE_ORDER.map((s, i) => [s as string, i]));
  const stageData = [...project.stages]
    .filter((s) => s.days_spent > 0)
    .sort((a, b) => (stageOrder.get(a.stage_name) ?? 999) - (stageOrder.get(b.stage_name) ?? 999))
    .map((s) => ({ label: s.stage_name, value: s.days_spent, color: STAGE_COLOURS[s.stage_name] || "#22d3ee" }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="mono text-xl font-semibold text-slate-100">{project.name}</h2>
            <div className="text-[11px] text-slate-500 mono mt-1">
              {project.project_type} · {project.campaign_hub} · lead {project.project_lead || "—"}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={project.status} />
            <OutcomeBadge outcome={project.outcome} />
            {project.operational_success && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
                               bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                <CheckCircle2 size={10}/> Op Success
              </span>
            )}
          </div>
        </div>

        {/* Prominent target banner — the single most important bit of
            identifying information after the codename. */}
        {(project.target_vendor || project.target_product) && (
          <div className="mb-4 flex items-center gap-2.5 px-3 py-2 rounded
                          bg-accent/[0.06] border border-accent/25">
            <Target size={14} className="text-accent flex-shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent/80">
              Target
            </span>
            <span className="text-sm text-slate-100 mono truncate" title={`${project.target_vendor} ${project.target_product}`}>
              {[project.target_vendor, project.target_product].filter(Boolean).join("  ·  ")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <MiniKPI label="Vulns Found" value={project.vulnerabilities_discovered} icon={<Bug size={11}/>} tone="magenta"/>
          <MiniKPI label={equitiesLabel} value={project.hs_equities} icon={<ShieldCheck size={11}/>} tone="amber"/>
          <MiniKPI label="Duration" value={`${duration}d`} icon={<Activity size={11}/>} tone="sky"/>
          <MiniKPI label="Team Size" value={project.team_size} tone="slate"/>
          <MiniKPI label="Person-Days" value={personDays} tone="slate"/>
        </div>
      </Card>

      {/* Description is the project's own narrative — surface it right below
          the title so it reads like a page, not a stats dump. */}
      {project.objectives && (
        <Card title="Objectives">
          <p className="text-sm text-slate-200 leading-relaxed">{project.objectives}</p>
        </Card>
      )}
      {project.description && (
        <Card title="Description">
          <MarkdownBody text={project.description} projects={allProjects} onCite={() => {}} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: donut showing stage proportions */}
        <Card title="Stage Mix"
              subtitle={stageData.length === 0 ? "no stage data yet" : `${totalStageDays}d across ${stageData.length} stage${stageData.length === 1 ? "" : "s"}`}>
          {stageData.length === 0 ? (
            <div className="text-xs text-slate-500 mono py-8 text-center">
              add it via Edit Project
            </div>
          ) : (
            <StageDonut data={stageData} />
          )}
        </Card>
        {/* Middle: detailed stage bar list */}
        <Card title="Stage Breakdown" subtitle="Days recorded per stage">
          {stageData.length === 0 ? (
            <div className="text-xs text-slate-500 mono py-8 text-center">no data</div>
          ) : (
            <StageBarList data={stageData} total={totalStageDays} />
          )}
        </Card>
        {/* Right: meta */}
        <Card title="Meta">
          <div className="space-y-2 text-xs">
            <MetaRow label="Target" value={`${project.target_vendor || "—"}${project.target_product ? " · " + project.target_product : ""}`}/>
            <MetaRow label="CPU Arch" value={project.cpu_arch || "—"} mono/>
            <MetaRow label="End Customer" value={project.end_customer || "—"}/>
            <MetaRow label="Ticket Ref" value={project.ticket_ref || "—"} mono/>
            <MetaRow label="Start / End"
                     value={fmtDateRange(project.start_date, project.end_date)} mono/>
            <div className="pt-2 flex flex-wrap gap-1.5">
              {project.repo_url && <LinkChip href={project.repo_url} label="GitLab" icon={<GitBranch size={11}/>}/>}
              {project.confluence_url && <LinkChip href={project.confluence_url} label="Confluence" icon={<FileText size={11}/>}/>}
              {project.jira_url && <LinkChip href={project.jira_url} label="Jira" icon={<Ticket size={11}/>}/>}
            </div>
          </div>
        </Card>
      </div>

      {/* Benchmark — how this project compares to the average for its type */}
      <Card title={`How this compares — avg ${project.project_type} project`}
            subtitle="This project's metrics vs the average across filtered projects of the same type">
        <BenchmarkBars project={project} allProjects={allProjects} />
      </Card>

      {/* Narrative fields — only shown when populated so the page stays tight */}
      {(project.key_findings || project.next_steps || project.risks) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {project.key_findings && (
            <Card title="Key Findings">
              <MarkdownBody text={project.key_findings} projects={allProjects} onCite={() => {}} />
            </Card>
          )}
          {project.next_steps && (
            <Card title="Next Steps">
              <MarkdownBody text={project.next_steps} projects={allProjects} onCite={() => {}} />
            </Card>
          )}
          {project.risks && (
            <Card title="Risks & Notes" className={project.key_findings && project.next_steps ? "lg:col-span-2" : ""}>
              <MarkdownBody text={project.risks} projects={allProjects} onCite={() => {}} />
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Stack">
          <Chips label="Technologies" items={project.technologies} tone="accent"/>
          <Chips label="Tools" items={project.tools} tone="magenta"/>
          <Chips label="Operating Systems" items={project.os_list} tone="slate"/>
          <Chips label="Languages" items={project.languages} tone="slate"/>
        </Card>
        <Card title="People & Tags">
          <Chips label="Collaborators" items={project.collaborators} tone="slate"/>
          <Chips label="Tags" items={project.tags} tone="accent"/>
        </Card>
      </div>

      {/* Related projects — similarity derived from existing metadata */}
      <RelatedProjectsCard project={project} allProjects={allProjects} />
    </div>
  );
}


/** Surfaces up to 5 projects most similar to `project` by campaign + stack.
 *  Pure client-side computation — no new data required. */
function RelatedProjectsCard({
  project, allProjects,
}: {
  project: Project; allProjects: Project[];
}) {
  const { allProjects: ctxAll } = useData();
  const pool = allProjects.length > 0 ? allProjects : ctxAll;

  const related = useMemo(() => {
    const setTech = new Set(project.technologies);
    const setTools = new Set(project.tools);
    const setTags = new Set(project.tags);
    const setCollabs = new Set(project.collaborators);
    const scored = pool
      .filter((p) => p.id !== project.id)
      .map((p) => {
        let score = 0;
        const reasons: string[] = [];
        if (p.campaign_hub === project.campaign_hub) {
          score += 10;
          reasons.push(`same ${project.campaign_hub}`);
        }
        if (p.project_type === project.project_type) {
          score += 4;
        }
        const techOverlap = p.technologies.filter((t) => setTech.has(t));
        if (techOverlap.length) {
          score += techOverlap.length * 5;
          reasons.push(techOverlap.slice(0, 2).join(", "));
        }
        const toolOverlap = p.tools.filter((t) => setTools.has(t));
        if (toolOverlap.length) score += toolOverlap.length * 2;
        const tagOverlap = p.tags.filter((t) => setTags.has(t));
        if (tagOverlap.length) score += tagOverlap.length * 3;
        const collabOverlap = p.collaborators.filter((t) => setCollabs.has(t));
        if (collabOverlap.length) {
          score += collabOverlap.length * 4;
          reasons.push(`shared ${collabOverlap[0]}`);
        }
        if (p.target_vendor && p.target_vendor === project.target_vendor) {
          score += 6;
          reasons.push(`same target vendor`);
        }
        return { p, score, reasons };
      })
      .filter((x) => x.score > 4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return scored;
  }, [project, pool]);

  if (related.length === 0) return null;

  return (
    <Card title="Related Projects"
          subtitle="Projects that share campaign, stack, or collaborators with this one">
      <div className="space-y-1.5">
        {related.map(({ p, reasons }) => (
          <div key={p.id}
               className="flex items-center gap-3 px-2 py-1.5 rounded
                          hover:bg-white/[0.03] text-xs">
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono flex-shrink-0
              ${p.status === "open"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-500/15 text-slate-400 border border-slate-500/30"}`}>
              {p.status}
            </span>
            <span className="mono text-slate-100 font-medium flex-shrink-0">{p.name}</span>
            <span className="text-slate-500 truncate">
              {p.project_type} · {p.campaign_hub}
            </span>
            <span className="flex-1" />
            {reasons.length > 0 && (
              <span className="text-[10px] font-mono text-accent/70 truncate">
                {reasons.slice(0, 2).join(" · ")}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}


function MiniKPI({ label, value, icon, tone = "slate" }: {
  label: string; value: React.ReactNode; icon?: React.ReactNode;
  tone?: "accent" | "magenta" | "amber" | "sky" | "emerald" | "slate";
}) {
  const cls = {
    accent: "text-accent", magenta: "text-magenta", amber: "text-amber-400",
    sky: "text-sky-400", emerald: "text-emerald-400", slate: "text-slate-100",
  }[tone];
  return (
    <div className="panel rounded p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
        {icon && <span className={cls}>{icon}</span>}{label}
      </div>
      <div className={`mono-tab text-lg font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}


function StageDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RPie>
        <Pie data={data} dataKey="value" nameKey="label"
             innerRadius={45} outerRadius={80} paddingAngle={2}
             stroke="rgba(0,0,0,0.3)" strokeWidth={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: any, _n: any, it: any) => [`${v} days`, it?.payload?.label]}/>
        <Legend iconType="circle" wrapperStyle={{ fontSize: 10, lineHeight: "14px" }} />
      </RPie>
    </ResponsiveContainer>
  );
}


function BenchmarkBars({ project, allProjects }: { project: Project; allProjects: Project[] }) {
  const peers = allProjects.filter((p) => p.project_type === project.project_type);
  const closedPeers = peers.filter((p) => p.end_date);

  const avgDuration = closedPeers.length
    ? closedPeers.reduce((s, p) => s + daysBetween(p.start_date, p.end_date!), 0) / closedPeers.length
    : 0;
  const avgTeam = peers.length ? peers.reduce((s, p) => s + p.team_size, 0) / peers.length : 0;
  const avgVulns = closedPeers.length
    ? closedPeers.reduce((s, p) => s + p.vulnerabilities_discovered, 0) / closedPeers.length
    : 0;

  const thisDuration = project.end_date
    ? daysBetween(project.start_date, project.end_date)
    : Math.max(0, daysBetween(project.start_date, new Date().toISOString().slice(0, 10)));

  const rows = [
    { label: "Duration (days)", me: thisDuration, avg: +avgDuration.toFixed(1) },
    { label: "Team Size",       me: project.team_size, avg: +avgTeam.toFixed(1) },
    { label: "Vulnerabilities", me: project.vulnerabilities_discovered, avg: +avgVulns.toFixed(1) },
  ];

  if (!peers.length) {
    return <div className="text-xs text-slate-500 mono py-4 text-center">only project of this type</div>;
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const max = Math.max(r.me, r.avg, 1);
        const mePct = (r.me / max) * 100;
        const avgPct = (r.avg / max) * 100;
        const delta = r.avg > 0 ? ((r.me - r.avg) / r.avg) * 100 : 0;
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[11px] mono mb-1.5">
              <span className="text-slate-300">{r.label}</span>
              {r.avg > 0 && (
                <span className={`${delta > 10 ? "text-amber-400" : delta < -10 ? "text-emerald-400" : "text-slate-500"}`}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(0)}% vs avg
                </span>
              )}
            </div>
            {/* This project */}
            <div className="flex items-center gap-2 text-[11px] mono mb-1">
              <span className="text-accent w-14 flex-shrink-0">this</span>
              <div className="flex-1 h-2.5 bg-white/5 rounded">
                <div className="h-full bg-accent/60 rounded" style={{ width: `${mePct}%` }} />
              </div>
              <span className="text-slate-200 w-14 text-right">{r.me}</span>
            </div>
            {/* Average */}
            <div className="flex items-center gap-2 text-[11px] mono">
              <span className="text-slate-500 w-14 flex-shrink-0">avg</span>
              <div className="flex-1 h-2.5 bg-white/5 rounded">
                <div className="h-full bg-slate-500/60 rounded" style={{ width: `${avgPct}%` }} />
              </div>
              <span className="text-slate-400 w-14 text-right">{r.avg}</span>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] text-slate-600 mono pt-2 border-t border-white/5">
        baseline = {peers.length} {project.project_type} project{peers.length === 1 ? "" : "s"}
        {closedPeers.length < peers.length && ` (${closedPeers.length} closed for duration/vulns)`}
      </div>
    </div>
  );
}


function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}


function StageBarList({ data, total }: {
  data: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">{d.label}</span>
              <span className="mono text-slate-400">{d.value}d · {pct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded bg-white/5 overflow-hidden mt-1">
              <div className="h-full rounded"
                   style={{ width: `${pct}%`, background: d.color, opacity: 0.75 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b border-white/5 last:border-b-0">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`${mono ? "mono text-xs" : "text-xs"} text-slate-300 text-right`}>{value}</span>
    </div>
  );
}


function Chips({ label, items, tone }: {
  label: string; items: string[]; tone: "accent" | "magenta" | "slate";
}) {
  const cls = {
    accent: "bg-accent/10 border-accent/30 text-accent",
    magenta: "bg-magenta/10 border-magenta/30 text-magenta",
    slate: "bg-white/[0.04] border-white/10 text-slate-200",
  }[tone];
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      {items.length === 0 ? (
        <span className="text-xs text-slate-600">none</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((t) => (
            <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${cls}`}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}


function LinkChip({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border
                  border-white/10 hover:border-accent/50 text-[11px] text-slate-300 hover:text-accent font-mono">
      {icon || <ExternalLink size={11}/>} {label}
    </a>
  );
}


function StatusBadge({ status }: { status: string }) {
  const cls = status === "open"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
    : "bg-slate-500/15 text-slate-400 border-slate-500/40";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${cls}`}>{status}</span>;
}


function OutcomeBadge({ outcome }: { outcome: string }) {
  const icon = outcome === "Success" ? <CheckCircle2 size={10}/>
             : outcome === "Blocked" ? <Ban size={10}/>
             : outcome === "Partial" ? <AlertTriangle size={10}/>
             : outcome === "Abandoned" ? <Ban size={10}/>
             : <Activity size={10}/>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border
                      ${OUTCOME_STYLE[outcome] || "bg-white/[0.03] text-slate-300 border-white/15"}`}>
      {icon}{outcome}
    </span>
  );
}
