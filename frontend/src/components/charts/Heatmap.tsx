export function Heatmap({
  rows, cols, matrix, color = "34,211,238", onCellClick,
}: {
  rows: string[];
  cols: string[];
  matrix: number[][];
  color?: string;
  onCellClick?: (row: string, col: string, value: number) => void;
}) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div>
      <div className="overflow-auto">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2"></th>
              {cols.map((c) => (
                <th key={c} className="p-2 text-left text-slate-400 font-medium whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r}>
                <td className="p-2 text-slate-400 whitespace-nowrap font-medium">{r}</td>
                {cols.map((c, j) => {
                  const v = matrix[i][j] || 0;
                  const alpha = v === 0 ? 0.03 : 0.15 + (v / max) * 0.75;
                  return (
                    <td key={j} className="p-0">
                      <button
                        type="button"
                        onClick={() => onCellClick?.(r, c, v)}
                        disabled={!onCellClick || v === 0}
                        title={`${r} × ${c}: ${v}`}
                        className={`m-1 rounded-md mono text-center py-2 w-full text-slate-100
                          ${onCellClick && v > 0 ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
                        style={{
                          background: `rgba(${color}, ${alpha})`,
                          border: `1px solid rgba(${color}, ${Math.min(0.9, alpha + 0.15)})`,
                        }}
                      >
                        {v || ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Scale legend */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="mono">0</span>
        <div className="flex-1 h-2 rounded-full"
             style={{ background: `linear-gradient(to right, rgba(${color},0.03), rgba(${color},0.9))` }} />
        <span className="mono">{max}</span>
      </div>
    </div>
  );
}
