import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from "recharts";
import { GRID, AXIS } from "../../palette";

/** Grouped-bar chart: for each campaign, show three bars side-by-side:
 *  Vulnerabilities, HS Equities, Operational Successes. Tone-matched with
 *  the Overview Outputs KPI strip so the colours read as "same thing". */
export function OutputsByCampaign({
  data, campaignsLabel = "Campaigns", equitiesLabel = "HS Equities", height = 280,
}: {
  data: { hub: string; vulns: number; equities: number; successes: number }[];
  campaignsLabel?: string;
  equitiesLabel?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no data</div>;
  }
  const totalOutputs = data.reduce((s, r) => s + r.vulns + r.equities + r.successes, 0);
  return (
    <div>
      <div className="mb-2 text-[11px] font-mono text-slate-500">
        {totalOutputs} total output{totalOutputs === 1 ? "" : "s"} across {data.length} {campaignsLabel.toLowerCase()}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis dataKey="hub" stroke={AXIS} fontSize={11} />
          <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="vulns"     name="Vulnerabilities"       fill="#e879f9" radius={[3,3,0,0]}>
            <LabelList dataKey="vulns" position="top"
                       style={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "JetBrains Mono" }}
                       formatter={(v: any) => (v > 0 ? v : "")} />
          </Bar>
          <Bar dataKey="equities"  name={equitiesLabel}          fill="#fbbf24" radius={[3,3,0,0]}>
            <LabelList dataKey="equities" position="top"
                       style={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "JetBrains Mono" }}
                       formatter={(v: any) => (v > 0 ? v : "")} />
          </Bar>
          <Bar dataKey="successes" name="Operational Successes" fill="#34d399" radius={[3,3,0,0]}>
            <LabelList dataKey="successes" position="top"
                       style={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "JetBrains Mono" }}
                       formatter={(v: any) => (v > 0 ? v : "")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
