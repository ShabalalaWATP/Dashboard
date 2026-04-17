import { DonutChart } from "./DonutChart";
import { BarChart } from "./BarChart";
import { PieChart } from "./PieChart";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ACCENT, GRID, AXIS } from "../../palette";

type Chart = {
  type: string;
  title: string;
  data: { label: string; value: number }[];
};

export function DynamicChart({ chart }: { chart: Chart }) {
  const kind = (chart.type || "").toLowerCase();
  return (
    <div className="panel rounded-xl p-4 my-2">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">{chart.title}</div>
      {kind === "pie" && <PieChart data={chart.data} height={220} />}
      {kind === "donut" && <DonutChart data={chart.data} height={220} />}
      {kind === "bar" && <BarChart data={chart.data} height={220} />}
      {kind === "line" && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart.data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis dataKey="label" stroke={AXIS} fontSize={11} />
            <YAxis stroke={AXIS} fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      {!["pie", "donut", "bar", "line"].includes(kind) && (
        <BarChart data={chart.data} height={220} />
      )}
    </div>
  );
}
