import { useState } from "react";
import { Shield, LogIn, LogOut, Settings, Search } from "lucide-react";
import { useAuth } from "../auth";
import type { PublicSettings } from "../types";

export function TopBar({
  settings,
  onOpenLogin,
  onOpenAdmin,
  onOpenSearch,
  teamLogoSrc,
}: {
  settings: PublicSettings;
  onOpenLogin: () => void;
  onOpenAdmin: () => void;
  onOpenSearch: () => void;
  teamLogoSrc: string | null;
}) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isMac = typeof navigator !== "undefined"
    && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

  return (
    <div className="relative border-b border-white/10 backdrop-blur-md bg-bg0/85">
      {/* Hairline scan line across the very bottom of the top bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-accent/40 to-transparent opacity-60" />
      <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center gap-4">

        {/* Left group: small logo + team name chip */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="h-10 w-[140px] flex items-center justify-start">
            {teamLogoSrc ? (
              // w-full h-full makes the image actually fill the 140×40 slot
              // (the old max-h-full/max-w-full only CAPPED the size — small
              // images would render tiny). object-contain preserves the
              // image's aspect ratio inside those bounds so nothing is
              // stretched or cropped.
              <img src={teamLogoSrc} alt="team"
                   className="h-full w-full object-contain" />
            ) : (
              <div className="h-9 w-full border border-dashed border-white/15 rounded
                              flex items-center justify-center text-[9px] text-slate-500
                              tracking-widest font-mono">
                TEAM LOGO
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400 led" />
            <span className="tracking-widest uppercase text-slate-500">
              [{settings.team_name || "CYBER RESEARCH"}]
            </span>
          </div>
        </div>

        {/* Centred title in the middle of the top bar */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 text-slate-100">
            <Shield size={14} className="text-accent" />
            <span className="text-xs uppercase tracking-[0.22em] font-mono text-slate-200 whitespace-nowrap">
              {settings.app_title || "Cyber Research Portfolio"}
            </span>
          </div>
        </div>

        {/* Search trigger */}
        <button onClick={onOpenSearch}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-white/10
                           hover:border-accent/40 text-[11px] font-mono text-slate-400 hover:text-slate-200">
          <Search size={11} />
          <span>SEARCH</span>
          <span className="text-[9px] text-slate-500 border border-white/10 rounded-sm px-1 py-0.5 ml-2">
            {isMac ? "⌘K" : "^K"}
          </span>
        </button>

        {/* Auth */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 border border-white/10
                         hover:border-accent/40 text-[11px] font-mono"
            >
              <Settings size={12} />
              <span className="mono uppercase">{user.username}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 panel p-2 text-sm">
                <button
                  onClick={() => { setMenuOpen(false); onOpenAdmin(); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 text-xs font-mono uppercase tracking-wider"
                >
                  Admin Settings
                </button>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-xs font-mono uppercase tracking-wider"
                >
                  <LogOut size={12} /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/10
                       hover:border-accent/40 text-[11px] font-mono uppercase tracking-wider"
          >
            <LogIn size={12} /> Admin
          </button>
        )}
      </div>
    </div>
  );
}
