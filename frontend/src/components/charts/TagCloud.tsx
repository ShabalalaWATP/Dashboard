import { useMemo, useState } from "react";
import { Search, Tag as TagIcon } from "lucide-react";

type Tag = { label: string; value: number };
type Bubble = Tag & { x: number; y: number; r: number };

// Frequency → colour. The bottom of the scale is a muted slate so low-count
// tags recede, and the top saturates to the dashboard's cyan accent so the
// most-used tags visually dominate. Gradient stops are tuned so even the
// middle-rank tags read as "present, but not shouting".
function tagColor(norm: number): string {
  if (norm < 0.15) return "#475569";   // slate-600 — very faint
  if (norm < 0.35) return "#0e7490";   // cyan-800
  if (norm < 0.55) return "#0891b2";   // cyan-600
  if (norm < 0.75) return "#06b6d4";   // cyan-500
  if (norm < 0.90) return "#22d3ee";   // cyan-400
  return "#67e8f9";                    // cyan-300 — top rank
}


/** Cool-looking packed-bubble tag cloud. Circles are laid out with a simple
 *  greedy spiral packer (sorted largest-first, each new bubble placed at the
 *  nearest valid spiral position) — good enough visually for <100 tags and
 *  much cheaper than a full force sim. Size = frequency, colour = rank,
 *  click = add/remove from filter. Hovering pops a label.
 */
