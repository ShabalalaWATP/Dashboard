import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";
import { useEscape } from "../hooks";
import { useData } from "../filters";
import { ChipInput } from "./ChipInput";
import type { Project } from "../types";

const DEFAULT_OUTCOMES = ["In Progress", "Success", "Partial", "Blocked", "Abandoned"];
const STAGES = [
  "Sourcing",
  "Research",
  "Setup",
  "System Characterisation",
  "Vulnerability Research",
  "Exploit Development",
  "Documentation",
  "Other",
];


type FormState = {
  name: string;
  project_type: string;
  campaign_hub: string;
  start_date: string;
  end_date: string;
  team_size: number;
  end_customer: string;
  description: string;
  technologies: string[];
  tools: string[];
  os_list: string[];
  collaborators: string[];
  languages: string[];
  tags: string[];

  target_vendor: string;
  target_product: string;
  cpu_arch: string;
  outcome: string;
  project_lead: string;
  ticket_ref: string;
  repo_url: string;
  wiki_url: string;
  confluence_url: string;
  jira_url: string;
  vulnerabilities_discovered: number;
  hs_equities: number;
  operational_success: boolean;

  stages: { stage_name: string; days_spent: number }[];

  objectives: string;
  key_findings: string;
  next_steps: string;
  risks: string;
};


function emptyForm(defaultType: string, defaultHub: string): FormState {
  return {
    name: "", project_type: defaultType, campaign_hub: defaultHub,
    start_date: new Date().toISOString().slice(0, 10), end_date: "",
    team_size: 2, end_customer: "", description: "",
    technologies: [], tools: [], os_list: [], collaborators: [],
    languages: [], tags: [],
    target_vendor: "", target_product: "", cpu_arch: "",
    outcome: "In Progress",
    project_lead: "", ticket_ref: "",
    repo_url: "", wiki_url: "", confluence_url: "", jira_url: "",
    vulnerabilities_discovered: 0, hs_equities: 0, operational_success: false,
    stages: STAGES.map((s) => ({ stage_name: s, days_spent: 0 })),
    objectives: "", key_findings: "", next_steps: "", risks: "",
  };
}

function fromProject(p: Project): FormState {
  // Reconcile existing stage rows with the canonical stage order so the form
  // always shows every stage, even if only some have data recorded.
  const existing = new Map(p.stages.map((s) => [s.stage_name, s.days_spent]));
  const stages = STAGES.map((s) => ({
    stage_name: s,
    days_spent: existing.get(s) || 0,
  }));
  // Include any non-canonical stage names that exist in the project data
  for (const s of p.stages) {
    if (!STAGES.includes(s.stage_name)) {
      stages.push({ stage_name: s.stage_name, days_spent: s.days_spent });
    }
  }
  return {
    name: p.name, project_type: p.project_type, campaign_hub: p.campaign_hub,
    start_date: p.start_date, end_date: p.end_date || "",
    team_size: p.team_size, end_customer: p.end_customer,
    description: p.description,
    technologies: [...p.technologies], tools: [...p.tools],
    os_list: [...p.os_list], collaborators: [...p.collaborators],
    languages: [...p.languages], tags: [...p.tags],
    target_vendor: p.target_vendor, target_product: p.target_product,
    cpu_arch: p.cpu_arch, outcome: p.outcome,
    project_lead: p.project_lead, ticket_ref: p.ticket_ref,
    repo_url: p.repo_url, wiki_url: p.wiki_url,
    confluence_url: p.confluence_url, jira_url: p.jira_url,
    vulnerabilities_discovered: p.vulnerabilities_discovered,
    hs_equities: p.hs_equities, operational_success: p.operational_success,
    stages,
    objectives: p.objectives || "",
    key_findings: p.key_findings || "",
    next_steps: p.next_steps || "",
    risks: p.risks || "",
  };
}


