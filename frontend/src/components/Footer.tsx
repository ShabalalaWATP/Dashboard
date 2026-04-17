import { DoorOpen, Library, Building2, Send, ArrowUpRight } from "lucide-react";
import type { PublicSettings } from "../types";


type LinkSlot = {
  label: string;
  url: string;
  description: string;
  icon: React.ReactNode;
  accent: string;     // border/text colour class
  glow: string;       // bg tint class
};


export function Footer({ settings }: { settings: PublicSettings }) {
  const email = (settings.team_email || "").trim();
  const subject = encodeURIComponent(settings.team_email_subject || "Cyber Research Team enquiry");
  const mailto = email ? `mailto:${email}?subject=${subject}` : "";

  const slots: LinkSlot[] = [
    {
      label: settings.footer_link_1_label || "The Team Front Door",
      url: (settings.footer_link_1_url || "").trim(),
      description: settings.footer_link_1_description
        || "The team's homepage — announcements, meetings, rota.",
      icon: <DoorOpen size={20} />,
      accent: "text-cyan-300 border-cyan-400/40 hover:border-cyan-400/80",
      glow: "bg-cyan-500/5 hover:bg-cyan-500/10",
    },
    {
      label: settings.footer_link_2_label || "Cyber Research Team Confluence",
      url: (settings.footer_link_2_url || "").trim(),
      description: settings.footer_link_2_description
        || "Technical documentation, project archives, and tradecraft notes.",
      icon: <Library size={20} />,
      accent: "text-fuchsia-300 border-fuchsia-400/40 hover:border-fuchsia-400/80",
      glow: "bg-fuchsia-500/5 hover:bg-fuchsia-500/10",
    },
    {
      label: settings.footer_link_3_label || "O3 Confluence Page",
      url: (settings.footer_link_3_url || "").trim(),
      description: settings.footer_link_3_description
        || "Where the team sits in O3 — org chart, remit, stakeholders.",
      icon: <Building2 size={20} />,
      accent: "text-violet-300 border-violet-400/40 hover:border-violet-400/80",
      glow: "bg-violet-500/5 hover:bg-violet-500/10",
    },
    {
      label: "Email Us",
      url: mailto,
      description: settings.team_email_description
        || "For questions or anything else not covered by the resources above.",
      icon: <Send size={20} />,
      accent: "text-emerald-300 border-emerald-400/40 hover:border-emerald-400/80",
      glow: "bg-emerald-500/5 hover:bg-emerald-500/10",
    },
  ];

  return (
    <footer className="mt-12 border-t border-white/10 bg-bg0/40 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-accent/30 to-transparent" />
      <div className="max-w-[1600px] mx-auto px-5 py-10">
        <h2 className="card-title">{settings.footer_heading || "About the Team"}</h2>
        <div className="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-line max-w-4xl md-body">
          {settings.about_team}
        </div>

        {/* Big resource cards — admin-editable label + description + icon */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map((s, i) => <ResourceCard key={i} slot={s} />)}
        </div>

        <div className="mt-10 text-[10px] text-slate-500 font-mono tracking-widest uppercase
                        flex justify-between items-center border-t border-white/5 pt-4">
          <span className="flex items-center gap-2">
            <span className="text-emerald-400 led" />
            <span>
              {settings.team_name}
              {settings.footer_tagline ? ` · ${settings.footer_tagline}` : ""}
            </span>
          </span>
          <span className="text-accent/70">
            {settings.classification_text}
          </span>
        </div>
      </div>
    </footer>
  );
}


function ResourceCard({ slot }: { slot: LinkSlot }) {
  const active = !!slot.url;

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`h-11 w-11 rounded-md border flex items-center justify-center
                         ${active ? slot.accent : "border-white/10 text-slate-600"}
                         ${active ? slot.glow : "bg-white/[0.02]"}`}>
          {slot.icon}
        </div>
        {active
          ? <ArrowUpRight size={14} className={`${slot.accent.split(" ")[0]} opacity-60 group-hover:opacity-100 transition-opacity`} />
          : <span className="text-[9px] font-mono text-slate-600 tracking-wider mt-1">NOT SET</span>}
      </div>
      <div className={`text-[13px] font-semibold mb-1.5 leading-tight
                       ${active ? "text-slate-100" : "text-slate-500"}`}>
        {slot.label}
      </div>
      <div className={`text-[11px] leading-relaxed font-mono flex-1
                       ${active ? "text-slate-400" : "text-slate-600 italic"}`}>
        {slot.description}
      </div>
      {active && (
        <div className={`mt-3 text-[10px] font-mono uppercase tracking-[0.22em]
                         ${slot.accent.split(" ")[0]} opacity-70 group-hover:opacity-100 transition-opacity`}>
          Open →
        </div>
      )}
    </div>
  );

  const shared = `panel-hover relative block group p-4 rounded-md border transition-colors min-h-[170px]
                  ${active ? slot.accent.replace("text-", "").split(" ").filter(c => c.startsWith("border") || c.startsWith("hover")).join(" ") + " " + slot.glow
                           : "border-white/10 bg-white/[0.01]"}`;

  if (active) {
    return (
      <a href={slot.url} target="_blank" rel="noreferrer" className={shared}>
        {body}
      </a>
    );
  }
  return (
    <div className={shared}
         title="Not configured yet — ask an admin to set the URL in Admin → Appearance">
      {body}
    </div>
  );
}
