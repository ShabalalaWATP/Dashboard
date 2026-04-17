import { Card } from "../components/Card";
import { BarChart } from "../components/charts/BarChart";
import { StageFlow } from "../components/charts/StageFlow";
import { GanttChart } from "../components/charts/GanttChart";
import { DurationHistogram } from "../components/charts/DurationHistogram";
import { useData } from "../filters";
import { STAGE_ORDER, STAGE_SHORT, STAGE_COLOURS } from "../stagePalette";


export function Lifecycle({ onOpenProject }: { onOpenProject: (id: number) => void }) {
  const { agg, filtered } = useData();

  // Short acronyms for the x-axis so every one of the 8 stages is visible.
  // The acronym key is rendered underneath the charts for reference.
  const shortLabel = (s: string) => STAGE_SHORT[s] || s;
  const avgData  = agg.stage_avg.map((s) => ({ label: shortLabel(s.stage), value: s.avg_days }));
  const totalData = agg.stage_avg.map((s) => ({ label: shortLabel(s.stage), value: s.total_days }));
  // Per-bar colours — match the canonical stage palette used by the gantt
  const stageBarColors = agg.stage_avg.map((s) => STAGE_COLOURS[s.stage] || "#22d3ee");

  return (
    <div className="flex flex-col gap-5">
      <Card title="Stage Flow"
            subtitle="How closed projects move through consecutive stage pairs">
        <StageFlow stages={[...STAGE_ORDER]} flow={agg.stage_flow} />
      </Card>

      <Card title="Project Timeline"
            subtitle="One row per project across the calendar. Drag the scrollbars to pan; project names stay pinned on the left. Click a bar to open the project.">
        <GanttChart projects={filtered} onOpen={onOpenProject} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Average Days per Stage"
              subtitle="Mean time each stage took across closed projects">
          <BarChart data={avgData} colors={stageBarColors} />
        </Card>
        <Card title="Total Days Invested per Stage"
              subtitle="Cumulative effort across all closed projects">
          <BarChart data={totalData} colors={stageBarColors} />
        </Card>
      </div>

      {/* Key for the acronyms used on the two stage bar charts */}
      <div className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 px-1">
        <span className="text-slate-600 tracking-widest uppercase mr-1">key:</span>
        {STAGE_ORDER.map((s) => (
          <span key={s as string}>
            <span className="text-accent/80">{STAGE_SHORT[s as string]}</span>
            <span className="text-slate-500"> = {s}</span>
          </span>
        ))}
      </div>

      <Card title="How Long Projects Take"
            subtitle="Duration of each closed project, grouped into week-sized buckets (up to 9 months+)">
        <DurationHistogram data={agg.histogram} median={agg.summary.median_duration} />
      </Card>
    </div>
  );
}
