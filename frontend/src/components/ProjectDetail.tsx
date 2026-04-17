import { useState } from "react";
import {
  X, ExternalLink, Bug, ShieldCheck, Activity,
  CheckCircle2, AlertTriangle, Ban, GitBranch, FileText, Ticket, Target,
} from "lucide-react";
import type { Project } from "../types";
import { useEscape } from "../hooks";
import { MarkdownBody } from "./Markdown";
import { useData } from "../filters";
import { fmtDate } from "../dates";

export function ProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  useEscape(onClose);
  const { allProjects, settings } = useData();
  const equitiesLabel = settings?.label_equities || "HS Equities";
  const [chained, setChained] = useState<Project | null>(null);

  const duration = project.end_date
    ? Math.max(0, Math.round(
        (new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / 86400000
      ))
    : null;
  const totalStageDays = project.stages.reduce((a, s) => a + s.days_spent, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="panel rounded-xl w-[820px] max-h-[92vh] overflow-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg1/90 backdrop-blur-md border-b border-white/5
                        flex justify-between items-start px-5 py-3 z-10 gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="mono text-base font-semibold text-slate-100">{project.name}</h2>
            <StatusBadge status={project.status} />
            <OutcomeBadge outcome={project.outcome} />
            {project.operational_success && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
                               bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                <CheckCircle2 size={10}/> Operational Success
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 mt-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Target banner — most important identifying data after the codename */}
          {(project.target_vendor || project.target_product) && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded
                            bg-accent/[0.06] border border-accent/25">
              <Target size={14} className="text-accent flex-shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent/80">
                Target
              </span>
              <span className="text-sm text-slate-100 mono truncate">
                {[project.target_vendor, project.target_product].filter(Boolean).join("  ·  ")}
              </span>
            </div>
          )}

          {project.status === "closed" && (
            <div className="grid grid-cols-3 gap-3">
              <MiniKPI icon={<Bug size={14}/>} label="Vulnerabilities"
                       value={project.vulnerabilities_discovered} />
              <MiniKPI icon={<ShieldCheck size={14}/>} label={equitiesLabel}
                       value={project.hs_equities} />
              <MiniKPI icon={<Activity size={14}/>} label="Duration"
                       value={duration != null ? `${duration}d` : "—"} />
            </div>
          )}

          <Section title="Identification">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Info label="Project Type" value={project.project_type} />
              <Info label="Campaign Hub" value={project.campaign_hub} />
              <Info label="Target Vendor" value={project.target_vendor || "—"} />
              <Info label="Target Technology" value={project.target_product || "—"} />
              <Info label="CPU Architecture" value={project.cpu_arch || "—"} mono />
              <Info label="Ticket / Request Ref" value={project.ticket_ref || "—"} mono />
            </div>
          </Section>

          <Section title="Team & Schedule">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Info label="Project Lead" value={project.project_lead || "—"} />
              <Info label="Team Size" value={String(project.team_size)} mono />
              <Info label="End Customer" value={project.end_customer || "—"} />
              <Info label="Start Date" value={fmtDate(project.start_date)} mono />
              <Info label="End Date" value={project.end_date ? fmtDate(project.end_date) : "open"} mono />
              <Info label="Stage Days" value={totalStageDays ? `${totalStageDays}d` : "—"} mono />
            </div>
          </Section>

          {(project.repo_url || project.confluence_url || project.jira_url) && (
            <Section title="Links">
              <div className="flex flex-wrap gap-2">
                {project.repo_url && <LinkChip href={project.repo_url} label="GitLab" icon={<GitBranch size={11}/>} />}
                {project.confluence_url && <LinkChip href={project.confluence_url} label="Confluence" icon={<FileText size={11}/>} />}
                {project.jira_url && <LinkChip href={project.jira_url} label="Jira" icon={<Ticket size={11}/>} />}
              </div>
            </Section>
          )}

          {project.objectives && (
            <Section title="Objectives">
              <p className="text-sm text-slate-200 leading-relaxed">{project.objectives}</p>
            </Section>
          )}

          <Section title="Description">
            {project.description ? (
              <MarkdownBody text={project.description} projects={allProjects}
                            onCite={(p) => { if (p.id !== project.id) setChained(p); }} />
            ) : (
              <span className="text-xs text-slate-500">No description.</span>
            )}
          </Section>

          {project.key_findings && (
            <Section title="Key Findings">
              <MarkdownBody text={project.key_findings} projects={allProjects}
                            onCite={(p) => { if (p.id !== project.id) setChained(p); }} />
            </Section>
          )}
          {project.next_steps && (
            <Section title="Next Steps">
              <MarkdownBody text={project.next_steps} projects={allProjects}
                            onCite={(p) => { if (p.id !== project.id) setChained(p); }} />
            </Section>
          )}
          {project.risks && (
            <Section title="Risks & Notes">
              <MarkdownBody text={project.risks} projects={allProjects}
                            onCite={(p) => { if (p.id !== project.id) setChained(p); }} />
            </Section>
          )}

          <div className="grid grid-cols-2 gap-5">
            <ChipList label="Technologies" items={project.technologies} tone="accent"/>
            <ChipList label="Operating Systems" items={project.os_list} tone="slate"/>
            <ChipList label="Tools" items={project.tools} tone="magenta"/>
            <ChipList label="Languages" items={project.languages} tone="slate"/>
            <ChipList label="Collaborators" items={project.collaborators} tone="slate"/>
            <ChipList label="Tags" items={project.tags} tone="accent"/>
          </div>

          {project.stages.length > 0 && (
            <Section title="Stage Breakdown">
              <div className="space-y-2">
                {project.stages.map((s) => {
                  const pct = totalStageDays > 0 ? (s.days_spent / totalStageDays) * 100 : 0;
                  return (
                    <div key={s.stage_name}>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">{s.stage_name}</span>
                        <span className="mono text-slate-400">{s.days_spent}d · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded bg-white/5 overflow-hidden mt-0.5">
                        <div className="h-full bg-accent/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>
      {chained && <ProjectDetail project={chained} onClose={() => setChained(null)} />}
    </div>
  );
}


function MiniKPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="panel rounded-md p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
        <span className="text-slate-500">{icon}</span>{label}
      </div>
      <div className="mono text-xl text-slate-100 mt-1">{value}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-0.5 text-slate-200 ${mono ? "mono text-[13px]" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 border-b border-white/5 pb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipList({ label, items, tone = "slate" }: {
  label: string; items: string[]; tone?: "accent" | "magenta" | "slate";
}) {
  const toneCls = {
    accent:  "bg-accent/10 border-accent/30 text-accent",
    magenta: "bg-magenta/10 border-magenta/30 text-magenta",
    slate:   "bg-white/[0.04] border-white/10 text-slate-200",
  }[tone];
  return (
    <Section title={label}>
      {items.length === 0 ? (
        <span className="text-xs text-slate-500">none</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((t) => (
            <span key={t}
                  className={`text-[11px] px-2 py-1 rounded-full border font-mono ${toneCls}`}>
              {t}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

function LinkChip({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border
                  border-white/10 hover:border-accent/50 text-xs text-slate-300 hover:text-accent font-mono">
      {icon || <ExternalLink size={11}/>} {label}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "open"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
    : "bg-slate-500/15 text-slate-400 border-slate-500/40";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${cls}`}>{status}</span>
  );
}

const OUTCOME_STYLE: Record<string, string> = {
  "Success":     "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  "Partial":     "bg-amber-500/15 text-amber-400 border-amber-500/40",
  "Blocked":     "bg-rose-500/15 text-rose-400 border-rose-500/40",
  "Abandoned":   "bg-slate-500/15 text-slate-400 border-slate-500/40",
  "In Progress": "bg-sky-500/15 text-sky-400 border-sky-500/40",
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const icon = outcome === "Success" ? <CheckCircle2 size={10}/>
             : outcome === "Blocked" ? <Ban size={10}/>
             : outcome === "Partial" ? <AlertTriangle size={10}/>
             : outcome === "Abandoned" ? <Ban size={10}/>
             : <Activity size={10}/>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border
                      ${OUTCOME_STYLE[outcome] || OUTCOME_STYLE["In Progress"]}`}>
      {icon}{outcome}
    </span>
  );
}