export function TagCloud({
  data,
  selected,
  onToggle,
  height = 380,
}: {
  data: Tag[];
  selected: string[];
  onToggle: (label: string) => void;
  height?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((t) => t.label.toLowerCase().includes(s));
  }, [data, q]);

  const W = 900;
  const H = height;

  const { bubbles, max } = useMemo(() => packBubbles(filtered, W, H), [filtered, W, H]);

  if (!data.length) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no tags in current filter</div>;
  }

  return (
    <div className="relative">
      {/* Search / filter — keeps the chart useful when the tag set is huge */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Filter tags..."
                 className="w-full pl-7 pr-2 py-1 text-xs bg-bg0 border border-white/10 text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-accent/40" />
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          <span className="text-accent">{filtered.length}</span> tag{filtered.length === 1 ? "" : "s"}
          {selected.length > 0 && (
            <span className="text-slate-600"> · <span className="text-accent/80">{selected.length}</span> active</span>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-md border border-white/5"
           style={{ height: H, background: "radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.05) 0%, rgba(10,11,15,0) 70%)" }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
             style={{ display: "block" }}
             onMouseLeave={() => setHover(null)}>
          <defs>
            {/* Subtle glow for hovered / selected bubbles */}
            <filter id="tag-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Per-bubble radial gradient — dark interior, luminous edge */}
            <radialGradient id="tag-shine" cx="35%" cy="30%" r="80%">
              <stop offset="0%"  stopColor="rgba(255,255,255,0.35)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {bubbles.map((b) => {
            const norm = b.value / max;
            const isHover = hover === b.label;
            const isSel = selected.includes(b.label);
            const baseColor = tagColor(norm);
            const fontSize = Math.max(9, Math.min(20, b.r * 0.42));
            const showLabel = b.r >= 18;
            const labelText = showLabel ? b.label : "";
            return (
              <g key={b.label}
                 onMouseEnter={() => setHover(b.label)}
                 onClick={() => onToggle(b.label)}
                 style={{ cursor: "pointer",
                          transition: "transform 160ms ease-out",
                          transformOrigin: `${b.x}px ${b.y}px`,
                          transform: isHover ? "scale(1.08)" : "scale(1)" }}>
                {(isHover || isSel) && (
                  <circle cx={b.x} cy={b.y} r={b.r + 4}
                          fill={baseColor}
                          fillOpacity={0.18}
                          filter="url(#tag-glow)" />
                )}
                <circle cx={b.x} cy={b.y} r={b.r}
                        fill={baseColor}
                        fillOpacity={isSel ? 0.95 : (isHover ? 0.85 : 0.72)}
                        stroke={isSel ? "#e0fbfc" : "rgba(255,255,255,0.15)"}
                        strokeWidth={isSel ? 1.6 : 1} />
                {/* Highlight sheen */}
                <circle cx={b.x} cy={b.y} r={b.r} fill="url(#tag-shine)" pointerEvents="none" />
                {showLabel && (
                  <text x={b.x} y={b.y + fontSize * 0.36}
                        textAnchor="middle"
                        fill="#0a0b0f"
                        fontSize={fontSize}
                        fontFamily="JetBrains Mono"
                        fontWeight={norm > 0.6 ? 700 : 600}
                        pointerEvents="none">
                    {labelText}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip — drawn last so it's always on top */}
          {hover && (() => {
            const b = bubbles.find((x) => x.label === hover);
            if (!b) return null;
            const txt = `${b.label} · ${b.value}`;
            const tw = Math.max(60, txt.length * 6.5);
            const tx = Math.min(W - tw - 8, Math.max(8, b.x - tw / 2));
            const ty = Math.max(8, b.y - b.r - 28);
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={tw} height={22} rx={4}
                      fill="#0b1020" fillOpacity={0.92}
                      stroke="rgba(34,211,238,0.35)" />
                <text x={tx + tw / 2} y={ty + 15}
                      textAnchor="middle"
                      fontFamily="JetBrains Mono"
                      fontSize={11}
                      fill="#e2e8f0">
                  {txt}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Legend / hint line */}
        <div className="absolute bottom-2 left-2 font-mono text-[10px] text-slate-500">
          size = frequency · click to toggle filter
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 font-mono text-[10px] text-slate-500">
          <TagIcon size={10} className="text-accent/70" />
          <span>{data.length} total</span>
        </div>
      </div>

      {/* Chips showing currently-selected tags so the user can un-toggle from
          outside the cloud if a selected tag scrolled off-screen. */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((t) => (
            <button key={t}
                    onClick={() => onToggle(t)}
                    className="px-2 py-0.5 text-[10px] font-mono text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20"
                    title="Click to remove">
              {t} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Bubble packing — greedy spiral placement
//
// Not a "proper" circle-pack (no physics / no d3-hierarchy dep) — just a
// cheap deterministic layout that looks good for up to ~80 tags: sort bubbles
// largest-first, then for each bubble walk outward along a spiral from centre
// until we find a position that doesn't overlap any already-placed bubble or
// escape the canvas. Good enough, fast, no deps.
// ---------------------------------------------------------------------------
function packBubbles(tags: Tag[], W: number, H: number): { bubbles: Bubble[]; max: number } {
  const max = Math.max(1, ...tags.map((t) => t.value));
  // Fit the bubble-size scale to the canvas: if the dataset is small, grow
  // bubbles; if huge, shrink them. Tuned by eye.
  const area = W * H;
  const targetArea = area * 0.55;   // 55% of canvas filled by bubbles
  const totalValue = tags.reduce((s, t) => s + Math.sqrt(t.value), 0) || 1;
  const unitArea = targetArea / totalValue;
  const minR = 8;
  const maxR = Math.min(W, H) * 0.18;

  const sorted = [...tags].sort((a, b) => b.value - a.value);
  const bubbles: Bubble[] = [];
  const cx = W / 2, cy = H / 2;

  for (const t of sorted) {
    const rRaw = Math.sqrt((unitArea * Math.sqrt(t.value)) / Math.PI);
    const r = Math.max(minR, Math.min(maxR, rRaw));
    // Walk a dense Archimedean spiral and stop at the first non-overlapping
    // position that fits inside the canvas with a 4px margin.
    let placed = false;
    const step = 2.4;       // radial speed of the spiral
    const turn = 0.35;      // angular speed (radians per sample)
    for (let i = 0; i < 4000 && !placed; i++) {
      const dist = step * Math.sqrt(i);
      const angle = i * turn;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      if (x - r < 4 || x + r > W - 4 || y - r < 4 || y + r > H - 4) continue;
      let overlap = false;
      for (const b of bubbles) {
        const dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < (r + b.r + 2) * (r + b.r + 2)) { overlap = true; break; }
      }
      if (!overlap) {
        bubbles.push({ ...t, x, y, r });
        placed = true;
      }
    }
    // If we genuinely couldn't find a spot, drop the bubble — far better to
    // lose a few low-rank tags than to overlap the layout.
  }
  return { bubbles, max };
}
