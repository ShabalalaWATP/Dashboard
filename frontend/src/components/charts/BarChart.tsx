import {
  BarChart as RBar, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { ACCENT, GRID, AXIS, PALETTE } from "../../palette";

/** Plain single-colour bar chart, optionally clickable.
 *  - `colors`   explicit per-bar palette in the same order as `data`.
 *  - `colorful` cycles through the shared accent palette per-bar.
 *  - `color`    single flat colour (fallback). */
export function BarChart({
  data, height = 260, color = ACCENT, horizontal = false, onBarClick,
  colorful = false, colors,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  horizontal?: boolean;
  onBarClick?: (label: string) => void;
  colorful?: boolean;
  colors?: string[];
}) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no data</div>;
  }
  const perBar = colors || (colorful ? data.map((_, i) => PALETTE[i % PALETTE.length]) : null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBar data={data} layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 12, bottom: 8, left: horizontal ? 80 : 0 }}
            onClick={(e: any) => {
              const label = e?.activePayload?.[0]?.payload?.label;
              if (label && onBarClick) onBarClick(label);
            }}>
        <CartesianGrid stroke={GRID} vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" stroke={AXIS} fontSize={11} />
            <YAxis type="category" dataKey="label" stroke={AXIS} fontSize={11} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" stroke={AXIS} fontSize={11} />
            <YAxis stroke={AXIS} fontSize={11} />
          </>
        )}
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="value" radius={[4, 4, 4, 4]}
             style={{ cursor: onBarClick ? "pointer" : "default" }}
             fill={perBar ? undefined : color}>
          {perBar && data.map((_, i) => (
            <Cell key={i} fill={perBar[i] || color} />
          ))}
        </Bar>
      </RBar>
    </ResponsiveContainer>
  );
}
