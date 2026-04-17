import { Card } from "../components/Card";
import { BarChart } from "../components/charts/BarChart";
import { Network } from "../components/charts/Network";
import { Heatmap } from "../components/charts/Heatmap";
import { useData } from "../filters";
import type { PublicSettings } from "../types";


export function Collaboration({ settings }: { settings: PublicSettings }) {
  const { agg, toggleFilter } = useData();
  const campaignsLabel = settings.label_campaigns || "Campaigns";
  const campaignLabel = settings.label_campaign || "Campaign";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="End Customer Breakdown" subtitle="Click a bar to filter">
        <BarChart data={agg.end_customers} horizontal colorful
                  onBarClick={(label) => toggleFilter("customers", label)} />
      </Card>
      <Card title="Team Size Distribution"
            subtitle="How many projects run with a team of each size">
        <BarChart data={agg.team_size_dist} color="#a78bfa" />
      </Card>
      <Card title="Avg Team Size by Project Type"
            subtitle="Average people working on projects of each type"
            className="lg:col-span-2">
        <BarChart data={agg.team_size_by_type} horizontal colorful />
      </Card>
      <Card title="Collaborator Network"
            subtitle={`${campaignsLabel} (inner) ↔ collaborators (outer). Hover a node to highlight its links.`}
            className="lg:col-span-2">
        <Network nodes={agg.network.nodes} edges={agg.network.edges} />
      </Card>
      <Card title={`${campaignLabel} × Collaborator`} className="lg:col-span-2"
            subtitle="Partnership density">
        <Heatmap rows={agg.heatmap_hub_collab.rows}
                 cols={agg.heatmap_hub_collab.cols}
                 matrix={agg.heatmap_hub_collab.matrix}
                 onCellClick={(h) => toggleFilter("hubs", h)} />
      </Card>
    </div>
  );
}
