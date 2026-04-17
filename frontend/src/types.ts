export type Stage = { stage_name: string; days_spent: number };

export type Project = {
  id: number;
  name: string;
  status: "open" | "closed";
  project_type: string;
  start_date: string;
  end_date: string | null;
  team_size: number;
  end_customer: string;
  campaign_hub: string;
  description: string;
  technologies: string[];
  tools: string[];
  os_list: string[];
  stages: Stage[];
  collaborators: string[];
  languages: string[];
  tags: string[];
  target_vendor: string;
  target_product: string;
  cpu_arch: string;
  outcome: string;
  project_lead: string;
  ticket_ref: string;
  repo_url: string;
  wiki_url: string;
  confluence_url: string;
  jira_url: string;
  vulnerabilities_discovered: number;
  hs_equities: number;
  operational_success: boolean;
  objectives: string;
  key_findings: string;
  next_steps: string;
  risks: string;
};

export type LabelValue = { label: string; value: number };

export type PublicSettings = {
  classification_level: string;
  classification_text: string;
  about_team: string;
  app_title: string;
  team_name: string;
  label_campaigns: string;
  label_campaign: string;
  label_equities: string;
  footer_heading: string;
  footer_tagline: string;
  footer_link_1_label: string;
  footer_link_1_url: string;
  footer_link_1_description: string;
  footer_link_2_label: string;
  footer_link_2_url: string;
  footer_link_2_description: string;
  footer_link_3_label: string;
  footer_link_3_url: string;
  footer_link_3_description: string;
  team_email: string;
  team_email_subject: string;
  team_email_description: string;
};

export type User = { id: number; username: string; role: string };

export type Catalogs = {
  project_types: string[];
  target_technologies: string[];
  hubs: string[];
  technologies: string[];
  tools: string[];
  os: string[];
  languages: string[];
  architectures: string[];
  collaborators: string[];
  customers: string[];
  outcomes: string[];
};

export const CATALOG_NAMES: (keyof Catalogs)[] = [
  "project_types",
  "target_technologies",
  "hubs", "technologies", "tools", "os", "languages",
  "architectures", "collaborators", "customers",
  "outcomes",
];

export const EMPTY_CATALOGS: Catalogs = {
  project_types: [],
  target_technologies: [],
  hubs: [], technologies: [], tools: [], os: [], languages: [],
  architectures: [], collaborators: [], customers: [],
  outcomes: [],
};


export type FilterState = {
  search: string;
  status: "all" | "open" | "closed";
  hubs: string[];
  types: string[];
  outcomes: string[];
  technologies: string[];
  tools: string[];
  collaborators: string[];
  languages: string[];
  architectures: string[];
  customers: string[];
  tags: string[];
  date_from: string | null;
  date_to: string | null;
};

export const EMPTY_FILTER: FilterState = {
  search: "",
  status: "all",
  hubs: [],
  types: [],
  outcomes: [],
  technologies: [],
  tools: [],
  collaborators: [],
  languages: [],
  architectures: [],
  customers: [],
  tags: [],
  date_from: null,
  date_to: null,
};
