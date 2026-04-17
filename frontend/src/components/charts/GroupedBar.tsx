import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ACCENT, MAGENTA, GRID, AXIS } from "../../palette";

export function GroupedBar({ data, height = 280 }: {
  data: { stage: string; avg_days: number; total_days: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="stage" stroke={AXIS} fontSize={10} interval={0} angle={-10} textAnchor="end" height={60} />
        <YAxis stroke={AXIS} fontSize={11} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="avg_days" name="Avg days" fill={ACCENT} radius={[4, 4, 0, 0]} />
        <Bar dataKey="total_days" name="Total days" fill={MAGENTA} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
