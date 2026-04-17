import { useEffect, useState, useCallback } from "react";
import {
  BarChart3, Cpu, Workflow, Users2, BookOpen, FolderOpen,
} from "lucide-react";
import { ClassificationBar } from "./components/ClassificationBar";
import { TopBar } from "./components/TopBar";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { LoginModal } from "./components/LoginModal";
import { AdminPanel } from "./components/AdminPanel";
import { ChatPanel } from "./components/ChatPanel";
import { FilterBar } from "./components/FilterBar";
import { ProjectDetail } from "./components/ProjectDetail";
import { SearchPalette, useSearchPaletteHotkey } from "./components/SearchPalette";
import { Overview } from "./tabs/Overview";
import { TypesTech } from "./tabs/TypesTech";
import { Lifecycle } from "./tabs/Lifecycle";
import { Collaboration } from "./tabs/Collaboration";
import { Catalog } from "./tabs/Catalog";
import { Projects } from "./tabs/Projects";
import { api } from "./api";
import { useAuth } from "./auth";
import { DataProvider, useData } from "./filters";
import type { PublicSettings, Project } from "./types";


const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "types", label: "Types, Tools & Tech", icon: Cpu },
  { id: "lifecycle", label: "Lifecycle", icon: Workflow },
  { id: "collab", label: "Collaboration", icon: Users2 },
  { id: "catalog", label: "Catalogs", icon: BookOpen },
] as const;

type TabId = typeof TABS[number]["id"];


export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}


function Shell() {
  const { user } = useAuth();
  const { allProjects, loading } = useData();
  const [tab, setTab] = useState<TabId>("overview");
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [teamLogoSrc, setTeamLogoSrc] = useState<string | null>(null);
  const [heroLogoSrc, setHeroLogoSrc] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [routedProjectId, setRoutedProjectId] = useState<number | null>(null);

  useSearchPaletteHotkey(() => setShowPalette(true));

  const loadPublic = useCallback(async () => {
    try {
      const s = await api.get<PublicSettings>("/api/settings/public");
      setSettings(s);
    } catch { /* ignore */ }
    // Cache-bust the logo URLs per page load so a freshly-uploaded image is
    // always picked up. The asset path is stable, so without ?v= the browser
    // would keep serving the cached previous upload.
    const v = Date.now();
    probeImg(`/api/settings/asset/team-logo?v=${v}`).then(setTeamLogoSrc);
    probeImg(`/api/settings/asset/hero-logo?v=${v}`).then(setHeroLogoSrc);
  }, []);

  useEffect(() => { loadPublic(); }, [loadPublic]);

  if (!settings || (loading && allProjects.length === 0)) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-mono text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
          loading portfolio…
        </div>
      </div>
    );
  }

  // Project-open behaviour differs by role:
  //   admin  → fast-peek modal (ProjectDetail) — good for chart drill-downs
  //   viewer → navigate to Projects tab with the row pre-selected
  const isAdmin = user?.role === "admin";
  const openProject = (id: number) => {
    if (isAdmin) {
      setViewingId(id);
    } else {
      setRoutedProjectId(id);
      setTab("projects");
    }
  };
  const viewing: Project | undefined = allProjects.find((p) => p.id === viewingId);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky stack: thin classification banner on top, main bar below */}
      <div className="sticky top-0 z-40">
        <ClassificationBar settings={settings} />
        <TopBar settings={settings} teamLogoSrc={teamLogoSrc}
                onOpenLogin={() => setShowLogin(true)}
                onOpenAdmin={() => setShowAdmin(true)}
                onOpenSearch={() => setShowPalette(true)} />
      </div>
      <Hero settings={settings} heroLogoSrc={heroLogoSrc} />

      <main className="max-w-[1600px] w-full mx-auto px-5 flex-1">
        {/* Tabs — terminal-style with bracket indicator on active */}
        <div className="flex gap-0 border-b border-white/10 mb-4 overflow-x-auto">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-[11px] font-mono tracking-[0.16em]
                            uppercase whitespace-nowrap border-b-2 -mb-px
                  ${active
                    ? "border-accent text-accent bg-accent/[0.04]"
                    : "border-transparent text-slate-500 hover:text-slate-200 hover:bg-white/[0.02]"}`}>
                {active && <span className="text-accent/70 mr-0.5">[</span>}
                <Icon size={12}/>
                <span>{t.label}</span>
                {active && <span className="text-accent/70 ml-0.5">]</span>}
                <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-px bg-white/5" />
                {i === 0 && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-px bg-white/5" />}
              </button>
            );
          })}
        </div>

        {/* Global filter bar — sticky container is opaque so scrolling
            content is fully hidden underneath. Full page-bleed bg via -mx-5. */}
        <div className="sticky top-[84px] z-40 -mx-5 px-5 pt-3 pb-4 mb-3 bg-bg0
                        border-b border-white/5 shadow-[0_8px_16px_rgba(0,0,0,0.55)]">
          <FilterBar settings={settings} />
        </div>

        {tab === "overview"  && <Overview onOpenProject={openProject} settings={settings} />}
        {tab === "projects"  && <Projects externalSelectedId={routedProjectId}
                                           onConsumeExternal={() => setRoutedProjectId(null)} />}
        {tab === "types"     && <TypesTech settings={settings} />}
        {tab === "lifecycle" && <Lifecycle onOpenProject={openProject} />}
        {tab === "collab"    && <Collaboration settings={settings} />}
        {tab === "catalog"   && <Catalog onOpenProject={openProject} settings={settings} />}
      </main>

      <Footer settings={settings} />
      <ChatPanel />

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showAdmin && user && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
      {showPalette && (
        <SearchPalette onClose={() => setShowPalette(false)}
                       onOpenProject={openProject} />
      )}
      {/* Quick-peek modal is admin-only; viewers access projects via the Projects tab. */}
      {viewing && isAdmin && <ProjectDetail project={viewing} onClose={() => setViewingId(null)} />}
    </div>
  );
}


async function probeImg(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    return res.ok ? path : null;
  } catch { return null; }
}
