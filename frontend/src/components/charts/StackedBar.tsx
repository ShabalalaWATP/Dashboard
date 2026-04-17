import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PALETTE, GRID, AXIS } from "../../palette";

export function StackedBar({ rows, keys, xKey = "type", height = 300 }: {
  rows: Record<string, any>[];
  keys: string[];
  xKey?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey={xKey} stroke={AXIS} fontSize={11} />
        <YAxis stroke={AXIS} fontSize={11} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={PALETTE[i % PALETTE.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
