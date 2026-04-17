import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api } from "./api";
import type { Project, FilterState, Catalogs, PublicSettings } from "./types";
import { EMPTY_FILTER, EMPTY_CATALOGS } from "./types";
import { applyFilters, computeAggregations } from "./aggregations";
import type { Aggregations } from "./aggregations";


type DataCtx = {
  allProjects: Project[];
  filtered: Project[];
  agg: Aggregations;
  catalogs: Catalogs;
  settings: PublicSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshCatalogs: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  filters: FilterState;
  setFilters: (updater: (f: FilterState) => FilterState) => void;
  resetFilters: () => void;
  patchFilter: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void;
  toggleFilter: <K extends keyof FilterState>(k: K, value: string) => void;
  activeFilterCount: number;
};

const Ctx = createContext<DataCtx | null>(null);


export function DataProvider({ children }: { children: React.ReactNode }) {
  const [allProjects, setAll] = useState<Project[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [filters, setFiltersState] = useState<FilterState>(EMPTY_FILTER);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Project[]>("/api/projects");
      setAll(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCatalogs = useCallback(async () => {
    try {
      const d = await api.get<{ catalogs: Catalogs }>("/api/settings/catalogs");
      setCatalogs({ ...EMPTY_CATALOGS, ...d.catalogs });
    } catch { /* ignore */ }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.get<PublicSettings>("/api/settings/public");
      setSettings(s);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); refreshCatalogs(); refreshSettings(); }, [refresh, refreshCatalogs, refreshSettings]);

  const filtered = useMemo(() => applyFilters(allProjects, filters), [allProjects, filters]);
  const agg = useMemo(() => computeAggregations(allProjects, filtered), [allProjects, filtered]);

  const setFilters = useCallback((updater: (f: FilterState) => FilterState) => {
    setFiltersState((prev) => updater(prev));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(EMPTY_FILTER), []);

  const patchFilter = useCallback(<K extends keyof FilterState>(k: K, v: FilterState[K]) => {
    setFiltersState((prev) => ({ ...prev, [k]: v }));
  }, []);

  const toggleFilter = useCallback(<K extends keyof FilterState>(k: K, value: string) => {
    setFiltersState((prev) => {
      const arr = prev[k] as unknown as string[];
      if (!Array.isArray(arr)) return prev;
      const nextArr = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      return { ...prev, [k]: nextArr as any };
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.status !== "all") n++;
    if (filters.date_from) n++;
    if (filters.date_to) n++;
    for (const key of [
      "hubs","types","outcomes","technologies","tools",
      "collaborators","languages","architectures","customers","tags",
    ] as const) {
      n += (filters[key] as string[]).length;
    }
    return n;
  }, [filters]);

  const value: DataCtx = {
    allProjects, filtered, agg, catalogs, settings, loading,
    refresh, refreshCatalogs, refreshSettings,
    filters, setFilters, resetFilters, patchFilter, toggleFilter,
    activeFilterCount,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}


export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used inside <DataProvider>");
  return v;
}
