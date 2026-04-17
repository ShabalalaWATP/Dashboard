import { useMemo, useState } from "react";
import type { Project } from "../../types";
import { STAGE_ORDER, stageColour } from "../../stagePalette";
import { fmtMonthYear } from "../../dates";


const HUB_COLOR: Record<string, string> = {
  Russia: "#22d3ee",
  China:  "#e879f9",
  Iran:   "#fbbf24",
  CT:     "#a78bfa",
  SOC:    "#34d399",
};

const TYPE_COLOR: Record<string, string> = {
  "Vulnerability Research": "#22d3ee",
  "Reverse Engineering":    "#e879f9",
  "Research":               "#a78bfa",
  "Software Engineering":   "#34d399",
};

const OUTCOME_COLOR: Record<string, string> = {
  "In Progress": "#38bdf8",
  "Success":     "#34d399",
  "Partial":     "#fbbf24",
  "Blocked":     "#f87171",
  "Abandoned":   "#94a3b8",
};


// Layout constants — chart renders at a fixed pixel-per-month zoom, which
// gives ~17px per week. Labels sit in a sticky left column so they stay
// visible while the timeline scrolls horizontally.
const LABEL_W  = 180;
const ROW_H    = 22;
const HEADER_H = 28;
const MAX_VIEWPORT_H = 640;      // vertical scroll triggers past this
const PX_PER_MONTH = 70;
const MS_PER_MONTH = 30.44 * 86400000;


