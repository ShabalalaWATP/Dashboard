import { Card } from "../components/Card";
import { BarChart } from "../components/charts/BarChart";
import { DonutChart } from "../components/charts/DonutChart";
import { Heatmap } from "../components/charts/Heatmap";
import { useData } from "../filters";

export function ToolsPlatforms() {
  const { agg, toggleFilter } = useData();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="Tool Usage Frequency"
            subtitle="Click a bar to filter by tool"
            className="lg:col-span-2">
        <BarChart data={agg.tool_freq} horizontal
                  height={Math.max(260, agg.tool_freq.length * 26)}
                  onBarClick={(label) => toggleFilter("tools", label)} />
      </Card>
      <Card title="Operating System Distribution">
        <DonutChart data={agg.os_dist} />
      </Card>
      <Card title="Programming Languages">
        <DonutChart data={agg.language_dist} />
      </Card>
      <Card title="CPU Architectures" subtitle="Across filtered projects">
        <BarChart data={agg.arch_dist} color="#a78bfa" />
      </Card>
      <Card title="Top Tags" subtitle="Discipline / tradecraft markers">
        <BarChart data={agg.tag_freq.slice(0, 12)} color="#fbbf24"
                  onBarClick={(label) => toggleFilter("tags", label)} />
      </Card>
      <Card title="Tools × Project Type" className="lg:col-span-2"
            subtitle="Where each tool actually gets used">
        <Heatmap rows={agg.tool_matrix.rows}
                 cols={agg.tool_matrix.cols}
                 matrix={agg.tool_matrix.matrix}
                 color="232,121,249"
                 onCellClick={(t, tool) => {
                   toggleFilter("types", t);
                   toggleFilter("tools", tool);
                 }} />
      </Card>
    </div>
  );
}
