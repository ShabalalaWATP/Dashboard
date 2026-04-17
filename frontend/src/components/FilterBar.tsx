import { useMemo, useState, useRef, useEffect } from "react";
import { Filter, X, Search, ChevronDown, Calendar } from "lucide-react";
import { useData } from "../filters";
import type { FilterState, PublicSettings } from "../types";
import { fmtDate } from "../dates";


export function FilterBar({ settings }: { settings?: PublicSettings }) {
  const { filters, patchFilter, toggleFilter, resetFilters, allProjects, filtered, activeFilterCount } = useData();
  const campaignsLabel = settings?.label_campaigns || "Campaigns";

  const options = useMemo(() => {
    const uniq = <K extends keyof typeof allProjects[number]>(k: K) =>
      Array.from(new Set(allProjects.map((p) => p[k] as unknown as string).filter(Boolean))).sort();
    const uniqMulti = (k: "technologies" | "tools" | "tags" | "collaborators" | "languages") =>
      Array.from(new Set(allProjects.flatMap((p) => p[k]).filter(Boolean))).sort();
    return {
      hubs: uniq("campaign_hub"),
      types: uniq("project_type"),
      outcomes: ["In Progress", "Success", "Partial", "Blocked", "Abandoned"],
      customers: uniq("end_customer"),
      technologies: uniqMulti("technologies"),
      tools: uniqMulti("tools"),
      collaborators: uniqMulti("collaborators"),
      languages: uniqMulti("languages"),
      architectures: uniq("cpu_arch"),
      tags: uniqMulti("tags"),
    };
  }, [allProjects]);

  return (
    <div className="panel-solid p-3 flex flex-wrap items-center gap-2">
      <Filter size={12} className="text-accent ml-1" />
      <span className="text-[10px] uppercase tracking-[0.22em] text-accent/70 font-mono mr-1">
        FILTER
      </span>

      <div className="relative flex-1 min-w-[200px] max-w-[360px]">
        <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
        <input placeholder="Search name, vendor, tech, tools, tags…"
               value={filters.search}
               onChange={(e) => patchFilter("search", e.target.value)}
               className="w-full bg-bg0 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs
                          outline-none focus:border-accent/50" />
      </div>

      <StatusPill value={filters.status}
                  onChange={(v) => patchFilter("status", v)} />

      <Multi label={campaignsLabel} options={options.hubs}
             selected={filters.hubs} onToggle={(v) => toggleFilter("hubs", v)} />
      <Multi label="Types" options={options.types}
             selected={filters.types} onToggle={(v) => toggleFilter("types", v)} />
      <Multi label="Outcome" options={options.outcomes}
             selected={filters.outcomes} onToggle={(v) => toggleFilter("outcomes", v)} />
      <Multi label="Tech" options={options.technologies}
             selected={filters.technologies} onToggle={(v) => toggleFilter("technologies", v)}
             searchable />
      <Multi label="Tools" options={options.tools}
             selected={filters.tools} onToggle={(v) => toggleFilter("tools", v)}
             searchable />
      <Multi label="Languages" options={options.languages}
             selected={filters.languages} onToggle={(v) => toggleFilter("languages", v)} />
      <Multi label="Arch" options={options.architectures}
             selected={filters.architectures} onToggle={(v) => toggleFilter("architectures", v)} />
      <Multi label="Customer" options={options.customers}
             selected={filters.customers} onToggle={(v) => toggleFilter("customers", v)} />
      <Multi label="Collabs" options={options.collaborators}
             selected={filters.collaborators} onToggle={(v) => toggleFilter("collaborators", v)} />
      <Multi label="Tags" options={options.tags}
             selected={filters.tags} onToggle={(v) => toggleFilter("tags", v)} searchable />

      <DateRange filters={filters} onChange={patchFilter} />

      <div className="flex-1" />

      <span className="text-[11px] mono text-slate-500 whitespace-nowrap">
        {filtered.length} / {allProjects.length} projects
      </span>

      {activeFilterCount > 0 && (
        <button onClick={resetFilters}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-accent
                           border border-white/10 hover:border-accent/40 rounded-md px-2 py-1">
          <X size={11}/> Clear ({activeFilterCount})
        </button>
      )}
    </div>
  );
}


function StatusPill({ value, onChange }: {
  value: FilterState["status"]; onChange: (v: FilterState["status"]) => void;
}) {
  const opts: { v: FilterState["status"]; label: string }[] = [
    { v: "all", label: "All" },
    { v: "open", label: "Open" },
    { v: "closed", label: "Closed" },
  ];
  return (
    <div className="flex rounded-md border border-white/10 overflow-hidden text-[11px]">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 ${value === o.v
            ? "bg-accent/20 text-accent"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}


function Multi({ label, options, selected, onToggle, searchable }: {
  label: string; options: string[]; selected: string[];
  onToggle: (v: string) => void; searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = searchable && q
    ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
    : options;

  const hasSelection = selected.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border
          ${hasSelection
            ? "bg-accent/15 border-accent/40 text-accent"
            : "bg-bg0 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/30"}`}>
        {label}
        {hasSelection && (
          <span className="mono bg-accent/20 rounded px-1 text-[9px]">{selected.length}</span>
        )}
        <ChevronDown size={10}/>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 panel rounded-md p-2 min-w-[200px] max-w-[260px] z-40 shadow-lg">
          {searchable && (
            <input autoFocus placeholder="type to filter…"
                   value={q} onChange={(e) => setQ(e.target.value)}
                   className="w-full mb-2 bg-bg0 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-accent/50"/>
          )}
          <div className="max-h-60 overflow-auto space-y-0.5">
            {filtered.length === 0 && <div className="text-xs text-slate-500 py-1">no matches</div>}
            {filtered.map((o) => {
              const sel = selected.includes(o);
              return (
                <label key={o} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.04] cursor-pointer text-xs">
                  <input type="checkbox" checked={sel} onChange={() => onToggle(o)}
                         className="accent-cyan-400" />
                  <span className={sel ? "text-slate-100" : "text-slate-300"}>{o}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function DateRange({ filters, onChange }: {
  filters: FilterState;
  onChange: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = !!(filters.date_from || filters.date_to);
  const label = active
    ? `${filters.date_from ? fmtDate(filters.date_from) : "…"} → ${filters.date_to ? fmtDate(filters.date_to) : "…"}`
    : "Date range";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border
          ${active ? "bg-accent/15 border-accent/40 text-accent"
                  : "bg-bg0 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/30"}`}>
        <Calendar size={11}/>{label}<ChevronDown size={10}/>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 panel rounded-md p-3 z-40 shadow-lg w-[280px] space-y-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">From</label>
            <input type="date" value={filters.date_from || ""}
                   onChange={(e) => onChange("date_from", e.target.value || null)}
                   className="w-full bg-bg0 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-accent/50" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">To</label>
            <input type="date" value={filters.date_to || ""}
                   onChange={(e) => onChange("date_to", e.target.value || null)}
                   className="w-full bg-bg0 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-accent/50" />
          </div>
          {active && (
            <button onClick={() => { onChange("date_from", null); onChange("date_to", null); }}
                    className="w-full text-[11px] text-slate-400 hover:text-accent border border-white/10 rounded px-2 py-1 hover:border-accent/40">
              Clear date range
            </button>
          )}
        </div>
      )}
    </div>
  );
}
