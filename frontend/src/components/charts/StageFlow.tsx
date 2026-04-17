import { PALETTE } from "../../palette";

/** Lightweight sankey-style horizontal flow — dependency-free. */
export function StageFlow({ stages, flow, height = 280 }: {
  stages: string[];
  flow: { source: string; target: string; value: number }[];
  height?: number;
}) {
  if (!stages || stages.length < 2) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">not enough stage data to visualise flow</div>;
  }
  const totalFlow = flow.reduce((s, f) => s + f.value, 0);
  if (totalFlow === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no closed projects with stage data in current filter</div>;
  }
  const maxFlow = Math.max(1, ...flow.map((f) => f.value));
  const w = 900;

  const nodeX = (i: number) => (i * (w - 40)) / (stages.length - 1) + 20;

  return (
    <div className="overflow-auto">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        {/* paths */}
        {flow.map((f, idx) => {
          const si = stages.indexOf(f.source);
          const ti = stages.indexOf(f.target);
          if (si < 0 || ti < 0) return null;
          const x1 = nodeX(si) + 4;
          const x2 = nodeX(ti) - 4;
          const cx = (x1 + x2) / 2;
          const y = height / 2;
          const thickness = 4 + (f.value / maxFlow) * 40;
          return (
            <path
              key={idx}
              d={`M ${x1} ${y} C ${cx} ${y - 30}, ${cx} ${y + 30}, ${x2} ${y}`}
              stroke={PALETTE[idx % PALETTE.length]}
              strokeOpacity={0.45}
              strokeWidth={thickness}
              fill="none"
            />
          );
        })}
        {/* nodes */}
        {stages.map((s, i) => {
          const x = nodeX(i);
          const y = height / 2;
          return (
            <g key={s}>
              <rect x={x - 6} y={y - 40} width={12} height={80} rx={3}
                    fill={PALETTE[i % PALETTE.length]} fillOpacity={0.7} />
              <text x={x} y={y + 60} textAnchor="middle"
                    fill="#cbd5e1" fontSize={11} fontFamily="Inter">
                {s}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
