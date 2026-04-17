import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList, Label,
} from "recharts";
import { GRID, AXIS } from "../../palette";

const BUCKET_COLORS = ["#22d3ee", "#38bdf8", "#a78bfa", "#e879f9", "#fbbf24", "#f87171"];

/** Dedicated duration histogram — reads clearly:
 *  Y-axis = number of projects, X-axis = duration buckets (months/years).
 *  Each bar gets a gradient-ish colour so they don't blur together.
 *  Median is surfaced in the subtitle rather than as a line, since the
 *  x-axis is categorical not numeric. */
export function DurationHistogram({
  data, median, height = 280,
}: {
  data: { label: string; value: number }[];
  median?: number;
  height?: number;
}) {
  if (!data || data.length === 0 || data.every((b) => b.value === 0)) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no closed projects in current filter</div>;
  }
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div className="mb-2 text-[11px] text-slate-500 font-mono">
        {total} closed project{total === 1 ? "" : "s"}
        {median != null && median > 0 && <>  ·  median = {median} day{median === 1 ? "" : "s"}</>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 30, left: 28 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickMargin={6}>
            <Label value="Project duration (how long start → end took)"
                   position="insideBottom" offset={-18}
                   style={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono",
                            textTransform: "uppercase", letterSpacing: "0.12em" }} />
          </XAxis>
          <YAxis stroke={AXIS} fontSize={11} allowDecimals={false}>
            <Label value="Projects"
                   angle={-90} position="insideLeft" offset={6}
                   style={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono",
                            textTransform: "uppercase", letterSpacing: "0.12em",
                            textAnchor: "middle" }} />
          </YAxis>
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
                   formatter={(v: any) => [`${v} project${v === 1 ? "" : "s"}`, "Count"]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
            <LabelList dataKey="value" position="top"
                       style={{ fill: "#cbd5e1", fontSize: 11, fontFamily: "JetBrains Mono" }}
                       formatter={(v: any) => (v > 0 ? v : "")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
