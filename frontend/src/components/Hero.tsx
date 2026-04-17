import type { PublicSettings } from "../types";

export function Hero({ settings, heroLogoSrc }: {
  settings: PublicSettings;
  heroLogoSrc: string | null;
}) {
  return (
    <div className="relative overflow-hidden">
      {/* Crosshair grid backdrop */}
      <div className="absolute inset-0 crosshair-bg opacity-50 pointer-events-none"
           style={{ maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)" }} />

      <div className="relative max-w-[1600px] mx-auto px-5 pt-10 pb-8 flex flex-col items-center">
        {/* Corner ticks on hero */}
        <div className="absolute top-8 left-8 w-4 h-4 border-l border-t border-accent/30" />
        <div className="absolute top-8 right-8 w-4 h-4 border-r border-t border-accent/30" />
        <div className="absolute bottom-4 left-8 w-4 h-4 border-l border-b border-accent/30" />
        <div className="absolute bottom-4 right-8 w-4 h-4 border-r border-b border-accent/30" />

        {/* Hero logo container: invisible rectangle reserving a 160×360 slot.
            Uploaded images are object-contained so they keep their aspect ratio
            within that footprint. Nothing shown when no image is uploaded. */}
        <div className="relative h-40 w-full max-w-[360px] flex items-center justify-center">
          {heroLogoSrc && (
            // w-full h-full fills the 160×360 slot exactly (the old
            // max-h/max-w only capped the size; a small logo would render
            // tiny in the middle). object-contain keeps the aspect ratio so
            // nothing is stretched.
            <img src={heroLogoSrc} alt="hero"
                 className="h-full w-full object-contain glow-cyan
                            animate-[float_6s_ease-in-out_infinite]" />
          )}
        </div>

        <div className="mt-5 text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono text-accent/70 tracking-[0.3em] uppercase mb-2">
            <span className="h-px w-6 bg-accent/40" />
            dashboard
            <span className="h-px w-6 bg-accent/40" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
            {settings.team_name || "Cyber Research Team"}
          </h1>
          <p className="mt-2 text-[11px] text-slate-500 font-mono tracking-widest uppercase">
            VULN RESEARCH · REVERSE ENG · EXPLOIT DEV
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
