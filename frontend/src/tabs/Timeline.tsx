import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { useData } from "../filters";
import type { Project } from "../types";


const HUB_COLOR: Record<string, string> = {
  Russia: "#22d3ee",
  China:  "#e879f9",
  Iran:   "#fbbf24",
  CT:     "#a78bfa",
  SOC:    "#34d399",
};


export function Timeline({ onOpenProject }: { onOpenProject: (id: number) => void }) {
  const { filtered } = useData();
  const [colorBy, setColorBy] = useState<"hub" | "type" | "outcome" | "status">("hub");

  const { projects, minT, maxT, months } = useMemo(() => {
    const today = new Date();
    let minT = Infinity;
    let maxT = -Infinity;
    const rows = filtered.map((p) => {
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
    // Pad by a half-month
    minT -= 15 * 86400000;
    maxT += 15 * 86400000;
    rows.sort((a, b) => a.s - b.s);

    // Month tick positions
    const ticks: { label: string; t: number }[] = [];
    const cursor = new Date(minT);
    cursor.setDate(1);
    while (cursor.getTime() <= maxT) {
      ticks.push({
        label: `${String(cursor.getMonth() + 1).padStart(2, "0")}/${String(cursor.getFullYear()).slice(2)}`,
        t: cursor.getTime(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { projects: rows, minT, maxT, months: ticks };
  }, [filtered]);

  const labelW = 220;
  const rowH = 26;
  const chartH = Math.max(200, projects.length * rowH + 40);

  function xFor(t: number, totalW: number) {
    return ((t - minT) / (maxT - minT)) * (totalW - labelW) + labelW;
  }

  function colorFor(p: Project): string {
    if (colorBy === "hub") return HUB_COLOR[p.campaign_hub] || "#22d3ee";
    if (colorBy === "status") return p.status === "open" ? "#34d399" : "#94a3b8";
    if (colorBy === "outcome") {
      return ({
        "In Progress": "#38bdf8",
        "Success":     "#34d399",
        "Partial":     "#fbbf24",
        "Blocked":     "#f87171",
        "Abandoned":   "#94a3b8",
      } as Record<string, string>)[p.outcome] || "#22d3ee";
    }
    // type
    return ({
      "Vulnerability Research": "#22d3ee",
      "Reverse Engineering":    "#e879f9",
      "Research":               "#a78bfa",
      "Software Engineering":   "#34d399",
    } as Record<string, string>)[p.project_type] || "#22d3ee";
  }

  const legend = useMemo(() => {
    const m = new Map<string, string>();
    for (const { p } of projects) {
      const key = colorBy === "hub" ? p.campaign_hub
                : colorBy === "type" ? p.project_type
                : colorBy === "outcome" ? p.outcome
                : p.status;
      m.set(key, colorFor(p));
    }
    return Array.from(m.entries());
  }, [projects, colorBy]);

  return (
    <div className="space-y-4">
      <Card title="Project Timeline"
            subtitle="Each bar is a project. Bars extending to today are still open. Click a bar to open its detail."
            actions={
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-500 mr-1">colour:</span>
                {(["hub", "type", "outcome", "status"] as const).map((v) => (
                  <button key={v}
                          onClick={() => setColorBy(v)}
                          className={`px-2 py-1 rounded border
                            ${colorBy === v
                              ? "bg-accent/15 border-accent/40 text-accent"
                              : "bg-bg0 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/30"}`}>
                    {v}
                  </button>
                ))}
              </div>
            }>
        {projects.length === 0 ? (
          <div className="text-xs text-slate-500 mono py-10 text-center">no projects match current filters</div>
        ) : (
          <div className="overflow-auto">
            <svg
              width="100%"
              viewBox={`0 0 1200 ${chartH}`}
              preserveAspectRatio="none"
              style={{ height: chartH }}
            >
              {/* Month gridlines */}
              {months.map((m) => (
                <g key={m.t}>
                  <line x1={xFor(m.t, 1200)} y1={20}
                        x2={xFor(m.t, 1200)} y2={chartH}
                        stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  <text x={xFor(m.t, 1200)} y={14}
                        fontSize={9} fill="#6b7280" fontFamily="JetBrains Mono"
                        textAnchor="middle">
                    {m.label}
                  </text>
                </g>
              ))}

              {/* Today marker */}
              <line x1={xFor(Date.now(), 1200)} y1={16}
                    x2={xFor(Date.now(), 1200)} y2={chartH}
                    stroke="#22d3ee" strokeWidth={1} strokeDasharray="2 3" opacity={0.7}/>

              {/* Project rows */}
              {projects.map(({ p, s, e }, i) => {
                const y = 30 + i * rowH;
                const x1 = xFor(s, 1200);
                const x2 = Math.max(xFor(e, 1200), x1 + 4);
                const color = colorFor(p);
                return (
                  <g key={p.id}
                     className="cursor-pointer"
                     onClick={() => onOpenProject(p.id)}>
                    <rect x={0} y={y - 8} width={labelW - 4} height={16} fill="transparent" />
                    <text x={labelW - 8} y={y + 4} fontSize={11}
                          fill="#cbd5e1" fontFamily="JetBrains Mono"
                          textAnchor="end">
                      {p.name}
                    </text>
                    <rect
                      x={x1} y={y - 8}
                      width={x2 - x1} height={16}
                      rx={4}
                      fill={color}
                      fillOpacity={p.status === "open" ? 0.55 : 0.3}
                      stroke={color}
                      strokeOpacity={0.9}
                      strokeWidth={1}
                    />
                    {p.operational_success && (
                      <circle cx={x2 - 4} cy={y} r={3} fill="#34d399" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        {/* Legend */}
        {projects.length > 0 && (
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
        )}
      </Card>
    </div>
  );
}
