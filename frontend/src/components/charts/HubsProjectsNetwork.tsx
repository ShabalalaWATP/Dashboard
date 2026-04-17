import { useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Move, RotateCcw } from "lucide-react";
import type { Project } from "../../types";


const HUB_COLOR: Record<string, string> = {
  Russia: "#22d3ee",
  China:  "#e879f9",
  Iran:   "#fbbf24",
  CT:     "#a78bfa",
  SOC:    "#34d399",
};

function hubColor(name: string): string {
  return HUB_COLOR[name] || "#64748b";
}

const HUB_COLOR_DARK: Record<string, string> = {
  Russia: "#0e7490",
  China:  "#a21caf",
  Iran:   "#b45309",
  CT:     "#6d28d9",
  SOC:    "#047857",
};

function hubDark(name: string): string {
  return HUB_COLOR_DARK[name] || "#334155";
}


/** Zoomable, pannable SVG canvas showing every project linked to its campaign.
 *  Hub cores pulse subtly and sit above a soft radial bloom; project dots
 *  orbit each hub in a sunflower pack and connect via curved bezier lines. */
export function HubsProjectsNetwork({
  projects, onOpenProject,
}: {
  projects: Project[];
  onOpenProject?: (id: number) => void;
}) {
  // Layout computed once per filtered set
  const { hubs, hubNode, projNode, edges, width, height } = useMemo(() => {
    const byHub = new Map<string, Project[]>();
    for (const p of projects) {
      const arr = byHub.get(p.campaign_hub) ?? [];
      arr.push(p);
      byHub.set(p.campaign_hub, arr);
    }
    const hubs = Array.from(byHub.keys()).sort();

    const total = projects.length;
    const W = Math.max(1200, Math.ceil(Math.sqrt(total) * 110));
    const H = Math.max(800, Math.ceil(Math.sqrt(total) * 90));

    const cx = W / 2;
    const cy = H / 2;
    const hubR = Math.min(W, H) * 0.22;

    const hubNode = new Map<string, { x: number; y: number; count: number }>();
    hubs.forEach((h, i) => {
      const a = (i / Math.max(1, hubs.length)) * Math.PI * 2 - Math.PI / 2;
      hubNode.set(h, {
        x: cx + Math.cos(a) * hubR,
        y: cy + Math.sin(a) * hubR,
        count: byHub.get(h)!.length,
      });
    });

    // Project nodes orbit their hub via golden-angle sunflower pack.
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const projNode = new Map<number, { x: number; y: number; hub: string }>();
    for (const [hub, arr] of byHub) {
      const hn = hubNode.get(hub)!;
      arr.forEach((p, i) => {
        const radius = 44 + Math.sqrt(i + 1) * 14;
        const a = i * GOLDEN;
        projNode.set(p.id, {
          x: hn.x + Math.cos(a) * radius,
          y: hn.y + Math.sin(a) * radius,
          hub,
        });
      });
    }

    const edges: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    for (const p of projects) {
      const pn = projNode.get(p.id);
      const hn = hubNode.get(p.campaign_hub);
      if (!pn || !hn) continue;
      edges.push({
        x1: pn.x, y1: pn.y, x2: hn.x, y2: hn.y,
        color: hubColor(p.campaign_hub),
      });
    }

    return { hubs, hubNode, projNode, edges, width: W, height: H };
  }, [projects]);

  // --- Zoom & pan state --------------------------------------------------
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [hoverHub, setHoverHub] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  // live refs so the wheel handler always sees current values without
  // being re-registered on every state change
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [projects.length]);

  // React's synthetic onWheel is passive → preventDefault() silently fails.
  // Attach a native non-passive listener instead so scroll-to-zoom works
  // without the page itself scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handler(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 0.88 : 1.12;
      const next = Math.max(0.4, Math.min(6, zoomRef.current * factor));
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const vx = (mx - panRef.current.x) / zoomRef.current;
      const vy = (my - panRef.current.y) / zoomRef.current;
      setPan({ x: mx - vx * next, y: my - vy * next });
      setZoom(next);
    }
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    dragState.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragState.current) return;
    const s = dragState.current;
    setPan({ x: s.px + (e.clientX - s.sx), y: s.py + (e.clientY - s.sy) });
  }
  function onPointerUp() { dragState.current = null; }

  function zoomBtn(delta: number) {
    setZoom((z) => Math.max(0.4, Math.min(6, z + delta)));
  }
  function reset() { setZoom(1); setPan({ x: 0, y: 0 }); }

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const relatedHub = (p: Project) => hoverHub === p.campaign_hub;
  const isHover = (id: number) => hoverId === id;
  const dimProject = (p: Project) =>
    (hoverId !== null || hoverHub !== null) && !isHover(p.id) && !relatedHub(p);
  const dimHub = (h: string) =>
    (hoverId !== null || hoverHub !== null) && hoverHub !== h
      && !(hoverId !== null && projectsById.get(hoverId)?.campaign_hub === h);

  if (projects.length === 0) {
    return <div className="text-xs text-slate-500 mono py-10 text-center">no projects match current filters</div>;
  }

  return (
    <div ref={containerRef}
         className="relative border border-white/10 rounded-md overflow-hidden"
         style={{
           height: 540,
           background:
             "radial-gradient(ellipse at center, rgba(34,211,238,0.06), transparent 55%)," +
             " radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px) 0 0 / 18px 18px," +
             " #06080b",
         }}>
      {/* Controls — tucked safely inside the canvas with generous padding */}
      <div className="absolute top-3 right-3 z-20 flex gap-1.5 pointer-events-none">
        <button onClick={() => zoomBtn(0.3)}
                className="pointer-events-auto h-8 w-8 rounded-md bg-bg0/90 border border-white/15
                           hover:border-accent/50 text-slate-200 hover:text-accent
                           flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                title="Zoom in"><ZoomIn size={14}/></button>
        <button onClick={() => zoomBtn(-0.3)}
                className="pointer-events-auto h-8 w-8 rounded-md bg-bg0/90 border border-white/15
                           hover:border-accent/50 text-slate-200 hover:text-accent
                           flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                title="Zoom out"><ZoomOut size={14}/></button>
        <button onClick={reset}
                className="pointer-events-auto h-8 w-8 rounded-md bg-bg0/90 border border-white/15
                           hover:border-accent/50 text-slate-200 hover:text-accent
                           flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                title="Reset view"><RotateCcw size={14}/></button>
      </div>
      <div className="absolute bottom-3 left-3 z-20 text-[10px] font-mono text-slate-400
                      bg-bg0/85 border border-white/10 px-2.5 py-1.5 rounded-md
                      flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
        <Move size={10}/>
        drag to pan · scroll to zoom · click a project to open
        <span className="ml-1.5 text-accent">{Math.round(zoom * 100)}%</span>
      </div>

      <svg ref={svgRef}
           className="w-full h-full cursor-grab active:cursor-grabbing select-none"
           onPointerDown={onPointerDown}
           onPointerMove={onPointerMove}
           onPointerUp={onPointerUp}
           onPointerLeave={onPointerUp}>
        <defs>
          {/* Soft glow filter used on hub cores and hovered dots */}
          <filter id="n-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="n-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* One radial gradient per known hub — gives hub cores a
              glassy lit-from-within look instead of a flat disc. */}
          {hubs.map((h) => (
            <radialGradient key={h} id={`n-grad-${h}`} cx="30%" cy="30%" r="75%">
              <stop offset="0%"  stopColor={hubColor(h)} stopOpacity="1" />
              <stop offset="70%" stopColor={hubColor(h)} stopOpacity="0.85" />
              <stop offset="100%" stopColor={hubDark(h)} stopOpacity="0.95" />
            </radialGradient>
          ))}
          {/* One linear gradient per hub for edges — fades toward the hub
              so lines feel directional without arrowheads. */}
          {hubs.map((h) => (
            <linearGradient key={"eg-" + h} id={`n-edge-${h}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor={hubColor(h)} stopOpacity="0.1" />
              <stop offset="100%" stopColor={hubColor(h)} stopOpacity="0.45" />
            </linearGradient>
          ))}
          <style>{`
            @keyframes n-pulse {
              0%, 100% { opacity: 0.28; transform: scale(1); }
              50%      { opacity: 0.55; transform: scale(1.08); }
            }
          `}</style>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <g transform={`translate(${(0 - width / 2) + 640}, ${(0 - height / 2) + 270})`}>

            {/* Curved bezier edges — feel more organic than straight lines */}
            {edges.map((e, i) => {
              const mx = (e.x1 + e.x2) / 2;
              const my = (e.y1 + e.y2) / 2;
              const dx = e.x2 - e.x1;
              const dy = e.y2 - e.y1;
              // perpendicular offset for slight curl
              const cx2 = mx - dy * 0.12;
              const cy2 = my + dx * 0.12;
              const hubName = Object.entries(HUB_COLOR).find(([, c]) => c === e.color)?.[0];
              return (
                <path key={i}
                      d={`M ${e.x1} ${e.y1} Q ${cx2} ${cy2} ${e.x2} ${e.y2}`}
                      stroke={hubName ? `url(#n-edge-${hubName})` : e.color}
                      strokeOpacity={0.55}
                      strokeWidth={0.9 / Math.max(0.5, zoom * 0.55)}
                      fill="none"
                      pointerEvents="none" />
              );
            })}

            {/* Project dots */}
            {projects.map((p) => {
              const n = projNode.get(p.id);
              if (!n) return null;
              const dim = dimProject(p);
              const h = isHover(p.id);
              const r = h ? 7 : 4.2;
              return (
                <g key={p.id}
                   style={{ opacity: dim ? 0.18 : 1, transition: "opacity 120ms" }}
                   onPointerEnter={() => setHoverId(p.id)}
                   onPointerLeave={() => setHoverId(null)}
                   onClick={() => onOpenProject?.(p.id)}
                   className="cursor-pointer">
                  {/* soft halo behind each dot */}
                  <circle cx={n.x} cy={n.y} r={r + 3}
                          fill={hubColor(n.hub)}
                          fillOpacity={h ? 0.35 : 0.12}/>
                  <circle cx={n.x} cy={n.y} r={r}
                          fill={hubColor(n.hub)}
                          fillOpacity={h ? 1 : 0.88}
                          stroke={h ? "#fff" : "rgba(0,0,0,0.55)"}
                          strokeWidth={h ? 1.3 : 0.7}
                          filter={h ? "url(#n-glow)" : undefined}/>
                  {h && (
                    <g pointerEvents="none">
                      <rect x={n.x + 10} y={n.y - 13}
                            width={Math.max(110, p.name.length * 6.6 + 16)} height={26}
                            rx={4}
                            fill="rgba(7,8,9,0.95)"
                            stroke="rgba(34,211,238,0.5)"
                            strokeWidth={1}/>
                      <text x={n.x + 18} y={n.y + 1}
                            fill="#e2e8f0" fontSize={11} fontWeight={600}
                            fontFamily="JetBrains Mono">
                        {p.name}
                      </text>
                      <text x={n.x + 18} y={n.y + 13}
                            fill="#64748b" fontSize={9}
                            fontFamily="JetBrains Mono">
                        {p.project_type}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Hub cores — drawn last so they sit above dots */}
            {hubs.map((h) => {
              const n = hubNode.get(h)!;
              const dim = dimHub(h);
              const r = 20 + Math.sqrt(n.count) * 2.4;
              return (
                <g key={h}
                   style={{ opacity: dim ? 0.28 : 1, transition: "opacity 140ms" }}
                   onPointerEnter={() => setHoverHub(h)}
                   onPointerLeave={() => setHoverHub(null)}>
                  {/* pulsing outer bloom */}
                  <circle cx={n.x} cy={n.y} r={r + 18}
                          fill={hubColor(h)}
                          style={{
                            transformOrigin: `${n.x}px ${n.y}px`,
                            animation: "n-pulse 3.2s ease-in-out infinite",
                            filter: "blur(6px)",
                          }}/>
                  {/* subtle outer ring */}
                  <circle cx={n.x} cy={n.y} r={r + 6}
                          fill="none"
                          stroke={hubColor(h)}
                          strokeOpacity={0.35}
                          strokeWidth={1} />
                  {/* hub core (gradient-filled) */}
                  <circle cx={n.x} cy={n.y} r={r}
                          fill={`url(#n-grad-${h})`}
                          stroke="rgba(0,0,0,0.55)"
                          strokeWidth={1}
                          filter="url(#n-glow)"/>
                  {/* label */}
                  <text x={n.x} y={n.y + 4}
                        textAnchor="middle"
                        fill="#0a0b0f"
                        fontSize={12}
                        fontFamily="JetBrains Mono"
                        fontWeight={800}
                        letterSpacing="0.5"
                        pointerEvents="none">
                    {h}
                  </text>
                  {/* count sits inside a pill below */}
                  <g pointerEvents="none">
                    <rect x={n.x - 24} y={n.y + r + 6} width={48} height={16}
                          rx={8}
                          fill="rgba(7,8,9,0.9)"
                          stroke={hubColor(h)}
                          strokeOpacity={0.6}
                          strokeWidth={1}/>
                    <text x={n.x} y={n.y + r + 17}
                          textAnchor="middle"
                          fill={hubColor(h)}
                          fontSize={10}
                          fontFamily="JetBrains Mono"
                          fontWeight={600}>
                      {n.count} proj
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