function useSuggestions() {
  const { allProjects, catalogs } = useData();
  return useMemo(() => {
    const merge = (base: string[], key: (p: Project) => string[]) =>
      Array.from(new Set([...base, ...allProjects.flatMap(key)])).sort();
    const tagPool = Array.from(new Set(allProjects.flatMap((p) => p.tags)));
    return {
      project_types: merge(catalogs.project_types, (p) => [p.project_type]),
      outcomes: merge(catalogs.outcomes || DEFAULT_OUTCOMES, (p) => [p.outcome]),
      hubs: merge(catalogs.hubs, (p) => [p.campaign_hub]),
      target_techs: merge(catalogs.target_technologies, (p) => p.target_product ? [p.target_product] : []),
      tech: merge(catalogs.technologies, (p) => p.technologies),
      tools: merge(catalogs.tools, (p) => p.tools),
      os: merge(catalogs.os, (p) => p.os_list),
      collabs: merge(catalogs.collaborators, (p) => p.collaborators),
      langs: merge(catalogs.languages, (p) => p.languages),
      archs: merge(catalogs.architectures, (p) => p.cpu_arch ? [p.cpu_arch] : []),
      tags: tagPool.sort(),
      customers: merge(catalogs.customers, (p) => p.end_customer ? [p.end_customer] : []),
      leads: Array.from(new Set(allProjects.map((p) => p.project_lead).filter(Boolean))).sort(),
      vendors: Array.from(new Set(allProjects.map((p) => p.target_vendor).filter(Boolean))).sort(),
    };
  }, [allProjects, catalogs]);
}


