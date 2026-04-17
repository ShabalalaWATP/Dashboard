import type { Project, FilterState, LabelValue } from "./types";

import { STAGE_ORDER as STAGES_CANONICAL } from "./stagePalette";
const STAGE_ORDER = STAGES_CANONICAL as readonly string[];

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function applyFilters(projects: Project[], f: FilterState): Project[] {
  const q = f.search.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return projects.filter((p) => {
    if (f.status !== "all" && p.status !== f.status) return false;
    if (f.hubs.length && !f.hubs.includes(p.campaign_hub)) return false;
    if (f.types.length && !f.types.includes(p.project_type)) return false;
    if (f.outcomes.length && !f.outcomes.includes(p.outcome)) return false;
    if (f.technologies.length && !f.technologies.some((t) => p.technologies.includes(t))) return false;
    if (f.tools.length && !f.tools.some((t) => p.tools.includes(t))) return false;
    if (f.collaborators.length && !f.collaborators.some((c) => p.collaborators.includes(c))) return false;
    if (f.languages.length && !f.languages.some((l) => p.languages.includes(l))) return false;
    if (f.architectures.length && p.cpu_arch && !f.architectures.includes(p.cpu_arch)) return false;
    if (f.architectures.length && !p.cpu_arch) return false;
    if (f.customers.length && !f.customers.includes(p.end_customer)) return false;
    if (f.tags.length && !f.tags.some((t) => p.tags.includes(t))) return false;

    // Date-range overlap: include if the project's active period intersects the
    // filter window. Open projects are treated as active up to today.
    const projectEnd = p.end_date || today;
    if (f.date_from && projectEnd < f.date_from) return false;
    if (f.date_to && p.start_date > f.date_to) return false;

    if (q) {
      const hay = [
        p.name, p.project_type, p.campaign_hub, p.end_customer,
        p.target_vendor, p.target_product, p.project_lead, p.ticket_ref,
        ...p.technologies, ...p.tools, ...p.os_list, ...p.tags, ...p.languages,
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}


/** Build LabelValue[] from a key extractor, sorted desc, optionally topN+Other. */
function countBy<T>(rows: T[], key: (r: T) => string | null | undefined,
                    topN?: number): LabelValue[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
  if (topN && arr.length > topN) {
    const head = arr.slice(0, topN);
    const tail = arr.slice(topN).reduce((s, x) => s + x.value, 0);
    if (tail > 0) head.push({ label: "Other", value: tail });
    return head;
  }
  return arr;
}


function countByMany<T>(rows: T[], key: (r: T) => string[]): LabelValue[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const k of key(r)) {
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}


export function computeAggregations(all: Project[], filtered: Project[]) {
  const total = filtered.length;
  const open = filtered.filter((p) => p.status === "open").length;
  const closed = total - open;

  const durations = filtered.filter((p) => p.end_date).map((p) => daysBetween(p.start_date, p.end_date!));
  const avg_duration_days = durations.length ? +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const total_person_months = +filtered.reduce((s, p) => {
    const end = p.end_date ?? today;
    const days = Math.max(1, daysBetween(p.start_date, end));
    return s + (days / 30) * p.team_size;
  }, 0).toFixed(1);

  // New EST measures
  const vulnerabilities_discovered = filtered.reduce((s, p) => s + (p.vulnerabilities_discovered || 0), 0);
  const hs_equities = filtered.reduce((s, p) => s + (p.hs_equities || 0), 0);
  const operational_successes = filtered.filter((p) => p.operational_success).length;
  const projects_completed = closed;

  const type_breakdown = countBy(filtered, (p) => p.project_type);
  const hub_breakdown = countBy(filtered, (p) => p.campaign_hub);
  const outcome_breakdown = countBy(filtered.filter((p) => p.status === "closed"), (p) => p.outcome);

  // --- Workload over time --------------------------------------------------
  // Two series, one chart:
  //   active: number of projects live at any point in the month
  //   completed: number of projects closed in that specific month
  // This is easier to read than raw "opened vs closed" deltas because it
  // reflects actual team workload at a given moment.
  const todayISO = new Date().toISOString().slice(0, 10);
  const activeMap = new Map<string, number>();
  const completedMap = new Map<string, number>();

  function* monthRange(from: string, to: string) {
    const a = new Date(from + "T00:00:00Z");
    const b = new Date(to + "T00:00:00Z");
    const cur = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
    const stop = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1));
    while (cur.getTime() <= stop.getTime()) {
      yield `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`;
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  }

  for (const p of filtered) {
    const endIso = p.end_date || todayISO;
    for (const m of monthRange(p.start_date, endIso)) {
      activeMap.set(m, (activeMap.get(m) || 0) + 1);
    }
    if (p.end_date) {
      const ek = monthKey(p.end_date);
      completedMap.set(ek, (completedMap.get(ek) || 0) + 1);
    }
  }
  const months = Array.from(new Set([...activeMap.keys(), ...completedMap.keys()])).sort();
  const over_time = months.map((m) => ({
    month: m,
    active: activeMap.get(m) || 0,
    completed: completedMap.get(m) || 0,
  }));

  // Technology × Type stacked
  const techByType = new Map<string, Map<string, number>>();
  const techAll = new Map<string, number>();
  for (const p of filtered) {
    const byT = techByType.get(p.project_type) ?? new Map<string, number>();
    for (const t of p.technologies) {
      byT.set(t, (byT.get(t) || 0) + 1);
      techAll.set(t, (techAll.get(t) || 0) + 1);
    }
    techByType.set(p.project_type, byT);
  }
  const top_tech = Array.from(techAll.entries()).sort((a, b) => b[1] - a[1])
    .slice(0, 10).map(([k]) => k);
  const types = Array.from(new Set(filtered.map((p) => p.project_type)));
  const stacked_type_tech = {
    rows: types.map((t) => {
      const row: Record<string, any> = { type: t };
      for (const tech of top_tech) row[tech] = techByType.get(t)?.get(tech) || 0;
      return row;
    }),
    keys: top_tech,
  };

  const treemap_tech = Array.from(techAll.entries()).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Heatmap Type × Hub
  const hubs = Array.from(new Set(filtered.map((p) => p.campaign_hub)));
  const typeHub = new Map<string, Map<string, number>>();
  for (const p of filtered) {
    const byH = typeHub.get(p.project_type) ?? new Map<string, number>();
    byH.set(p.campaign_hub, (byH.get(p.campaign_hub) || 0) + 1);
    typeHub.set(p.project_type, byH);
  }
  const heatmap_type_hub = {
    rows: types, cols: hubs,
    matrix: types.map((t) => hubs.map((h) => typeHub.get(t)?.get(h) || 0)),
  };

  // Stage analytics (closed only)
  const stageData = new Map<string, number[]>();
  for (const p of filtered) {
    if (p.status !== "closed") continue;
    for (const s of p.stages) {
      if (!stageData.has(s.stage_name)) stageData.set(s.stage_name, []);
      stageData.get(s.stage_name)!.push(s.days_spent);
    }
  }
  const stage_avg = STAGE_ORDER.map((s) => {
    const v = stageData.get(s) || [];
    return {
      stage: s,
      avg_days: v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0,
      total_days: v.reduce((a, b) => a + b, 0),
    };
  });

  const stage_flow = STAGE_ORDER.slice(0, -1).map((s, i) => {
    const target = STAGE_ORDER[i + 1];
    let value = 0;
    for (const p of filtered) {
      if (p.status !== "closed") continue;
      const map = new Map(p.stages.map((x) => [x.stage_name, x.days_spent]));
      if ((map.get(s) ?? 0) > 0 && (map.get(target) ?? 0) > 0) value += 1;
    }
    return { source: s, target, value };
  });

  // --- Duration distribution (closed projects only) ------------------------
  // Week-granularity buckets from 2 weeks up to 9 months. Values are in days
  // (1 week = 7 days). Bins beyond 9 months collapse into a 9mo+ tail so the
  // chart doesn't stretch for the occasional multi-year project.
  const BUCKETS: { label: string; lo: number; hi: number }[] = [
    { label: "< 2w",  lo: 0,   hi: 14 },
    { label: "2–4w", lo: 14,  hi: 28 },
    { label: "1–2mo", lo: 28,  hi: 61 },
    { label: "2–3mo", lo: 61,  hi: 92 },
    { label: "3–4mo", lo: 92,  hi: 122 },
    { label: "4–6mo", lo: 122, hi: 183 },
    { label: "6–9mo", lo: 183, hi: 274 },
    { label: "9mo+",  lo: 274, hi: Infinity },
  ];
  const bucketCounts = BUCKETS.map(() => 0);
  const closedDurations: number[] = [];
  for (const p of filtered) {
    if (!p.end_date) continue;
    const d = daysBetween(p.start_date, p.end_date);
    closedDurations.push(d);
    const idx = BUCKETS.findIndex((b) => d >= b.lo && d < b.hi);
    if (idx >= 0) bucketCounts[idx]++;
  }
  const histogram: LabelValue[] = BUCKETS.map((b, i) => ({ label: b.label, value: bucketCounts[i] }));
  const median_duration = closedDurations.length
    ? Math.round([...closedDurations].sort((a, b) => a - b)[Math.floor(closedDurations.length / 2)])
    : 0;

  const tool_freq = countByMany(filtered, (p) => p.tools);
  const os_dist = countByMany(filtered, (p) => p.os_list);
  const language_dist = countByMany(filtered, (p) => p.languages);
  const arch_dist = countBy(filtered, (p) => p.cpu_arch || null);
  const tag_freq = countByMany(filtered, (p) => p.tags);

  // --- Top-of-class picks (used by the Types & Tech KPI strip) -------------
  const topOf = (arr: LabelValue[]) => arr[0] || null;
  const top_technology_item = topOf(treemap_tech.map((t) => ({ label: t.name, value: t.value })));
  const top_tool_item = topOf(tool_freq);
  const top_os_item = topOf(os_dist);
  const top_language_item = topOf(language_dist);
  const top_arch_item = topOf(arch_dist);

  // --- Tech × Campaign matrix -- which campaigns touch each tech -----------
  const techHub = new Map<string, Map<string, number>>();
  for (const p of filtered) {
    for (const t of p.technologies) {
      const m = techHub.get(t) ?? new Map<string, number>();
      m.set(p.campaign_hub, (m.get(p.campaign_hub) || 0) + 1);
      techHub.set(t, m);
    }
  }
  const tech_rows = top_technology_item
    ? Array.from(techAll.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)
    : [];
  const hub_cols_all = Array.from(new Set(filtered.map((p) => p.campaign_hub)));
  const heatmap_tech_hub = {
    rows: tech_rows,
    cols: hub_cols_all,
    matrix: tech_rows.map((t) => hub_cols_all.map((h) => techHub.get(t)?.get(h) || 0)),
  };

  // --- Tech × CPU architecture matrix --------------------------------------
  const techArch = new Map<string, Map<string, number>>();
  for (const p of filtered) {
    if (!p.cpu_arch) continue;
    for (const t of p.technologies) {
      const m = techArch.get(t) ?? new Map<string, number>();
      m.set(p.cpu_arch, (m.get(p.cpu_arch) || 0) + 1);
      techArch.set(t, m);
    }
  }
  const arch_cols = Array.from(new Set(filtered.map((p) => p.cpu_arch).filter(Boolean)));
  const heatmap_tech_arch = {
    rows: tech_rows,
    cols: arch_cols,
    matrix: tech_rows.map((t) => arch_cols.map((a) => techArch.get(t)?.get(a) || 0)),
  };

  // --- Language × Project Type matrix --------------------------------------
  const langType = new Map<string, Map<string, number>>();
  for (const p of filtered) {
    for (const l of p.languages) {
      const m = langType.get(l) ?? new Map<string, number>();
      m.set(p.project_type, (m.get(p.project_type) || 0) + 1);
      langType.set(l, m);
    }
  }
  const lang_rows = Array.from(langType.keys())
    .sort((a, b) => {
      const sa = Array.from(langType.get(a)!.values()).reduce((x, y) => x + y, 0);
      const sb = Array.from(langType.get(b)!.values()).reduce((x, y) => x + y, 0);
      return sb - sa;
    })
    .slice(0, 10);
  const type_cols = Array.from(new Set(filtered.map((p) => p.project_type)));
  const heatmap_lang_type = {
    rows: lang_rows,
    cols: type_cols,
    matrix: lang_rows.map((l) => type_cols.map((t) => langType.get(l)?.get(t) || 0)),
  };

  // Tools × Type matrix
  const toolsByType = new Map<string, Map<string, number>>();
  const toolsAll = new Map<string, number>();
  for (const p of filtered) {
    const byT = toolsByType.get(p.project_type) ?? new Map<string, number>();
    for (const t of p.tools) {
      byT.set(t, (byT.get(t) || 0) + 1);
      toolsAll.set(t, (toolsAll.get(t) || 0) + 1);
    }
    toolsByType.set(p.project_type, byT);
  }
  const top_tools = Array.from(toolsAll.entries()).sort((a, b) => b[1] - a[1])
    .slice(0, 12).map(([k]) => k);
  const tool_matrix = {
    rows: types, cols: top_tools,
    matrix: types.map((t) => top_tools.map((tool) => toolsByType.get(t)?.get(tool) || 0)),
  };

  const end_customers = countBy(filtered, (p) => p.end_customer || null);

  // Network (hubs at the centre, collaborators + customers around them).
  // Three node kinds now — hubs, collaborators, customers — all interlinked
  // via the campaign hub: an edge exists from the hub to every collaborator
  // AND every customer on a project in that hub. We also draw a faint
  // collab↔customer edge when both are attached to the same project, which
  // surfaces interesting "customer X works with partner Y" groupings.
  const nodeCounter = new Map<string, { count: number; kind: string }>();
  const edgeCounter = new Map<string, { source: string; target: string; value: number; kind: string }>();

  function bumpNode(id: string, kind: string) {
    const cur = nodeCounter.get(id);
    if (cur) { cur.count++; } else { nodeCounter.set(id, { count: 1, kind }); }
  }
  function bumpEdge(source: string, target: string, kind: string) {
    const key = source < target ? `${source}|${target}|${kind}` : `${target}|${source}|${kind}`;
    const cur = edgeCounter.get(key);
    if (cur) { cur.value++; } else { edgeCounter.set(key, { source, target, value: 1, kind }); }
  }

  for (const p of filtered) {
    const hub_node = p.campaign_hub + " Hub";
    // Make sure hubs always appear even on projects with no collaborator/
    // customer so the ring still includes every hub in scope.
    const hubCur = nodeCounter.get(hub_node);
    if (hubCur) hubCur.count++; else nodeCounter.set(hub_node, { count: 1, kind: "hub" });

    const customer = p.end_customer || null;
    if (customer) bumpNode(customer, "customer");
    for (const c of p.collaborators) bumpNode(c, "collab");

    // Hub → collaborator / customer
    for (const c of p.collaborators) bumpEdge(hub_node, c, "hub-collab");
    if (customer) bumpEdge(hub_node, customer, "hub-customer");

    // Collaborator ↔ customer (same project)
    if (customer) {
      for (const c of p.collaborators) bumpEdge(customer, c, "customer-collab");
    }
  }

  const network = {
    nodes: Array.from(nodeCounter.entries()).map(([id, v]) => ({
      id, count: v.count, kind: v.kind,
    })),
    edges: Array.from(edgeCounter.values()),
  };

  // Team size
  const sizeMap = new Map<number, number>();
  for (const p of filtered) sizeMap.set(p.team_size, (sizeMap.get(p.team_size) || 0) + 1);
  const team_size_dist: LabelValue[] = Array.from(sizeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => ({ label: String(k), value: v }));

  // Hub × Collaborator heatmap
  const hubCollab = new Map<string, Map<string, number>>();
  const collabsAll = new Map<string, number>();
  for (const p of filtered) {
    for (const c of p.collaborators) {
      const m = hubCollab.get(p.campaign_hub) ?? new Map<string, number>();
      m.set(c, (m.get(c) || 0) + 1);
      hubCollab.set(p.campaign_hub, m);
      collabsAll.set(c, (collabsAll.get(c) || 0) + 1);
    }
  }
  const top_collabs = Array.from(collabsAll.entries()).sort((a, b) => b[1] - a[1])
    .slice(0, 12).map(([k]) => k);
  const heatmap_hub_collab = {
    rows: hubs, cols: top_collabs,
    matrix: hubs.map((h) => top_collabs.map((c) => hubCollab.get(h)?.get(c) || 0)),
  };

  // Recent activity
  const recent = [...filtered]
    .sort((a, b) => (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date))
    .slice(0, 8);

  // Global aggregates (unfiltered) for KPI denominators
  const global_total = all.length;

  // --- Outputs per campaign ------------------------------------------------
  // Stacked/grouped data: for each hub, total vulnerabilities discovered,
  // HS equities, and operational successes across filtered projects. Fuels
  // the "Outputs by Campaign" chart on Overview.
  const outHubs = Array.from(new Set(filtered.map((p) => p.campaign_hub)));
  const outputs_by_hub = outHubs.map((hub) => {
    const ps = filtered.filter((p) => p.campaign_hub === hub);
    return {
      hub,
      vulns:     ps.reduce((s, p) => s + (p.vulnerabilities_discovered || 0), 0),
      equities:  ps.reduce((s, p) => s + (p.hs_equities || 0), 0),
      successes: ps.filter((p) => p.operational_success).length,
    };
  }).sort((a, b) => (b.vulns + b.equities + b.successes) - (a.vulns + a.equities + a.successes));

  // --- Team size metrics ---------------------------------------------------
  const team_sizes = filtered.map((p) => p.team_size);
  const avg_team_size = team_sizes.length
    ? +(team_sizes.reduce((a, b) => a + b, 0) / team_sizes.length).toFixed(1)
    : 0;
  const max_team_size = team_sizes.length ? Math.max(...team_sizes) : 0;
  const median_team_size = team_sizes.length
    ? +[...team_sizes].sort((a, b) => a - b)[Math.floor(team_sizes.length / 2)]
    : 0;

  // Average team size per project type
  const teamByType = new Map<string, number[]>();
  for (const p of filtered) {
    if (!teamByType.has(p.project_type)) teamByType.set(p.project_type, []);
    teamByType.get(p.project_type)!.push(p.team_size);
  }
  const team_size_by_type: LabelValue[] = Array.from(teamByType.entries())
    .map(([label, arr]) => ({
      label,
      value: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    summary: {
      total, open, closed, avg_duration_days, total_person_months,
      vulnerabilities_discovered, hs_equities, operational_successes,
      projects_completed, global_total,
      avg_team_size, max_team_size, median_team_size, median_duration,
    },
    recent_projects: recent,
    type_breakdown, hub_breakdown, outcome_breakdown,
    over_time, stacked_type_tech, treemap_tech, heatmap_type_hub,
    stage_avg, stage_flow, histogram,
    tool_freq, os_dist, language_dist, arch_dist, tag_freq,
    tool_matrix, end_customers, network, team_size_dist, heatmap_hub_collab,
    team_size_by_type, outputs_by_hub,
    top_technology: top_technology_item,
    top_tool: top_tool_item,
    top_os: top_os_item,
    top_language: top_language_item,
    top_arch: top_arch_item,
    heatmap_tech_hub, heatmap_tech_arch, heatmap_lang_type,
  };
}

export type Aggregations = ReturnType<typeof computeAggregations>;
