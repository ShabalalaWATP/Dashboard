import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, KeyRound, Upload, Search, Eye, Pencil, ListTree } from "lucide-react";
import { api } from "../api";
import { NewProjectForm, CloseProjectForm, EditProjectForm } from "./ProjectForm";
import { ProjectDetail } from "./ProjectDetail";
import { useEscape } from "../hooks";
import { useData } from "../filters";
import { CATALOG_NAMES } from "../types";
import { fmtDate } from "../dates";
import type { Project, User, Catalogs } from "../types";

type Tab = "projects" | "appearance" | "catalogs" | "llm" | "users";

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("projects");
  useEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="panel rounded-xl w-[1080px] h-[88vh] flex flex-col">
        <div className="flex justify-between items-center px-5 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold uppercase tracking-wider">Admin Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <nav className="w-48 border-r border-white/5 p-3 space-y-1 text-sm">
            {([
              ["projects",   "Projects"],
              ["appearance", "Appearance"],
              ["catalogs",   "Catalogs"],
              ["llm",        "LLM"],
              ["users",      "Users"],
            ] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`w-full text-left px-3 py-2 rounded ${tab===k ? "bg-accent/15 text-accent" : "text-slate-300 hover:bg-white/5"}`}>
                {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 p-5 overflow-auto">
            {tab === "projects" && <ProjectsAdmin />}
            {tab === "appearance" && <AppearanceAdmin />}
            {tab === "catalogs" && <CatalogsAdmin />}
            {tab === "llm" && <LLMAdmin />}
            {tab === "users" && <UsersAdmin />}
          </div>
        </div>
      </div>
    </div>
  );
}


