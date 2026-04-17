import type { Project } from "../types";
import { fmtDate } from "../dates";

export function RecentProjects({
  items, onOpen,
}: {
  items: Project[];
  onOpen: (id: number) => void;
}) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-slate-500 mono py-6 text-center">no projects match current filters</div>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="pb-2 pr-3 font-medium">Codename</th>
            <th className="pb-2 pr-3 font-medium">Type</th>
            <th className="pb-2 pr-3 font-medium">Hub</th>
            <th className="pb-2 pr-3 font-medium">Status</th>
            <th className="pb-2 pr-3 font-medium">Lead</th>
            <th className="pb-2 pr-3 font-medium">Customer</th>
            <th className="pb-2 pr-3 font-medium">Dates</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}
                onClick={() => onOpen(p.id)}
                className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer">
              <td className="py-2 pr-3 mono text-slate-100">{p.name}</td>
              <td className="py-2 pr-3 text-slate-300">{p.project_type}</td>
              <td className="py-2 pr-3 text-slate-300">{p.campaign_hub}</td>
              <td className="py-2 pr-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono
                  ${p.status === "open"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-500/15 text-slate-400 border border-slate-500/30"}`}>
                  {p.status}
                </span>
              </td>
              <td className="py-2 pr-3 text-slate-300">{p.project_lead || "—"}</td>
              <td className="py-2 pr-3 text-slate-400">{p.end_customer || "—"}</td>
              <td className="py-2 pr-3 mono text-slate-500 whitespace-nowrap">
                {fmtDate(p.start_date)}{p.end_date ? " → " + fmtDate(p.end_date) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
