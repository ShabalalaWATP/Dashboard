import React from "react";

export function Card({
  title,
  subtitle,
  children,
  className = "",
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`panel panel-hover p-5 ${className}`}>
      {(title || subtitle || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && (
              <p className="text-[11px] text-slate-500 mt-1 font-mono tracking-tight">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function KPI({
  label, value, sub, icon, tone = "accent",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "accent" | "magenta" | "emerald" | "amber" | "rose" | "sky" | "slate";
}) {
  const toneCls = {
    accent:  "text-accent",
    magenta: "text-magenta",
    emerald: "text-emerald-400",
    amber:   "text-amber-400",
    rose:    "text-rose-400",
    sky:     "text-sky-400",
    slate:   "text-slate-200",
  }[tone];
  return (
    <div className="panel panel-hover p-4 flex flex-col gap-1.5 relative overflow-hidden">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 flex items-center gap-1.5">
        {icon && <span className={toneCls}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={`mono-tab text-[28px] font-semibold leading-none ${toneCls}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] font-mono text-slate-500 tracking-wide">
          {sub}
        </div>
      )}
    </div>
  );
}
