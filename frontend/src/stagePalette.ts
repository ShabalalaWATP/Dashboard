// Canonical stage ordering and colour mapping — used by the lifecycle charts,
// the gantt timeline, and any other stage-aware visualisation. Keep this the
// single source of truth so colours stay consistent everywhere.
export const STAGE_ORDER = [
  "Sourcing",
  "Research",
  "Setup",
  "System Characterisation",
  "Vulnerability Research",
  "Exploit Development",
  "Documentation",
  "Other",
] as const;

export type StageName = (typeof STAGE_ORDER)[number];

export const STAGE_COLOURS: Record<string, string> = {
  "Sourcing":               "#22d3ee", // cyan
  "Research":               "#38bdf8", // sky blue
  "Setup":                  "#2dd4bf", // teal
  "System Characterisation":"#a78bfa", // violet
  "Vulnerability Research": "#e879f9", // magenta
  "Exploit Development":    "#fbbf24", // amber
  "Documentation":          "#34d399", // emerald
  "Other":                  "#94a3b8", // slate
};

// Short acronym label — helps the gantt tooltip stay compact
export const STAGE_SHORT: Record<string, string> = {
  "Sourcing":               "SRC",
  "Research":               "RES",
  "Setup":                  "SET",
  "System Characterisation":"SYS",
  "Vulnerability Research": "VR",
  "Exploit Development":    "ED",
  "Documentation":          "DOC",
  "Other":                  "OTH",
};

export function stageColour(name: string): string {
  return STAGE_COLOURS[name] || "#22d3ee";
}