function FormFields({ form, setForm, sugg, showOutcomeFields }: {
  form: FormState; setForm: (u: (f: FormState) => FormState) => void;
  sugg: ReturnType<typeof useSuggestions>;
  showOutcomeFields: boolean;
}) {
  const { settings } = useData();
  const equitiesLabel = settings?.label_equities || "HS Equities";
  const patch = <K extends keyof FormState>(k: K) => (v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <Section title="Identification">
        <Row>
          <Field label="Codename"><input required value={form.name}
            onChange={(e) => patch("name")(e.target.value as any)} className={ic}/></Field>
          <Field label="Ticket / Request Ref">
            <input placeholder="REQ-1234" value={form.ticket_ref}
                   onChange={(e) => patch("ticket_ref")(e.target.value as any)} className={ic}/>
          </Field>
        </Row>
        <Row>
          <Field label="Project Type">
            <input list="_ptype-sugg" value={form.project_type}
                   onChange={(e) => patch("project_type")(e.target.value as any)}
                   placeholder="e.g. Vulnerability Research"
                   className={ic}/>
            <datalist id="_ptype-sugg">
              {sugg.project_types.map((t) => <option key={t} value={t}/>)}
            </datalist>
          </Field>
          <Field label="Campaign">
            <input list="_hub-sugg" value={form.campaign_hub}
                   onChange={(e) => patch("campaign_hub")(e.target.value as any)} className={ic}/>
            <datalist id="_hub-sugg">
              {sugg.hubs.map((h) => <option key={h} value={h}/>)}
            </datalist>
          </Field>
        </Row>
      </Section>

      <Section title="Target">
        <Row>
          <Field label="Target Vendor"><input placeholder="e.g. Cisco" list="_vendor-sugg"
            value={form.target_vendor} onChange={(e) => patch("target_vendor")(e.target.value as any)} className={ic}/>
            <datalist id="_vendor-sugg">{sugg.vendors.map((v) => <option key={v} value={v}/>)}</datalist>
          </Field>
          <Field label="Target Technology">
            <input placeholder="e.g. Apple iOS 17" list="_target-tech-sugg"
                   value={form.target_product}
                   onChange={(e) => patch("target_product")(e.target.value as any)} className={ic}/>
            <datalist id="_target-tech-sugg">
              {sugg.target_techs.map((v) => <option key={v} value={v}/>)}
            </datalist>
          </Field>
        </Row>
        <Row>
          <Field label="CPU Architecture">
            <input list="_arch-sugg" value={form.cpu_arch}
                   onChange={(e) => patch("cpu_arch")(e.target.value as any)} className={ic}/>
            <datalist id="_arch-sugg">{sugg.archs.map((a) => <option key={a} value={a}/>)}</datalist>
          </Field>
          <Field label="End Customer"><input list="_cust-sugg"
            value={form.end_customer} onChange={(e) => patch("end_customer")(e.target.value as any)} className={ic}/>
            <datalist id="_cust-sugg">{sugg.customers.map((v) => <option key={v} value={v}/>)}</datalist>
          </Field>
        </Row>
      </Section>

      <Section title="Team & Schedule">
        <Row>
          <Field label="Project Lead"><input list="_lead-sugg"
            value={form.project_lead} onChange={(e) => patch("project_lead")(e.target.value as any)} className={ic}/>
            <datalist id="_lead-sugg">{sugg.leads.map((v) => <option key={v} value={v}/>)}</datalist>
          </Field>
          <Field label="Team Size"><input type="number" min={1} max={50} value={form.team_size}
            onChange={(e) => patch("team_size")(+e.target.value as any)} className={ic}/>
          </Field>
        </Row>
        <Row>
          <Field label="Start Date"><input type="date" value={form.start_date}
            onChange={(e) => patch("start_date")(e.target.value as any)} className={ic}/></Field>
          <Field label="End Date (blank if open)">
            <input type="date" value={form.end_date}
                   onChange={(e) => patch("end_date")(e.target.value as any)} className={ic}/>
          </Field>
        </Row>
      </Section>

      <Section title="Stack">
        <ChipInput label="Technologies" value={form.technologies}
                   onChange={patch("technologies")} suggestions={sugg.tech} />
        <ChipInput label="Tools" value={form.tools} onChange={patch("tools")}
                   suggestions={sugg.tools} />
        <Row>
          <ChipInput label="Operating Systems" value={form.os_list}
                     onChange={patch("os_list")} suggestions={sugg.os} />
          <ChipInput label="Languages" value={form.languages}
                     onChange={patch("languages")} suggestions={sugg.langs} />
        </Row>
        <Row>
          <ChipInput label="Collaborators" value={form.collaborators}
                     onChange={patch("collaborators")} suggestions={sugg.collabs} />
          <ChipInput label="Tags" value={form.tags} onChange={patch("tags")}
                     suggestions={sugg.tags} placeholder="0day, fuzzing, …" />
        </Row>
      </Section>

      <Section title="Links">
        <Row>
          <Field label="GitLab URL">
            <input type="url" placeholder="https://gitlab.internal/est/…"
                   value={form.repo_url} onChange={(e) => patch("repo_url")(e.target.value as any)} className={ic}/>
          </Field>
          <Field label="Confluence Page">
            <input type="url" placeholder="https://confluence.internal/display/EST/…"
                   value={form.confluence_url}
                   onChange={(e) => patch("confluence_url")(e.target.value as any)} className={ic}/>
          </Field>
        </Row>
        <Row>
          <Field label="Jira Ticket">
            <input type="url" placeholder="https://jira.internal/browse/REQ-1234"
                   value={form.jira_url}
                   onChange={(e) => patch("jira_url")(e.target.value as any)} className={ic}/>
          </Field>
          <div/>
        </Row>
      </Section>

      <Section title="Stages — days spent per phase">
        <div className="text-[11px] text-slate-500 mb-2 font-mono">
          Keep this up to date throughout the project. Feeds the Lifecycle charts.
        </div>
        <StageEditor stages={form.stages}
                     onChange={(next) => setForm((f) => ({ ...f, stages: next }))} />
      </Section>

      {showOutcomeFields && (
        <Section title="Outcome & Findings">
          <Row>
            <Field label="Outcome">
              <input list="_outcome-sugg" value={form.outcome}
                     onChange={(e) => patch("outcome")(e.target.value as any)}
                     placeholder="e.g. Success" className={ic}/>
              <datalist id="_outcome-sugg">
                {sugg.outcomes.map((o) => <option key={o} value={o}/>)}
              </datalist>
            </Field>
            <Field label="Operational Success">
              <label className="flex items-center gap-2 h-[38px]">
                <input type="checkbox" checked={form.operational_success}
                       onChange={(e) => patch("operational_success")(e.target.checked as any)}
                       className="accent-cyan-400" />
                <span className="text-xs text-slate-300">Recorded as a success</span>
              </label>
            </Field>
          </Row>
          <Row>
            <Field label="Vulnerabilities Discovered"><input type="number" min={0}
              value={form.vulnerabilities_discovered}
              onChange={(e) => patch("vulnerabilities_discovered")(+e.target.value as any)}
              className={ic}/>
            </Field>
            <Field label={equitiesLabel}><input type="number" min={0}
              value={form.hs_equities}
              onChange={(e) => patch("hs_equities")(+e.target.value as any)} className={ic}/>
            </Field>
          </Row>
        </Section>
      )}

      <Section title="Narrative">
        <Field label="Objectives — short summary (1–2 lines)">
          <input value={form.objectives}
                 onChange={(e) => patch("objectives")(e.target.value as any)}
                 placeholder="e.g. Identify exploitable defects in the VPN management interface."
                 className={ic} />
        </Field>
        <Field label="Description (Markdown supported)">
          <textarea rows={6} value={form.description}
            onChange={(e) => patch("description")(e.target.value as any)}
            className={ic + " font-mono text-xs"}
            placeholder="### Approach&#10;&#10;### Context&#10;&#10;### Notes" />
        </Field>
        <Row>
          <Field label="Key Findings (Markdown)">
            <textarea rows={5} value={form.key_findings}
              onChange={(e) => patch("key_findings")(e.target.value as any)}
              className={ic + " font-mono text-xs"}
              placeholder="- What was discovered&#10;- Severity / impact&#10;- Artefacts delivered" />
          </Field>
          <Field label="Next Steps (Markdown)">
            <textarea rows={5} value={form.next_steps}
              onChange={(e) => patch("next_steps")(e.target.value as any)}
              className={ic + " font-mono text-xs"}
              placeholder="- What comes next&#10;- Who owns it&#10;- Decision points" />
          </Field>
        </Row>
        <Field label="Risks & Notes (Markdown)">
          <textarea rows={4} value={form.risks}
            onChange={(e) => patch("risks")(e.target.value as any)}
            className={ic + " font-mono text-xs"}
            placeholder="- Known limitations&#10;- Dependencies&#10;- Caveats" />
        </Field>
      </Section>
    </div>
  );
}