function ProjectsAdmin() {
  const { allProjects, refresh } = useData();
  const [showNew, setShowNew] = useState(false);
  const [closing, setClosing] = useState<Project | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [viewing, setViewing] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [hubFilter, setHubFilter] = useState<string>("all");

  async function del(p: Project) {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    try { await api.del(`/api/projects/${p.id}`); await refresh(); }
    catch (e: any) { setErr(e.message); }
  }
  async function reopen(p: Project) {
    try {
      await api.patch(`/api/projects/${p.id}`, { status: "open", end_date: null, outcome: "In Progress" });
      await refresh();
    } catch (e: any) { setErr(e.message); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProjects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (hubFilter !== "all" && p.campaign_hub !== hubFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.project_type.toLowerCase().includes(q) ||
        p.project_lead.toLowerCase().includes(q) ||
        p.target_vendor.toLowerCase().includes(q) ||
        p.target_product.toLowerCase().includes(q) ||
        p.end_customer.toLowerCase().includes(q) ||
        p.technologies.some((t) => t.toLowerCase().includes(q)) ||
        p.tools.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [allProjects, search, statusFilter, hubFilter]);

  const hubs = Array.from(new Set(allProjects.map((p) => p.campaign_hub))).sort();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold mr-2">
          Projects <span className="text-slate-500 font-normal">({filtered.length} / {allProjects.length})</span>
        </h3>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            placeholder="Search name, vendor, tech, tool, customer, lead…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg0 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-accent/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-bg0 border border-white/10 rounded-md px-2 py-1.5 text-xs">
          <option value="all">all status</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
        </select>
        <select value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}
                className="bg-bg0 border border-white/10 rounded-md px-2 py-1.5 text-xs">
          <option value="all">all hubs</option>
          {hubs.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent/20 border border-accent/50 text-accent text-xs">
          <Plus size={14}/> New Project
        </button>
      </div>
      {err && <div className="text-xs text-red-400 mb-2">{err}</div>}
      <div className="overflow-auto max-h-[62vh] border border-white/5 rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-bg0 sticky top-0 z-10">
            <tr className="text-slate-400">
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Hub</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Outcome</th>
              <th className="text-left p-2">Lead</th>
              <th className="text-left p-2">Target</th>
              <th className="text-left p-2">Dates</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-slate-500 text-xs">no projects match filters</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="p-2 mono text-slate-200">
                  <button onClick={() => setViewing(p)} className="hover:text-accent text-left">
                    {p.name}
                  </button>
                </td>
                <td className="p-2">{p.project_type}</td>
                <td className="p-2">{p.campaign_hub}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono
                    ${p.status === "open" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-2">
                  <span className={`text-[10px] mono
                    ${p.outcome === "Success" ? "text-emerald-400"
                      : p.outcome === "Partial" ? "text-amber-400"
                      : p.outcome === "Blocked" ? "text-rose-400"
                      : p.outcome === "Abandoned" ? "text-slate-400"
                      : "text-sky-400"}`}>
                    {p.outcome}
                  </span>
                </td>
                <td className="p-2 text-slate-300">{p.project_lead || "—"}</td>
                <td className="p-2 text-slate-400 truncate max-w-[160px]">
                  {(p.target_vendor || p.target_product)
                    ? `${p.target_vendor} ${p.target_product}`.trim()
                    : "—"}
                </td>
                <td className="p-2 mono text-slate-500 whitespace-nowrap">
                  {fmtDate(p.start_date)}{p.end_date ? " → " + fmtDate(p.end_date) : ""}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  <IconAction title="View" onClick={() => setViewing(p)}><Eye size={12}/></IconAction>
                  <IconAction title="Edit" onClick={() => setEditing(p)}><Pencil size={12}/></IconAction>
                  {p.status === "open" ? (
                    <button onClick={() => setClosing(p)} className="text-magenta hover:underline ml-2 mr-2 text-[11px]">
                      Close
                    </button>
                  ) : (
                    <button onClick={() => reopen(p)} className="text-accent hover:underline ml-2 mr-2 text-[11px]">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => del(p)} className="text-red-400 hover:underline text-[11px]">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNew && <NewProjectForm onClose={() => setShowNew(false)} onSaved={refresh} />}
      {closing && <CloseProjectForm project={closing} onClose={() => setClosing(null)} onSaved={refresh} />}
      {editing && <EditProjectForm project={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {viewing && <ProjectDetail project={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}


function IconAction({ title, onClick, children }: {
  title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button title={title} onClick={onClick}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-slate-400 hover:text-accent hover:bg-white/[0.04]">
      {children}
    </button>
  );
}


function AppearanceAdmin() {
  const [form, setForm] = useState({
    classification_level: "OFFICIAL",
    classification_text: "OFFICIAL",
    about_team: "",
    app_title: "",
    team_name: "",
    label_campaigns: "Campaigns",
    label_campaign: "Campaign",
    label_equities: "HS Equities",
    footer_heading: "About the Team",
    footer_tagline: "Internal Use",
    footer_link_1_label: "The Team Front Door",
    footer_link_1_url: "",
    footer_link_1_description: "",
    footer_link_2_label: "Cyber Research Team Confluence",
    footer_link_2_url: "",
    footer_link_2_description: "",
    footer_link_3_label: "O3 Confluence Page",
    footer_link_3_url: "",
    footer_link_3_description: "",
    team_email: "",
    team_email_subject: "Cyber Research Team enquiry",
    team_email_description: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { api.get<any>("/api/settings/public").then((s) => setForm(s)); }, []);

  async function save() {
    setBusy(true); setMsg(null);
    try { await api.post("/api/settings/update", form); setMsg("Saved"); location.reload(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function upload(kind: "team-logo" | "hero-logo", file: File) {
    try {
      await api.upload(`/api/settings/upload/${kind}`, file);
      setMsg("Uploaded");
      // Reload to pick up the new image: the <img> src is the stable path
      // `/api/settings/asset/{kind}` so the browser would otherwise keep
      // showing the cached old copy. The top-level App appends a cache-bust
      // query on every page load, so a full reload is the reliable way to
      // force every consumer of that URL to refetch.
      location.reload();
    }
    catch (e: any) { setMsg(e.message); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs text-slate-400 mb-1">App Title</label>
        <input value={form.app_title} onChange={(e) => setForm({ ...form, app_title: e.target.value })}
               className={ic} />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Team Name</label>
        <input value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })}
               className={ic} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Campaigns Label — plural <span className="text-slate-500">(e.g. Campaigns, Mission Areas)</span>
          </label>
          <input value={form.label_campaigns}
                 onChange={(e) => setForm({ ...form, label_campaigns: e.target.value })}
                 placeholder="Campaigns" className={ic} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Campaigns Label — singular
          </label>
          <input value={form.label_campaign}
                 onChange={(e) => setForm({ ...form, label_campaign: e.target.value })}
                 placeholder="Campaign" className={ic} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">
          "HS Equities" Label <span className="text-slate-500">(used on KPI cards, charts, and project forms)</span>
        </label>
        <input value={form.label_equities}
               onChange={(e) => setForm({ ...form, label_equities: e.target.value })}
               placeholder="HS Equities" className={ic} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Classification Level <span className="text-slate-500">(drives the banner colour)</span>
          </label>
          <input list="_class-levels" value={form.classification_level}
                 onChange={(e) => setForm({ ...form, classification_level: e.target.value })}
                 className={ic}
                 placeholder="OFFICIAL" />
          <datalist id="_class-levels">
            <option value="OFFICIAL"/>
            <option value="OFFICIAL-SENSITIVE"/>
            <option value="SECRET"/>
            <option value="TOP SECRET"/>
          </datalist>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Free text — standard values get coloured; anything custom renders neutral.
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Banner Text <span className="text-slate-500">(what actually displays — leave blank to use level)</span>
          </label>
          <input value={form.classification_text}
                 onChange={(e) => setForm({ ...form, classification_text: e.target.value })}
                 placeholder="(same as level)"
                 className={ic} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">About the Team</label>
        <textarea rows={5} value={form.about_team}
                  onChange={(e) => setForm({ ...form, about_team: e.target.value })}
                  className={ic} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FileUploadBox label="Team Logo (top bar)" onFile={(f) => upload("team-logo", f)} />
        <FileUploadBox label="Hero Logo (large)" onFile={(f) => upload("hero-logo", f)} />
      </div>

      {/* Footer heading + tagline + link slots + team email — all editable */}
      <div className="pt-4 border-t border-white/5">
        <div className="sect-head mb-3">About-the-Team Footer</div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Footer heading <span className="text-slate-500">(section title)</span>
            </label>
            <input value={form.footer_heading}
                   onChange={(e) => setForm({ ...form, footer_heading: e.target.value })}
                   placeholder="About the Team" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Tagline <span className="text-slate-500">(after team name in the status strip)</span>
            </label>
            <input value={form.footer_tagline}
                   onChange={(e) => setForm({ ...form, footer_tagline: e.target.value })}
                   placeholder="Internal Use" className={ic} />
          </div>
        </div>

        {[1, 2, 3].map((i) => {
          const labelKey = `footer_link_${i}_label` as keyof typeof form;
          const urlKey = `footer_link_${i}_url` as keyof typeof form;
          const descKey = `footer_link_${i}_description` as keyof typeof form;
          return (
            <div key={i} className="panel rounded-md p-3 mb-3 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Footer card {i}
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Label</label>
                  <input value={form[labelKey] as string}
                         onChange={(e) => setForm({ ...form, [labelKey]: e.target.value })}
                         className={ic} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">URL <span className="text-slate-500">(blank = "not set" state)</span></label>
                  <input type="url" value={form[urlKey] as string}
                         onChange={(e) => setForm({ ...form, [urlKey]: e.target.value })}
                         placeholder="https://…" className={ic} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Description <span className="text-slate-500">(shown underneath the label on the card)</span>
                </label>
                <input value={form[descKey] as string}
                       onChange={(e) => setForm({ ...form, [descKey]: e.target.value })}
                       placeholder="Why would someone click this?"
                       className={ic} />
              </div>
            </div>
          );
        })}

        <div className="panel rounded-md p-3 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Email Us card
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Team email address</label>
              <input type="email" value={form.team_email}
                     onChange={(e) => setForm({ ...form, team_email: e.target.value })}
                     placeholder="cyber-research@your-domain.internal"
                     className={ic} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Default subject line</label>
              <input value={form.team_email_subject}
                     onChange={(e) => setForm({ ...form, team_email_subject: e.target.value })}
                     placeholder="Cyber Research Team enquiry"
                     className={ic} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <input value={form.team_email_description}
                   onChange={(e) => setForm({ ...form, team_email_description: e.target.value })}
                   placeholder="When should someone click this?"
                   className={ic} />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Button appears only when an email address is set. Opens the user's default mail client
            (Outlook, Mail, etc.) with the subject pre-filled.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={busy} onClick={save} className={bp}>{busy ? "…" : "Save Settings"}</button>
        {msg && <span className="text-xs text-slate-400">{msg}</span>}
      </div>
    </div>
  );
}


type ProviderName = "openai" | "litellm" | "anthropic" | "gemini";

const PROVIDER_META: Record<ProviderName, {
  label: string; hint: string; defaultUrl: string;
  requiresKey: boolean; showBaseUrl: boolean; showCertPath: boolean;
}> = {
  openai:    { label: "OpenAI-compatible", hint: "OpenAI, OpenWebUI, Ollama, vLLM, LM Studio, llama.cpp server",
               defaultUrl: "https://api.openai.com", requiresKey: false, showBaseUrl: true, showCertPath: true },
  litellm:   { label: "LiteLLM Proxy",     hint: "Dedicated LiteLLM proxy endpoint",
               defaultUrl: "http://localhost:4000",  requiresKey: false, showBaseUrl: true, showCertPath: true },
  anthropic: { label: "Anthropic",         hint: "Claude via api.anthropic.com or internal gateway",
               defaultUrl: "https://api.anthropic.com", requiresKey: true, showBaseUrl: true, showCertPath: true },
  gemini:    { label: "Google Gemini",     hint: "Google Generative Language API",
               defaultUrl: "https://generativelanguage.googleapis.com", requiresKey: true, showBaseUrl: true, showCertPath: true },
};

const MAX_TOKEN_OPTIONS = [
  { v: 16384,   label: "16K" },
  { v: 32768,   label: "32K" },
  { v: 65536,   label: "64K" },
  { v: 100000,  label: "100K" },
  { v: 128000,  label: "128K" },
  { v: 160000,  label: "160K" },
  { v: 200000,  label: "200K" },
  { v: 250000,  label: "250K" },
  { v: 500000,  label: "500K" },
  { v: 700000,  label: "700K" },
  { v: 1000000, label: "1M" },
];

type LLMFormState = {
  enabled: boolean;
  provider: ProviderName;
  model: string;
  max_tokens: number;
  per: Record<ProviderName, { base_url: string; api_key: string; cert_path: string; key_set: boolean }>;
};

const EMPTY_PROVIDER_CREDS = { base_url: "", api_key: "", cert_path: "", key_set: false };

function LLMAdmin() {
  const [form, setForm] = useState<LLMFormState>({
    enabled: false,
    provider: "openai",
    model: "",
    max_tokens: 16384,
    per: {
      openai: { ...EMPTY_PROVIDER_CREDS },
      litellm: { ...EMPTY_PROVIDER_CREDS },
      anthropic: { ...EMPTY_PROVIDER_CREDS },
      gemini: { ...EMPTY_PROVIDER_CREDS },
    },
  });
  const [detected, setDetected] = useState<string[] | null>(null);
  const [detectErr, setDetectErr] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Per-provider test state: "…" while in-flight, "ok" / "fail: reason" once done.
  // Keyed by provider name so one TEST button doesn't stomp another.
  const [testState, setTestState] = useState<Record<ProviderName, string | null>>({
    openai: null, litellm: null, anthropic: null, gemini: null,
  });

  async function load() {
    const s = await api.get<any>("/api/settings/all");
    const per: LLMFormState["per"] = { ...form.per };
    for (const p of Object.keys(PROVIDER_META) as ProviderName[]) {
      per[p] = {
        base_url: s[`llm_${p}_base_url`] || "",
        api_key: "",
        cert_path: s[`llm_${p}_cert_path`] || "",
        key_set: !!s[`llm_${p}_api_key_set`],
      };
    }
    setForm({
      enabled: String(s.llm_enabled) === "true",
      provider: (s.llm_provider || "openai") as ProviderName,
      model: s.llm_model || "",
      max_tokens: +(s.llm_max_tokens || 16384),
      per,
    });
    setDetected(null); setDetectErr(null);
  }
  useEffect(() => { load(); }, []);

  const p = form.per[form.provider];
  const meta = PROVIDER_META[form.provider];

  function patchPer(field: "base_url" | "api_key" | "cert_path", value: string) {
    setForm((f) => ({
      ...f,
      per: { ...f.per, [f.provider]: { ...f.per[f.provider], [field]: value } },
    }));
  }

  async function detect() {
    setDetecting(true); setDetectErr(null); setDetected(null);
    try {
      const body: any = { provider: form.provider };
      if (p.base_url) body.base_url = p.base_url;
      if (p.cert_path) body.cert_path = p.cert_path;
      if (p.api_key) body.api_key = p.api_key;
      const res = await api.post<{ models: string[] }>("/api/llm/models", body);
      setDetected(res.models);
    } catch (e: any) {
      setDetectErr(e.message);
    } finally {
      setDetecting(false);
    }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const payload: any = {
        llm_enabled: String(form.enabled),
        llm_provider: form.provider,
        llm_model: form.model,
        llm_max_tokens: String(form.max_tokens),
      };
      for (const pn of Object.keys(PROVIDER_META) as ProviderName[]) {
        payload[`llm_${pn}_base_url`] = form.per[pn].base_url;
        payload[`llm_${pn}_cert_path`] = form.per[pn].cert_path;
        // empty string -> server preserves existing; actual new value overwrites
        if (form.per[pn].api_key) payload[`llm_${pn}_api_key`] = form.per[pn].api_key;
      }
      await api.post("/api/settings/update", payload);
      setMsg("Saved");
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    if (!confirm(`Clear the saved API key for ${meta.label}?`)) return;
    try {
      await api.post("/api/settings/update", { [`llm_${form.provider}_api_key`]: "__clear__" });
      await load();
      setMsg("Key cleared");
    } catch (e: any) { setMsg(e.message); }
  }

  async function testProvider(pn: ProviderName) {
    // Uses the currently-saved config for this provider. The test endpoint
    // accepts overrides, but here we deliberately test what's actually
    // persisted so the answer matches what chat() will do at runtime.
    setTestState((s) => ({ ...s, [pn]: "…" }));
    try {
      const res = await api.post<{ ok: boolean; error?: string; reply_preview?: string }>(
        "/api/llm/test", { provider: pn }
      );
      setTestState((s) => ({
        ...s,
        [pn]: res.ok ? "ok" : `fail: ${res.error || "unknown"}`,
      }));
    } catch (e: any) {
      setTestState((s) => ({ ...s, [pn]: `fail: ${e.message}` }));
    }
  }

  // A provider counts as "saved/configured" if ANY of its credential fields
  // are filled in. We don't require a key because some self-hosted endpoints
  // legitimately run without auth.
  function isConfigured(pn: ProviderName): boolean {
    const pp = form.per[pn];
    return !!(pp.base_url || pp.key_set || pp.cert_path);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Provider selector */}
      <div>
        <div className="sect-head mb-2">Provider</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.keys(PROVIDER_META) as ProviderName[]).map((pn) => {
            const active = pn === form.provider;
            return (
              <button key={pn} onClick={() => { setForm((f) => ({ ...f, provider: pn })); setDetected(null); setDetectErr(null); }}
                className={`relative p-3 text-left border transition-colors
                  ${active
                    ? "bg-accent/10 border-accent/50"
                    : "bg-bg0 border-white/10 hover:border-white/25"}`}>
                <div className={`text-xs font-mono uppercase tracking-wider mb-1
                                 ${active ? "text-accent" : "text-slate-200"}`}>
                  {PROVIDER_META[pn].label}
                </div>
                <div className="text-[10px] font-mono text-slate-500 leading-snug">
                  {PROVIDER_META[pn].hint}
                </div>
                {form.per[pn].key_set && (
                  <div className="absolute top-2 right-2 text-[9px] font-mono text-emerald-400">•KEY</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Provider-specific config */}
      <div>
        <div className="sect-head mb-2">
          Endpoint — <span className="text-accent/70">{meta.label}</span>
        </div>
        <div className="space-y-3">
          {meta.showBaseUrl && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
                Base URL
              </label>
              <input placeholder={meta.defaultUrl}
                     value={p.base_url}
                     onChange={(e) => patchPer("base_url", e.target.value)}
                     className={ic} />
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                Leave blank to use default. Override for internal proxies / air-gapped endpoints.
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
              API Key {p.key_set && <span className="text-emerald-400 normal-case">· currently set</span>}
            </label>
            <div className="flex gap-2">
              <input type="password"
                     placeholder={p.key_set ? "•••••••• (leave blank to keep existing)" : (meta.requiresKey ? "required" : "optional for self-hosted")}
                     value={p.api_key}
                     onChange={(e) => patchPer("api_key", e.target.value)}
                     className={ic + " flex-1"} />
              {p.key_set && (
                <button type="button" onClick={clearKey}
                        className="px-3 text-[11px] font-mono text-rose-400 border border-rose-500/30 hover:bg-rose-500/10">
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {meta.showCertPath && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
                CA Certificate Path (optional)
              </label>
              <input placeholder="/etc/ssl/certs/internal-ca.pem"
                     value={p.cert_path}
                     onChange={(e) => patchPer("cert_path", e.target.value)}
                     className={ic} />
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                Path on the backend host to a PEM CA bundle. Required when the endpoint
                uses a private/internal CA. Leave blank to use system trust store.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model + max tokens */}
      <div>
        <div className="sect-head mb-2">Completion</div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
              Model
            </label>
            <div className="flex gap-2">
              <input value={form.model}
                     onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                     placeholder={form.provider === "anthropic" ? "claude-sonnet-4-6"
                                : form.provider === "gemini"    ? "gemini-2.5-pro"
                                : form.provider === "litellm"   ? "openai/gpt-4o-mini"
                                : "gpt-4o-mini"}
                     list="_detected-models"
                     className={ic + " flex-1"} />
              <button type="button" onClick={detect} disabled={detecting}
                      className="px-3 text-[11px] font-mono text-accent border border-accent/40 hover:bg-accent/10 disabled:opacity-40">
                {detecting ? "…" : "DETECT"}
              </button>
              <datalist id="_detected-models">
                {(detected || []).map((m) => <option key={m} value={m}/>)}
              </datalist>
            </div>
            {detected && (
              <DetectedModelList
                models={detected}
                selected={form.model}
                onSelect={(m) => {
                  setForm((f) => ({ ...f, model: m }));
                  setDetected(null);  // collapse list once a model is picked
                }} />
            )}
            {detectErr && (
              <div className="mt-2 text-[10px] font-mono text-rose-400">
                detect failed: {detectErr}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
              Max Completion Tokens
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MAX_TOKEN_OPTIONS.map((o) => {
                const active = form.max_tokens === o.v;
                return (
                  <button key={o.v} type="button"
                          onClick={() => setForm((f) => ({ ...f, max_tokens: o.v }))}
                          className={`px-2.5 py-1 text-[11px] font-mono border
                            ${active
                              ? "bg-accent/15 border-accent/50 text-accent"
                              : "bg-bg0 border-white/10 text-slate-400 hover:border-white/30"}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              Actual cap depends on the model (e.g. Claude ~64K, Gemini ~8K, OpenAI ~16K).
              Values above the model's limit will be rejected by the provider.
            </div>
          </div>
        </div>
      </div>

      {/* Enable */}
      <div className="border-t border-white/5 pt-4">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={form.enabled}
                 onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                 className="accent-cyan-400" />
          <span className="font-mono uppercase tracking-wider text-slate-200 text-[12px]">
            Enable Assistant
          </span>
        </label>
        <div className="text-[10px] text-slate-500 mt-1 font-mono ml-7">
          When disabled, the chat panel shows an offline notice; no outbound calls are made.
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button disabled={busy} onClick={save} className={bp}>{busy ? "…" : "Save"}</button>
        {msg && <span className="text-xs font-mono text-slate-400">{msg}</span>}
      </div>

      {/* Saved configurations — one row per provider that has anything saved.
          Each row has a TEST button that fires a 1-token round-trip against
          the persisted config, so the admin can confirm connectivity without
          going into the chat panel. */}
      <div className="border-t border-white/5 pt-5">
        <div className="sect-head mb-2">Saved Configurations</div>
        <div className="text-[10px] text-slate-500 mb-3 font-mono">
          Only providers with saved credentials appear below. TEST sends a tiny
          ping to confirm the endpoint, auth, and the currently-selected model
          all work together.
        </div>
        {(Object.keys(PROVIDER_META) as ProviderName[]).filter(isConfigured).length === 0 ? (
          <div className="text-[11px] font-mono text-slate-500 border border-dashed border-white/10 px-3 py-4 text-center">
            No providers saved yet. Fill in the fields above and hit Save.
          </div>
        ) : (
          <div className="space-y-2">
            {(Object.keys(PROVIDER_META) as ProviderName[])
              .filter(isConfigured)
              .map((pn) => {
                const pp = form.per[pn];
                const pm = PROVIDER_META[pn];
                const tst = testState[pn];
                const isActive = form.provider === pn;
                const testing = tst === "…";
                const ok = tst === "ok";
                const failed = typeof tst === "string" && tst.startsWith("fail:");
                return (
                  <div key={pn}
                       className={`flex items-center gap-3 px-3 py-2 border text-[11px] font-mono
                         ${isActive ? "border-accent/40 bg-accent/[0.04]" : "border-white/10 bg-bg0"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`uppercase tracking-wider ${isActive ? "text-accent" : "text-slate-200"}`}>
                          {pm.label}
                        </span>
                        {isActive && <span className="text-[9px] text-accent/70">[ACTIVE]</span>}
                        {pp.key_set && <span className="text-[9px] text-emerald-400">·KEY</span>}
                        {pp.cert_path && <span className="text-[9px] text-sky-400">·CERT</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5" title={pp.base_url || pm.defaultUrl}>
                        {pp.base_url || pm.defaultUrl}
                      </div>
                      {failed && (
                        <div className="text-[10px] text-rose-400 mt-1 break-all">
                          {tst!.slice(6).trim()}
                        </div>
                      )}
                      {ok && (
                        <div className="text-[10px] text-emerald-400 mt-1">
                          round-trip ok
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => testProvider(pn)} disabled={testing}
                            className={`px-3 py-1 border tracking-wider uppercase disabled:opacity-40
                              ${ok
                                ? "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                : failed
                                  ? "border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
                                  : "border-accent/40 text-accent hover:bg-accent/10"}`}>
                      {testing ? "…" : ok ? "OK · RETEST" : failed ? "RETEST" : "TEST"}
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}


/** Scrollable, selectable list of detected model IDs. Has a filter box at
 *  the top and a full-height scroll container below. Each row is a
 *  clickable full-width button, highlighted when it matches the currently
 *  configured model. */
function DetectedModelList({ models, selected, onSelect }: {
  models: string[];
  selected: string;
  onSelect: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return models;
    return models.filter((m) => m.toLowerCase().includes(s));
  }, [models, q]);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
        <span className="text-slate-500">
          <span className="text-accent/80">{models.length}</span> model{models.length === 1 ? "" : "s"} detected
          {q && filtered.length !== models.length && (
            <span className="text-slate-600"> · {filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
          )}
        </span>
        {selected && models.includes(selected) && (
          <span className="text-accent/70 truncate max-w-[60%]" title={selected}>
            selected · {selected}
          </span>
        )}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)}
             placeholder="filter models…"
             className="w-full bg-bg0 border border-white/10 rounded-t-md px-2.5 py-1.5
                        text-xs outline-none focus:border-accent/50 border-b-0" />

      <div className="panel-solid rounded-b-md max-h-60 overflow-auto border-t border-white/5"
           style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {filtered.length === 0 ? (
          <div className="text-xs text-slate-500 mono py-6 text-center">no matches</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((m) => {
              const isSel = m === selected;
              return (
                <li key={m}>
                  <button type="button"
                          onClick={() => onSelect(m)}
                          className={`w-full text-left px-3 py-1.5 text-xs mono flex items-center gap-2
                            ${isSel
                              ? "bg-accent/15 text-accent"
                              : "text-slate-200 hover:bg-white/[0.03] hover:text-accent"}`}>
                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full
                      ${isSel ? "bg-accent" : "bg-white/10"}`}/>
                    <span className="truncate">{m}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}


function CatalogsAdmin() {
  const { catalogs, refreshCatalogs } = useData();
  const [draft, setDraft] = useState<Catalogs>(catalogs);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState<keyof Catalogs>("project_types");

  useEffect(() => {
    // Sync when context reloads catalogs (e.g. after save)
    setDraft(catalogs); setDirty(false);
  }, [catalogs]);

  const LABELS: Record<keyof Catalogs, string> = {
    project_types: "Project Types",
    target_technologies: "Target Technologies",
    hubs: "Campaigns",
    technologies: "Technologies",
    tools: "Tools",
    os: "Operating Systems",
    languages: "Languages",
    architectures: "CPU Architectures",
    collaborators: "Collaborators",
    customers: "End Customers",
    outcomes: "Outcomes",
  };

  const items = draft[active] || [];

  function updateActive(newList: string[]) {
    setDraft({ ...draft, [active]: newList });
    setDirty(true);
  }

  function addItem(raw: string) {
    const s = raw.trim();
    if (!s) return;
    if (items.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    updateActive([...items, s]);
  }

  function removeItem(v: string) {
    updateActive(items.filter((x) => x !== v));
  }

  function moveItem(v: string, dir: -1 | 1) {
    const idx = items.indexOf(v);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[to]] = [copy[to], copy[idx]];
    updateActive(copy);
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      await api.post("/api/settings/catalogs", { catalogs: draft });
      await refreshCatalogs();
      setMsg("Saved");
      setDirty(false);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-xs text-slate-400 font-mono">
        Edit the lists used for autocomplete in the project form. Write-ins in
        the project form are always accepted — catalogs are just suggestions.
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATALOG_NAMES.map((name) => {
          const on = name === active;
          const n = (draft[name] || []).length;
          return (
            <button key={name} onClick={() => setActive(name)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono border
                ${on ? "bg-accent/15 border-accent/40 text-accent"
                     : "bg-bg0 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/30"}`}>
              <ListTree size={11}/>{LABELS[name]}
              <span className="text-slate-500">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="panel p-4 space-y-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-accent/80">
          {LABELS[active]} <span className="text-slate-500">· {items.length}</span>
        </div>
        <CatalogEditor items={items}
                       onAdd={addItem} onRemove={removeItem} onMove={moveItem} />
      </div>

      <div className="flex items-center gap-3">
        <button disabled={busy || !dirty} onClick={save} className={bp}>
          {busy ? "…" : "Save Catalogs"}
        </button>
        {dirty && !busy && <span className="text-[11px] text-amber-400 font-mono">unsaved changes</span>}
        {msg && <span className="text-xs text-slate-400 font-mono">{msg}</span>}
      </div>
    </div>
  );
}


function CatalogEditor({ items, onAdd, onRemove, onMove }: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onMove: (v: string, dir: -1 | 1) => void;
}) {
  const [q, setQ] = useState("");
  return (
    <div className="space-y-2">
      <form onSubmit={(e) => { e.preventDefault(); onAdd(q); setQ(""); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="add new entry…"
               className="flex-1 bg-bg0 border border-white/10 rounded-md px-3 py-1.5 text-xs outline-none focus:border-accent/50"/>
        <button className="px-3 py-1.5 text-[11px] font-mono text-accent border border-accent/40 hover:bg-accent/10">
          ADD
        </button>
      </form>
      {items.length === 0 ? (
        <div className="text-xs text-slate-500 py-2 text-center font-mono">empty</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((v) => (
            <span key={v}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]
                             bg-accent/10 border border-accent/30 text-accent font-mono">
              <button type="button" onClick={() => onMove(v, -1)}
                      title="move up" className="text-slate-500 hover:text-accent">‹</button>
              <span>{v}</span>
              <button type="button" onClick={() => onMove(v, +1)}
                      title="move down" className="text-slate-500 hover:text-accent">›</button>
              <button type="button" onClick={() => onRemove(v)}
                      title="remove" className="text-slate-500 hover:text-rose-400 ml-0.5">
                <X size={10}/>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  // Only admins are created here. Anyone without an account can already view
  // the site as an anonymous viewer, so a "viewer" user role is redundant.
  const [form, setForm] = useState({ username: "", password: "", role: "admin" });
  const [err, setErr] = useState<string | null>(null);

  async function load() { setUsers(await api.get<User[]>("/api/users")); }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try { await api.post("/api/users", { ...form, role: "admin" });
          setForm({ username: "", password: "", role: "admin" }); load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function del(u: User) {
    if (!confirm(`Delete user ${u.username}?`)) return;
    try { await api.del(`/api/users/${u.id}`); load(); } catch (e: any) { setErr(e.message); }
  }
  async function reset(u: User) {
    const np = prompt(`New password for ${u.username}:`);
    if (!np) return;
    try { await api.post(`/api/users/${u.id}/password`, { new_password: np }); } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-3 panel rounded-md">
            <div>
              <div className="mono text-sm text-slate-100">{u.username}</div>
              <div className="text-xs text-slate-500">{u.role}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => reset(u)} className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/30">
                <KeyRound size={12}/> Reset
              </button>
              <button onClick={() => del(u)} className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Trash2 size={12}/> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={create} className="panel rounded-md p-3 space-y-2">
        <h4 className="text-xs uppercase text-slate-400 tracking-wider">Add Admin</h4>
        <div className="text-[11px] text-slate-500 font-mono -mt-1 mb-1">
          Everyone can view the site without logging in — an account is only
          needed to manage projects and settings, so new users are always admins.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="username" value={form.username}
                 onChange={(e) => setForm({ ...form, username: e.target.value })} className={ic} />
          <input placeholder="password" type="password" value={form.password}
                 onChange={(e) => setForm({ ...form, password: e.target.value })} className={ic} />
        </div>
        {err && <div className="text-xs text-red-400">{err}</div>}
        <button className={bp + " w-fit"}>Create</button>
      </form>
    </div>
  );
}


function FileUploadBox({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  return (
    <label className="panel rounded-md p-4 cursor-pointer hover:border-accent/40 border border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-2">
      <Upload size={18} className="text-slate-400" />
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-[10px] text-slate-500 font-mono">Click to upload PNG / SVG / JPG</div>
      <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp"
             onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}


const ic = "w-full bg-bg0 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-accent/50";
const bp = "px-4 py-2 rounded-md bg-accent/20 border border-accent/50 text-accent hover:bg-accent/30 text-sm font-semibold disabled:opacity-50";
