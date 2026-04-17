import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Plus, Minus } from "lucide-react";

type Node = { id: string; count: number; kind: string };
type Edge = { source: string; target: string; value: number; kind?: string };

// Per-hub colour palette — keeps the campaign colouring consistent with the
// Overview "Campaigns" bar chart and GanttChart.
const HUB_COLOR: Record<string, string> = {
  Russia: "#22d3ee",
  China:  "#e879f9",
  Iran:   "#fbbf24",
  CT:     "#a78bfa",
  SOC:    "#34d399",
};

const COLLAB_COLOR   = "#e2e8f0";   // warm neutral
const CUSTOMER_COLOR = "#f97316";   // amber — visually distinct from hub palettes


/** Three-ring network: hubs in the middle, collaborators on one outer arc,
 *  customers on another. Everything is interlinked via the shared campaign
 *  hub (and via collab↔customer edges when they share a project).
 *
 *  The SVG canvas is zoomable (mouse wheel or +/- buttons) and pannable
 *  (drag the background) so a dense portfolio still reads cleanly. Wheel
 *  zoom uses a native non-passive listener to preventDefault, which the
 *  React synthetic onWheel can't do reliably.
 */
export function Network({ nodes, edges, height = 520 }: {
  nodes: Node[];
  edges: Edge[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Logical canvas size the viewBox always targets. Real rendering scales it
  // to fill the container — the zoom/pan happens inside viewBox, not via CSS
  // transform, so the SVG stays crisp at any zoom level.
  const W = 960;
  const H = fullscreen ? window.innerHeight - 80 : height;

  const layout = useMemo(() => {
    const hubs     = nodes.filter((n) => n.kind === "hub");
    const collabs  = nodes.filter((n) => n.kind === "collab");
    const customrs = nodes.filter((n) => n.kind === "customer");
    const cx = W / 2;
    const cy = H / 2;
    const rHub      = Math.min(W, H) * 0.16;
    const rCollab   = Math.min(W, H) * 0.36;
    const rCustomer = Math.min(W, H) * 0.48;

    const pos = new Map<string, { x: number; y: number; angle: number }>();

    // Hubs: single ring. If there's only one, drop it at the centre so edges
    // don't collapse to a degenerate point.
    if (hubs.length === 1) {
      pos.set(hubs[0].id, { x: cx, y: cy, angle: 0 });
    } else {
      hubs.forEach((h, i) => {
        const a = (i / hubs.length) * Math.PI * 2 - Math.PI / 2;
        pos.set(h.id, { x: cx + Math.cos(a) * rHub, y: cy + Math.sin(a) * rHub, angle: a });
      });
    }

    // Collaborators on the TOP half, customers on the BOTTOM half. This
    // separates the two categories visually and keeps customer↔collab edges
    // readable instead of crisscrossing through the hub ring.
    collabs.forEach((c, i) => {
      const spread = Math.PI;  // top semicircle, -π to 0
      const a = -Math.PI + (i + 0.5) / Math.max(1, collabs.length) * spread;
      pos.set(c.id, { x: cx + Math.cos(a) * rCollab, y: cy + Math.sin(a) * rCollab, angle: a });
    });
    customrs.forEach((c, i) => {
      const spread = Math.PI;  // bottom semicircle, 0 to π
      const a = (i + 0.5) / Math.max(1, customrs.length) * spread;
      pos.set(c.id, { x: cx + Math.cos(a) * rCustomer, y: cy + Math.sin(a) * rCustomer, angle: a });
    });
    return { pos };
  }, [nodes, H]);

  const maxEdge = Math.max(1, ...edges.map((e) => e.value));

  // Wheel-zoom about the cursor — native listener with {passive:false} so we
  // can preventDefault (React's synthetic onWheel is passive and cannot).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handler(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      const next = Math.max(0.4, Math.min(6, zoomRef.current * factor));
      const ratio = next / zoomRef.current;
      // Anchor zoom about cursor: pan so the pixel under the cursor stays put.
      setPan({
        x: mx - (mx - panRef.current.x) * ratio,
        y: my - (my - panRef.current.y) * ratio,
      });
      setZoom(next);
    }
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Drag-to-pan — only on the background, so clicking a node doesn't start a pan.
  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as SVGElement).tagName === "g" || (e.target as SVGElement).closest("g[data-node]")) return;
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragRef.current) return;
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.x),
      y: dragRef.current.panY + (e.clientY - dragRef.current.y),
    });
  }
  function onMouseUp() {
    setDragging(false);
    dragRef.current = null;
  }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  if (!nodes || nodes.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no network data in current filter</div>;
  }

  function isRelated(nodeId: string): boolean {
    if (!hover) return true;
    if (nodeId === hover) return true;
    return edges.some((e) =>
      (e.source === hover && e.target === nodeId) ||
      (e.target === hover && e.source === nodeId));
  }
  function edgeRelated(e: Edge): boolean {
    if (!hover) return true;
    return e.source === hover || e.target === hover;
  }

  function hubColor(id: string): string {
    const name = id.replace(/ Hub$/, "");
    return HUB_COLOR[name] || "#22d3ee";
  }
  function nodeColor(n: Node): string {
    if (n.kind === "hub") return hubColor(n.id);
    if (n.kind === "customer") return CUSTOMER_COLOR;
    return COLLAB_COLOR;
  }
  function edgeColor(e: Edge): string {
    // Hub-anchored edges get their hub's colour; collab↔customer edges are
    // a faded neutral so they don't overpower the primary radial structure.
    if (e.kind === "customer-collab") return "#64748b";
    if (e.source.endsWith("Hub")) return hubColor(e.source);
    if (e.target.endsWith("Hub")) return hubColor(e.target);
    return "#64748b";
  }
  function edgeDashes(e: Edge): string | undefined {
    return e.kind === "customer-collab" ? "4 4" : undefined;
  }

  const wrapperCls = fullscreen
    ? "fixed inset-4 z-50 bg-bg0 border border-white/15 rounded-lg shadow-2xl"
    : "relative";

  return (
    <div className={wrapperCls}>
      <div ref={containerRef}
           className="relative overflow-hidden select-none"
           style={{ height: H, cursor: dragging ? "grabbing" : "grab" }}
           onMouseDown={onMouseDown}
           onMouseMove={onMouseMove}
           onMouseUp={onMouseUp}
           onMouseLeave={() => { onMouseUp(); setHover(null); }}>

        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
             style={{ display: "block" }}>
          <defs>
            <radialGradient id="net-bg" cx="50%" cy="50%" r="60%">
              <stop offset="0%"  stopColor="#0b1020" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#050810" stopOpacity="0" />
            </radialGradient>
            <filter id="net-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Faint radial wash at the centre for depth */}
          <rect x={0} y={0} width={W} height={H} fill="url(#net-bg)" />

          {/* All zoom/pan happens inside this transform group */}
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>

            {/* Concentric rings — decorative guides */}
            {[0.16, 0.36, 0.48].map((factor, i) => (
              <circle key={i}
                      cx={W / 2} cy={H / 2}
                      r={Math.min(W, H) * factor}
                      fill="none"
                      stroke="rgba(148,163,184,0.08)"
                      strokeDasharray={i === 0 ? undefined : "2 4"} />
            ))}

            {/* edges */}
            {edges.map((e, idx) => {
              const a = layout.pos.get(e.source);
              const b = layout.pos.get(e.target);
              if (!a || !b) return null;
              const related = edgeRelated(e);
              const weight = 1 + (e.value / maxEdge) * 3.2;
              const opacity = (related ? 1 : 0.1) * (0.25 + (e.value / maxEdge) * 0.6);
              // Curved edge via quadratic Bezier — gentle bow toward the
              // canvas centre so parallel edges don't overprint.
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const cx = W / 2; const cy = H / 2;
              const dx = mx - cx; const dy = my - cy;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const curl = e.kind === "customer-collab" ? 0.12 : 0.22;
              const ctrlX = mx - (dx / len) * len * curl;
              const ctrlY = my - (dy / len) * len * curl;
              return (
                <path key={idx}
                      d={`M ${a.x} ${a.y} Q ${ctrlX} ${ctrlY} ${b.x} ${b.y}`}
                      fill="none"
                      stroke={edgeColor(e)}
                      strokeOpacity={opacity}
                      strokeWidth={weight}
                      strokeDasharray={edgeDashes(e)}
                      strokeLinecap="round" />
              );
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const p = layout.pos.get(n.id);
              if (!p) return null;
              const isHub = n.kind === "hub";
              const r = isHub
                ? 12 + Math.sqrt(n.count) * 1.4
                : 5 + Math.sqrt(n.count) * 2.0;
              const related = isRelated(n.id);
              const fill = nodeColor(n);

              // Label position: push outward from centre, anchored so text
              // never overlaps the node.
              const lx = p.x + Math.cos(p.angle) * (r + 10);
              const ly = p.y + Math.sin(p.angle) * (r + 10);
              const anchor = Math.cos(p.angle) < -0.2 ? "end"
                           : Math.cos(p.angle) > 0.2 ? "start"
                           : "middle";
              const displayName = isHub ? n.id.replace(/ Hub$/, "") : n.id;

              return (
                <g key={n.id}
                   data-node
                   onMouseEnter={() => setHover(n.id)}
                   style={{ cursor: "pointer", opacity: related ? 1 : 0.25, transition: "opacity 120ms" }}>
                  {isHub && related && (
                    <circle cx={p.x} cy={p.y} r={r + 6}
                            fill={fill} fillOpacity={0.15}
                            filter="url(#net-glow)" />
                  )}
                  <circle cx={p.x} cy={p.y} r={r}
                          fill={fill}
                          fillOpacity={isHub ? 0.95 : 0.75}
                          stroke={isHub ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.15)"}
                          strokeWidth={isHub ? 1.2 : 1} />
                  {isHub && (
                    <text x={p.x} y={p.y + 4}
                          textAnchor="middle"
                          fill="#0a0b0f"
                          fontSize={10}
                          fontFamily="JetBrains Mono"
                          fontWeight={700}>
                      {displayName}
                    </text>
                  )}
                  {!isHub && (
                    <text x={lx} y={ly + 3}
                          textAnchor={anchor}
                          fill={n.kind === "customer" ? "#fed7aa" : "#cbd5e1"}
                          fontSize={10}
                          fontFamily="JetBrains Mono">
                      {displayName}
                      <tspan fill="#64748b" dx={4}>{n.count}</tspan>
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom / pan HUD — sits inside the container so it's always visible
            no matter how far the canvas is panned. */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 font-mono text-[10px]">
          <button onClick={() => setZoom((z) => Math.min(6, z * 1.2))}
                  className="p-1 bg-bg0/80 border border-white/15 text-slate-300 hover:bg-accent/10 hover:border-accent/40"
                  title="Zoom in">
            <Plus size={12} />
          </button>
          <button onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))}
                  className="p-1 bg-bg0/80 border border-white/15 text-slate-300 hover:bg-accent/10 hover:border-accent/40"
                  title="Zoom out">
            <Minus size={12} />
          </button>
          <button onClick={resetView}
                  className="px-1 py-0.5 bg-bg0/80 border border-white/15 text-slate-300 hover:bg-accent/10 hover:border-accent/40"
                  title="Reset view">
            1:1
          </button>
          <button onClick={() => setFullscreen((f) => !f)}
                  className="p-1 bg-bg0/80 border border-white/15 text-slate-300 hover:bg-accent/10 hover:border-accent/40"
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-400 bg-bg0/70 px-2 py-1 border border-white/10">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" />HUB</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" />COLLAB</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />CUSTOMER</span>
          <span className="hidden md:inline text-slate-600">· drag to pan · wheel / +/− to zoom</span>
        </div>
      </div>
    </div>
  );
}
