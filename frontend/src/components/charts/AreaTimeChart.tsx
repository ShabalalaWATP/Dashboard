import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ACCENT, MAGENTA, GRID, AXIS } from "../../palette";

export function AreaTimeChart({ data, height = 300 }: {
  data: { month: string; active: number; completed: number }[];
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={ACCENT} stopOpacity={0.55} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="month" stroke={AXIS} fontSize={11} />
        <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="active"
              name="Projects active"
              stroke={ACCENT} fill="url(#gActive)" strokeWidth={2} />
        <Bar dataKey="completed"
             name="Projects completed"
             fill={MAGENTA} opacity={0.75} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
