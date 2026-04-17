import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PALETTE } from "../../palette";

export function DonutChart({ data, height = 260, onSliceClick }: {
  data: { label: string; value: number }[];
  height?: number;
  onSliceClick?: (label: string) => void;
}) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={60}
          outerRadius={95}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={2}
          paddingAngle={2}
          onClick={(e: any) => onSliceClick?.(e.label)}
          style={{ cursor: onSliceClick ? "pointer" : "default" }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
