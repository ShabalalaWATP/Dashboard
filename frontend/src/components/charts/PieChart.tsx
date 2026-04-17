import { PieChart as RPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PALETTE } from "../../palette";

export function PieChart({ data, height = 260 }: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RPie>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          outerRadius={95}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </RPie>
    </ResponsiveContainer>
  );
}