export function NewProjectForm({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void;
}) {
  const sugg = useSuggestions();
  const { catalogs } = useData();
  const [form, setForm] = useState<FormState>(
    emptyForm(catalogs.project_types[0] || "", catalogs.hubs[0] || "")
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const payload: any = { ...form };
      delete payload.end_date;
      payload.stages = form.stages.filter((s) => s.days_spent > 0);
      await api.post("/api/projects", payload);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
      <form onSubmit={submit}>
        <FormFields form={form} setForm={setForm} sugg={sugg} showOutcomeFields={false} />
        {err && <div className="text-xs text-red-400 mt-3">{err}</div>}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={busy} className={btnPrimary}>{busy ? "…" : "Create Project"}</button>
        </div>
      </form>
    </Modal>
  );
}


export function EditProjectForm({ project, onClose, onSaved }: {
  project: Project; onClose: () => void; onSaved: () => void;
}) {
  const sugg = useSuggestions();
  const [form, setForm] = useState<FormState>(fromProject(project));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const payload: any = { ...form };
      if (!payload.end_date) payload.end_date = null;
      payload.stages = form.stages.filter((s) => s.days_spent > 0);
      await api.patch(`/api/projects/${project.id}`, payload);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Edit — ${project.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <FormFields form={form} setForm={setForm} sugg={sugg} showOutcomeFields={project.status === "closed"} />
        {err && <div className="text-xs text-red-400 mt-3">{err}</div>}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={busy} className={btnPrimary}>{busy ? "…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}


export function CloseProjectForm({ project, onClose, onSaved }: {
  project: Project; onClose: () => void; onSaved: () => void;
}) {
  const { catalogs, settings } = useData();
  const equitiesLabel = settings?.label_equities || "HS Equities";
  const existing = new Map(project.stages.map((s) => [s.stage_name, s.days_spent]));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [stages, setStages] = useState(
    STAGES.map((s) => ({ stage_name: s, days_spent: existing.get(s) || 0 }))
  );
  const [outcome, setOutcome] = useState("Success");
  const outcomeSugg = Array.from(new Set([...(catalogs.outcomes || []), ...DEFAULT_OUTCOMES]))
    .filter((o) => o !== "In Progress");
  const [vulns, setVulns] = useState(project.vulnerabilities_discovered || 0);
  const [equities, setEquities] = useState(project.hs_equities || 0);
  const [opSuccess, setOpSuccess] = useState(false);
  const [desc, setDesc] = useState(project.description);
  const [teamSize, setTeamSize] = useState(project.team_size);
  const [customer, setCustomer] = useState(project.end_customer);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await api.post(`/api/projects/${project.id}/close`, {
        end_date: endDate,
        stages: stages.filter((s) => s.days_spent > 0),
        description: desc, team_size: teamSize, end_customer: customer,
        outcome, vulnerabilities_discovered: vulns, hs_equities: equities,
        operational_success: opSuccess,
      });
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const total = stages.reduce((a, b) => a + (b.days_spent || 0), 0);

  return (
    <Modal title={`Close Project — ${project.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Row>
          <Field label="End Date"><input type="date" value={endDate}
            onChange={(e) => setEndDate(e.target.value)} className={ic}/></Field>
          <Field label="Outcome">
            <input list="_close-outcome-sugg" value={outcome}
                   onChange={(e) => setOutcome(e.target.value)} className={ic}/>
            <datalist id="_close-outcome-sugg">
              {outcomeSugg.map((o) => <option key={o} value={o}/>)}
            </datalist>
          </Field>
        </Row>
        <Row>
          <Field label="Vulnerabilities Discovered"><input type="number" min={0} value={vulns}
            onChange={(e) => setVulns(+e.target.value)} className={ic}/></Field>
          <Field label={equitiesLabel}><input type="number" min={0} value={equities}
            onChange={(e) => setEquities(+e.target.value)} className={ic}/></Field>
        </Row>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={opSuccess}
                 onChange={(e) => setOpSuccess(e.target.checked)} className="accent-cyan-400"/>
          Mark as an operational success
        </label>
        <Row>
          <Field label="Team Size"><input type="number" value={teamSize}
            onChange={(e) => setTeamSize(+e.target.value)} className={ic}/></Field>
          <Field label="End Customer"><input value={customer}
            onChange={(e) => setCustomer(e.target.value)} className={ic}/></Field>
        </Row>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-400">Stage breakdown (days)</label>
            <span className="text-xs mono text-slate-500">total: {total}</span>
          </div>
          <StageEditor stages={stages} onChange={setStages} />
        </div>

        <Field label="Description (Markdown)"><textarea rows={4} value={desc}
          onChange={(e) => setDesc(e.target.value)} className={ic + " font-mono text-xs"}/></Field>

        {err && <div className="text-xs text-red-400">{err}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={busy} className={btnPrimary}>{busy ? "…" : "Close Project"}</button>
        </div>
      </form>
    </Modal>
  );
}


const ic = "w-full bg-bg0 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-accent/50";
const btnPrimary = "px-4 py-2 rounded-md bg-accent/20 border border-accent/50 text-accent hover:bg-accent/30 text-sm font-semibold disabled:opacity-50";
const btnGhost = "px-4 py-2 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 text-sm";


function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5 pb-1 mb-3">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StageEditor({
  stages, onChange,
}: {
  stages: { stage_name: string; days_spent: number }[];
  onChange: (next: { stage_name: string; days_spent: number }[]) => void;
}) {
  const total = stages.reduce((a, b) => a + (b.days_spent || 0), 0);
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] mono text-slate-500 uppercase tracking-wider">days per stage</span>
        <span className="text-[11px] mono text-slate-400">total: {total}d</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stages.map((s, i) => (
          <div key={s.stage_name} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-300 flex-1 truncate" title={s.stage_name}>
              {s.stage_name}
            </span>
            <input type="number" min={0} step={1}
                   value={s.days_spent}
                   onChange={(e) => {
                     const v = [...stages];
                     v[i] = { ...v[i], days_spent: Math.max(0, +e.target.value || 0) };
                     onChange(v);
                   }}
                   className="bg-bg0 border border-white/10 rounded-md px-2 py-1 text-xs w-20 text-right outline-none focus:border-accent/50 mono" />
          </div>
        ))}
      </div>
    </div>
  );
}


function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="panel rounded-xl w-[720px] max-h-[90vh] overflow-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg1/90 backdrop-blur-md flex justify-between
                        items-center px-5 py-3 border-b border-white/5 z-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