export function GanttChart({
  projects, onOpen,
}: {
  projects: Project[];
  onOpen: (id: number) => void;
}) {
  const [colorBy, setColorBy] = useState<"stage" | "hub" | "type" | "outcome" | "status">("stage");

  const { rows, minT, maxT, months, chartW, chartH } = useMemo(() => {
    const today = new Date();
    let minT = Infinity;
    let maxT = -Infinity;
    const rows = projects.map((p) => {
      const s = new Date(p.start_date).getTime();
      const e = p.end_date ? new Date(p.end_date).getTime() : today.getTime();
      if (s < minT) minT = s;
      if (e > maxT) maxT = e;
      return { p, s, e };
    });
    if (rows.length === 0) {
      minT = today.getTime() - 365 * 86400000;
      maxT = today.getTime();
    }
    // Pad half a month on either side so bars don't hug the edges
    minT -= MS_PER_MONTH / 2;
    maxT += MS_PER_MONTH / 2;
    rows.sort((a, b) => a.s - b.s);

    const totalMonths = (maxT - minT) / MS_PER_MONTH;
    const chartW = Math.max(480, Math.ceil(totalMonths * PX_PER_MONTH));
    const chartH = HEADER_H + rows.length * ROW_H + 4;

    const ticks: { label: string; t: number }[] = [];
    const cursor = new Date(minT);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor.getTime() <= maxT) {
      ticks.push({
        label: fmtMonthYear(cursor.getTime()),
        t: cursor.getTime(),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return { rows, minT, maxT, months: ticks, chartW, chartH };
  }, [projects]);

  function xFor(t: number): number {
    return ((t - minT) / (maxT - minT)) * chartW;
  }

  function flatColour(p: Project): string {
    if (colorBy === "hub") return HUB_COLOR[p.campaign_hub] || "#22d3ee";
    if (colorBy === "type") return TYPE_COLOR[p.project_type] || "#22d3ee";
    if (colorBy === "outcome") return OUTCOME_COLOR[p.outcome] || "#22d3ee";
    return p.status === "open" ? "#34d399" : "#94a3b8";
  }

  /** Given a project, produce stage-proportioned segments in canonical order. */
  function stageSegments(p: Project) {
    const total = p.stages.reduce((acc, s) => acc + (s.days_spent || 0), 0);
    if (total <= 0) {
      return [{ name: "No stage data", days: 1, color: "#475569", fraction: 1 }];
    }
    const knownOrder = new Map<string, number>(
      (STAGE_ORDER as readonly string[]).map((s, i) => [s, i]),
    );
    return [...p.stages]
      .filter((x) => (x.days_spent || 0) > 0)
      .sort((a, b) => (knownOrder.get(a.stage_name) ?? 999) - (knownOrder.get(b.stage_name) ?? 999))
      .map((x) => ({
        name: x.stage_name,
        days: x.days_spent,
        color: stageColour(x.stage_name),
        fraction: x.days_spent / total,
      }));
  }

  const legend = useMemo(() => {
    if (colorBy === "stage") {
      const used = new Set<string>();
      for (const { p } of rows) {
        for (const s of p.stages) if (s.days_spent > 0) used.add(s.stage_name);
      }
      const ordered = (STAGE_ORDER as readonly string[]).filter((s) => used.has(s));
      const orphans = Array.from(used).filter((s) => !(STAGE_ORDER as readonly string[]).includes(s));
      return [...ordered, ...orphans].map((s) => [s, stageColour(s)] as [string, string]);
    }
    const m = new Map<string, string>();
    for (const { p } of rows) {
      const key = colorBy === "hub" ? p.campaign_hub
                : colorBy === "type" ? p.project_type
                : colorBy === "outcome" ? p.outcome
                : p.status;
      m.set(key, flatColour(p));
    }
    return Array.from(m.entries());
  }, [rows, colorBy]);

  if (rows.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no projects match current filters</div>;
  }

  const containerMaxH = Math.min(MAX_VIEWPORT_H, chartH + HEADER_H);

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-2 text-[11px]">
        <span className="text-slate-500 mr-1">colour by:</span>
        {(["stage", "hub", "type", "outcome", "status"] as const).map((v) => (
          <button key={v}
                  onClick={() => setColorBy(v)}
                  className={`px-2 py-1 rounded border font-mono
                    ${colorBy === v
                      ? "bg-accent/15 border-accent/40 text-accent"
                      : "bg-bg0 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/30"}`}>
            {v}
          </button>
        ))}
      </div>

      {/* Scroll container — horizontal for time range, vertical for many projects.
          Sticky left column keeps project names visible during horizontal pan. */}
      <div className="overflow-auto border border-white/10 rounded bg-bg0/50"
           style={{ maxHeight: containerMaxH }}>
        <div className="flex" style={{ width: LABEL_W + chartW }}>

          {/* Sticky project-name column */}
          <div className="sticky left-0 z-20 flex-shrink-0 bg-bg0 border-r border-white/10"
               style={{ width: LABEL_W }}>
            {/* Spacer aligning with month header */}
            <div className="border-b border-white/5 flex items-center justify-end pr-3 text-[9px] mono text-slate-600 uppercase tracking-widest"
                 style={{ height: HEADER_H }}>
              project
            </div>
            {rows.map(({ p }) => (
              <div key={p.id}
                   onClick={() => onOpen(p.id)}
                   title={p.name}
                   className="flex items-center justify-end pr-2 text-[10px] mono
                              text-slate-300 hover:text-accent hover:bg-white/[0.03]
                              border-b border-white/5 cursor-pointer truncate"
                   style={{ height: ROW_H }}>
                {p.name}
              </div>
            ))}
          </div>

          {/* Timeline SVG */}
          <svg width={chartW} height={chartH}
               className="flex-shrink-0"
               style={{ display: "block" }}>
            {/* Month gridlines + labels */}
            {months.map((m) => (
              <g key={m.t}>
                <line x1={xFor(m.t)} y1={HEADER_H}
                      x2={xFor(m.t)} y2={chartH}
                      stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <text x={xFor(m.t) + 4} y={18}
                      fontSize={10} fill="#6b7280" fontFamily="JetBrains Mono">
                  {m.label}
                </text>
              </g>
            ))}
            {/* Header divider */}
            <line x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H}
                  stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

            {/* Today marker */}
            <line x1={xFor(Date.now())} y1={HEADER_H}
                  x2={xFor(Date.now())} y2={chartH}
                  stroke="#22d3ee" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />

            {/* Project rows */}
            {rows.map(({ p, s, e }, i) => {
              const y = HEADER_H + i * ROW_H + ROW_H / 2;
              const x1 = xFor(s);
              const x2 = Math.max(xFor(e), x1 + 4);
              const barW = x2 - x1;
              return (
                <g key={p.id}
                   className="cursor-pointer"
                   onClick={() => onOpen(p.id)}>
                  {/* Row hover background */}
                  <rect x={0} y={y - ROW_H / 2} width={chartW} height={ROW_H}
                        fill="transparent" className="hover:fill-white/[0.02]"/>

                  {colorBy === "stage" ? (
                    (() => {
                      const segs = stageSegments(p);
                      let cur = x1;
                      return (
                        <g>
                          {segs.map((seg, idx) => {
                            const w = barW * seg.fraction;
                            const rect = (
                              <rect key={idx}
                                    x={cur} y={y - 7}
                                    width={Math.max(1, w)} height={14}
                                    fill={seg.color}
                                    fillOpacity={p.status === "open" ? 0.7 : 0.5}
                                    stroke={seg.color}
                                    strokeOpacity={0.9}
                                    strokeWidth={0.5}>
                                <title>{`${p.name} — ${seg.name}: ${seg.days}d`}</title>
                              </rect>
                            );
                            cur += w;
                            return rect;
                          })}
                          <rect x={x1} y={y - 7} width={barW} height={14}
                                fill="none" stroke="rgba(255,255,255,0.18)"
                                strokeWidth={0.5} rx={2}/>
                        </g>
                      );
                    })()
                  ) : (
                    <rect x={x1} y={y - 7} width={barW} height={14} rx={3}
                          fill={flatColour(p)}
                          fillOpacity={p.status === "open" ? 0.55 : 0.3}
                          stroke={flatColour(p)}
                          strokeOpacity={0.9}
                          strokeWidth={1}>
                      <title>{`${p.name} — ${p.project_type} · ${p.campaign_hub}`}</title>
                    </rect>
                  )}

                  {p.operational_success && (
                    <circle cx={x2 - 4} cy={y} r={2.5} fill="#34d399" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
        {legend.map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            <span>{label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-slate-400 ml-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          operational success
        </span>
      </div>
    </div>
  );
}
