import { Card, KPI } from "../components/Card";
import { DonutChart } from "../components/charts/DonutChart";
import { BarChart } from "../components/charts/BarChart";
import { AreaTimeChart } from "../components/charts/AreaTimeChart";
import { OutputsByCampaign } from "../components/charts/OutputsByCampaign";
import { HubsProjectsNetwork } from "../components/charts/HubsProjectsNetwork";
import { TagCloud } from "../components/charts/TagCloud";
import { RecentProjects } from "../components/RecentProjects";
import { useData } from "../filters";
import { Bug, ShieldCheck, CheckCircle2, FolderCheck, Layers, Clock, Users, UsersRound } from "lucide-react";
import type { PublicSettings } from "../types";


export function Overview({ onOpenProject, settings }: {
  onOpenProject: (id: number) => void;
  settings: PublicSettings;
}) {
  const { agg, filtered, filters, toggleFilter } = useData();
  const s = agg.summary;
  const campaignsLabel = settings.label_campaigns || "Campaigns";
  const equitiesLabel = settings.label_equities || "HS Equities";

  return (
    <div className="flex flex-col gap-5">
      {/* Primary KPI strip — what the team produces */}
      <div>
        <div className="sect-head mb-2">Outputs</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Vulnerabilities Discovered"
               icon={<Bug size={12}/>} tone="magenta"
               value={s.vulnerabilities_discovered}
               sub="across filtered projects" />
          <KPI label={equitiesLabel}
               icon={<ShieldCheck size={12}/>} tone="amber"
               value={s.hs_equities}
               sub="retained / submitted" />
          <KPI label="Operational Successes"
               icon={<CheckCircle2 size={12}/>} tone="emerald"
               value={s.operational_successes}
               sub="recorded" />
          <KPI label="Projects Completed"
               icon={<FolderCheck size={12}/>} tone="accent"
               value={s.projects_completed}
               sub={`of ${s.total} visible`} />
        </div>
      </div>

      {/* Secondary KPI strip — capacity / mix */}
      <div>
        <div className="sect-head mb-2">Capacity</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KPI label="Total Projects" icon={<Layers size={12}/>} tone="slate" value={s.total} />
          <KPI label="Open" value={s.open} tone="emerald" sub="Active" />
          <KPI label="Closed" value={s.closed} tone="slate" sub="Completed" />
          <KPI label="Avg Duration" icon={<Clock size={12}/>} tone="sky"
               value={s.avg_duration_days} sub="days (closed)" />
          <KPI label="Avg Team Size" icon={<UsersRound size={12}/>} tone="accent"
               value={s.avg_team_size}
               sub={`median ${s.median_team_size} · max ${s.max_team_size}`} />
          <KPI label="Person-Months" icon={<Users size={12}/>} tone="slate"
               value={s.total_person_months} sub="cumulative effort" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Project Type Breakdown" subtitle="Click a slice to filter">
          <DonutChart data={agg.type_breakdown}
                      onSliceClick={(label) => toggleFilter("types", label)} />
        </Card>
        <Card title={`${campaignsLabel} Distribution`} subtitle="Click a bar to filter">
          <BarChart data={agg.hub_breakdown} colorful
                    onBarClick={(label) => toggleFilter("hubs", label)} />
        </Card>
      </div>

      <Card title={`Outputs by ${campaignsLabel.replace(/s$/, "")}`}
            subtitle={`Vulnerabilities, ${equitiesLabel.toLowerCase()}, and operational successes grouped per campaign`}>
        <OutputsByCampaign data={agg.outputs_by_hub} campaignsLabel={campaignsLabel}
                           equitiesLabel={equitiesLabel} />
      </Card>

      <Card title={`${campaignsLabel} Network`}
            subtitle="Every project linked to its campaign. Scroll to zoom, drag to pan, click a project to open it. Hover a hub to highlight its projects.">
        <HubsProjectsNetwork projects={filtered} onOpenProject={onOpenProject} />
      </Card>

      <Card title="Tag Constellation"
            subtitle="Size = tag frequency · click a bubble to add it to the filter · the bigger & brighter, the more projects share that tag">
        <TagCloud data={agg.tag_freq}
                  selected={filters.tags}
                  onToggle={(t) => toggleFilter("tags", t)} />
      </Card>

      <Card title="Workload Over Time"
            subtitle="Solid line = projects running that month · bars = projects that closed that month">
        <AreaTimeChart data={agg.over_time} />
      </Card>

      <Card title="Latest Activity" subtitle="Most recently opened or closed — click to open">
        <RecentProjects items={agg.recent_projects} onOpen={onOpenProject} />
      </Card>
    </div>
  );
}
