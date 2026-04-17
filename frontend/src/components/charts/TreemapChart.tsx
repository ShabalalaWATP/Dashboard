import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { PALETTE } from "../../palette";

const CustomCell = (props: any) => {
  const { x, y, width, height, index, name, value } = props;
  const color = PALETTE[index % PALETTE.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height}
            style={{ fill: color, fillOpacity: 0.35, stroke: "rgba(0,0,0,0.4)", strokeWidth: 1 }} />
      {width > 60 && height > 28 && (
        <>
          <text x={x + 8} y={y + 18} fill="#e5e7eb" fontSize={12} fontWeight={600}>
            {name}
          </text>
          <text x={x + 8} y={y + 34} fill="#9ca3af" fontSize={11} className="mono">
            {value}
          </text>
        </>
      )}
    </g>
  );
};

export function TreemapChart({ data, height = 300 }: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={data}
        dataKey="value"
        nameKey="name"
        stroke="rgba(0,0,0,0.4)"
        content={<CustomCell />}
      >
        <Tooltip />
      </Treemap>
    </ResponsiveContainer>
  );
}
