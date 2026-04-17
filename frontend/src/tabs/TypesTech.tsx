import { Card, KPI } from "../components/Card";
import { StackedBar } from "../components/charts/StackedBar";
import { TreemapChart } from "../components/charts/TreemapChart";
import { Heatmap } from "../components/charts/Heatmap";
import { BarChart } from "../components/charts/BarChart";
import { DonutChart } from "../components/charts/DonutChart";
import { useData } from "../filters";
import { Layers, Wrench, MonitorSmartphone, Code2, Cpu } from "lucide-react";
import type { PublicSettings } from "../types";


export function TypesTech({ settings }: { settings?: PublicSettings }) {
  const { agg, toggleFilter } = useData();
  const campaignLabel = settings?.label_campaign || "Campaign";

  return (
    <div className="flex flex-col gap-5">
      {/* Top stats strip */}
      <div>
        <div className="sect-head mb-2">At a glance</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Most Used Technology"
               icon={<Layers size={12}/>} tone="accent"
               value={agg.top_technology?.label || "—"}
               sub={agg.top_technology ? `${agg.top_technology.value} project${agg.top_technology.value === 1 ? "" : "s"}` : undefined} />
          <KPI label="Most Used Tool"
               icon={<Wrench size={12}/>} tone="magenta"
               value={agg.top_tool?.label || "—"}
               sub={agg.top_tool ? `${agg.top_tool.value} project${agg.top_tool.value === 1 ? "" : "s"}` : undefined} />
          <KPI label="Most Used OS"
               icon={<MonitorSmartphone size={12}/>} tone="emerald"
               value={agg.top_os?.label || "—"}
               sub={agg.top_os ? `${agg.top_os.value} project${agg.top_os.value === 1 ? "" : "s"}` : undefined} />
          <KPI label="Most Used Language"
               icon={<Code2 size={12}/>} tone="amber"
               value={agg.top_language?.label || "—"}
               sub={agg.top_language ? `${agg.top_language.value} project${agg.top_language.value === 1 ? "" : "s"}` : undefined} />
          <KPI label="Most Used Architecture"
               icon={<Cpu size={12}/>} tone="sky"
               value={agg.top_arch?.label || "—"}
               sub={agg.top_arch ? `${agg.top_arch.value} project${agg.top_arch.value === 1 ? "" : "s"}` : undefined} />
        </div>
      </div>

      {/* Distribution — the basic breakdowns */}
      <div>
        <div className="sect-head mb-2">Distribution</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Project Type × Technology"
                subtitle="Top technologies stacked by project type"
                className="lg:col-span-2">
            <StackedBar rows={agg.stacked_type_tech.rows} keys={agg.stacked_type_tech.keys} />
          </Card>
          <Card title="Tool Usage Frequency"
                subtitle="Every tool, by number of projects — click to filter"
                className="lg:col-span-2">
            <BarChart data={agg.tool_freq} horizontal
                      height={Math.max(260, agg.tool_freq.length * 26)}
                      onBarClick={(label) => toggleFilter("tools", label)} />
          </Card>
          <Card title="Operating Systems">
            <DonutChart data={agg.os_dist} />
          </Card>
          <Card title="Programming Languages">
            <DonutChart data={agg.language_dist} />
          </Card>
          <Card title="CPU Architectures" className="lg:col-span-2">
            <BarChart data={agg.arch_dist} color="#a78bfa" />
          </Card>
        </div>
      </div>

      {/* Catalogue view — every tech + every tag */}
      <div>
        <div className="sect-head mb-2">Catalogue</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Technology Treemap" className="lg:col-span-2"
                subtitle="Every technology, sized by project count">
            <TreemapChart data={agg.treemap_tech} />
          </Card>
          <Card title="Top Tags"
                subtitle="Discipline / tradecraft markers">
            <BarChart data={agg.tag_freq.slice(0, 12)} color="#fbbf24"
                      onBarClick={(label) => toggleFilter("tags", label)} />
          </Card>
        </div>
      </div>

      {/* Cross-cuts — the real "insight" heatmaps */}
      <div>
        <div className="sect-head mb-2">Cross-cuts</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title={`Project Type × ${campaignLabel}`}
                subtitle="Where each kind of project happens">
            <Heatmap rows={agg.heatmap_type_hub.rows}
                     cols={agg.heatmap_type_hub.cols}
                     matrix={agg.heatmap_type_hub.matrix}
                     onCellClick={(t, h) => {
                       toggleFilter("types", t);
                       toggleFilter("hubs", h);
                     }} />
          </Card>
          <Card title="Tools × Project Type"
                subtitle="Which tools actually get used for which work">
            <Heatmap rows={agg.tool_matrix.rows}
                     cols={agg.tool_matrix.cols}
                     matrix={agg.tool_matrix.matrix}
                     color="232,121,249"
                     onCellClick={(t, tool) => {
                       toggleFilter("types", t);
                       toggleFilter("tools", tool);
                     }} />
          </Card>
          <Card title={`Technology × ${campaignLabel}`}
                subtitle="Top-10 tech footprint across campaigns"
                className="lg:col-span-2">
            <Heatmap rows={agg.heatmap_tech_hub.rows}
                     cols={agg.heatmap_tech_hub.cols}
                     matrix={agg.heatmap_tech_hub.matrix}
                     color="56,189,248"
                     onCellClick={(t, h) => {
                       toggleFilter("technologies", t);
                       toggleFilter("hubs", h);
                     }} />
          </Card>
          <Card title="Technology × CPU Architecture"
                subtitle="Which architectures a given technology actually runs on">
            <Heatmap rows={agg.heatmap_tech_arch.rows}
                     cols={agg.heatmap_tech_arch.cols}
                     matrix={agg.heatmap_tech_arch.matrix}
                     color="167,139,250"
                     onCellClick={(t, a) => {
                       toggleFilter("technologies", t);
                       toggleFilter("architectures", a);
                     }} />
          </Card>
          <Card title="Language × Project Type"
                subtitle="Which languages pair with which kind of work">
            <Heatmap rows={agg.heatmap_lang_type.rows}
                     cols={agg.heatmap_lang_type.cols}
                     matrix={agg.heatmap_lang_type.matrix}
                     color="251,191,36"
                     onCellClick={(l, t) => {
                       toggleFilter("languages", l);
                       toggleFilter("types", t);
                     }} />
        </Card>
        </div>
      </div>
    </div>
  );
}
