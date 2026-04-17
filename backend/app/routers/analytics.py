from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict, Counter
from datetime import date

from ..database import get_db
from .. import models, crud

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    projects = db.query(models.Project).all()

    total = len(projects)
    open_count = sum(1 for p in projects if p.status == models.ProjectStatus.OPEN)
    closed_count = total - open_count

    durations = []
    for p in projects:
        if p.end_date and p.start_date:
            durations.append((p.end_date - p.start_date).days)
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    total_person_months = 0.0
    for p in projects:
        end = p.end_date or date.today()
        days = max(1, (end - p.start_date).days)
        total_person_months += (days / 30.0) * p.team_size
    total_person_months = round(total_person_months, 1)

    return {
        "total": total,
        "open": open_count,
        "closed": closed_count,
        "avg_duration_days": avg_duration,
        "total_person_months": total_person_months,
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    """One big endpoint returning everything the dashboard needs."""
    projects = db.query(models.Project).all()
    data = [crud.project_to_dict(p) for p in projects]

    # Type breakdown
    type_counts = Counter(p["project_type"] for p in data)
    hub_counts = Counter(p["campaign_hub"] for p in data)

    # Over time: opened vs closed by month (last 24 months of activity)
    opened_by_month = Counter()
    closed_by_month = Counter()
    for p in data:
        sd = p["start_date"]
        if sd:
            opened_by_month[f"{sd.year}-{sd.month:02d}"] += 1
        ed = p["end_date"]
        if ed:
            closed_by_month[f"{ed.year}-{ed.month:02d}"] += 1
    months = sorted(set(opened_by_month) | set(closed_by_month))
    over_time = [
        {"month": m, "opened": opened_by_month[m], "closed": closed_by_month[m]}
        for m in months
    ]

    # Type × Technology stacked
    tech_by_type = defaultdict(Counter)
    all_tech = Counter()
    for p in data:
        for t in p["technologies"]:
            tech_by_type[p["project_type"]][t] += 1
            all_tech[t] += 1
    stacked_type_tech = []
    top_tech = [t for t, _ in all_tech.most_common(10)]
    for ptype in type_counts:
        row = {"type": ptype}
        for t in top_tech:
            row[t] = tech_by_type[ptype][t]
        stacked_type_tech.append(row)

    # Technology treemap
    treemap_tech = [{"name": t, "value": v} for t, v in all_tech.most_common()]

    # Heatmap: project_type × campaign_hub
    type_hub = defaultdict(lambda: defaultdict(int))
    for p in data:
        type_hub[p["project_type"]][p["campaign_hub"]] += 1
    hubs = list(hub_counts.keys())
    types = list(type_counts.keys())
    heatmap_type_hub = {
        "rows": types,
        "cols": hubs,
        "matrix": [[type_hub[t][h] for h in hubs] for t in types],
    }

    # Stage analytics (closed only). Always emit all 6 stages, even those
    # with no data, so the chart axis stays stable across reseeds.
    from ..models import STAGE_NAMES as _STAGE_ORDER
    stage_totals = defaultdict(list)
    for p in data:
        if p["status"] == "closed":
            for s in p["stages"]:
                stage_totals[s["stage_name"]].append(s["days_spent"])
    stage_avg = []
    for name in _STAGE_ORDER:
        v = stage_totals.get(name, [])
        stage_avg.append({
            "stage": name,
            "avg_days": round(sum(v) / len(v), 1) if v else 0,
            "total_days": sum(v),
        })

    # Stage flow (sankey-ish) — sequential pairs in standard order
    from ..models import STAGE_NAMES
    flow = []
    stage_order = STAGE_NAMES
    for i in range(len(stage_order) - 1):
        a, b = stage_order[i], stage_order[i + 1]
        value = 0
        for p in data:
            stage_map = {s["stage_name"]: s["days_spent"] for s in p["stages"]}
            if stage_map.get(a, 0) > 0 and stage_map.get(b, 0) > 0:
                value += 1
        flow.append({"source": a, "target": b, "value": value})

    # Duration histogram
    bins = [0] * 9  # 0-50,50-100,...,400+
    for p in data:
        if p["end_date"] and p["start_date"]:
            d = (p["end_date"] - p["start_date"]).days
            idx = min(8, d // 50)
            bins[idx] += 1
    histogram = [
        {"label": f"{i*50}-{(i+1)*50}", "value": bins[i]} for i in range(8)
    ] + [{"label": "400+", "value": bins[8]}]

    # Tool frequency
    tool_counts = Counter()
    for p in data:
        for t in p["tools"]:
            tool_counts[t] += 1
    tool_freq = [{"label": t, "value": v} for t, v in tool_counts.most_common()]

    # OS pie
    os_counts = Counter()
    for p in data:
        for o in p["os_list"]:
            os_counts[o] += 1
    os_dist = [{"label": o, "value": v} for o, v in os_counts.most_common()]

    # Tools × Type matrix
    tools_by_type = defaultdict(Counter)
    all_tools = Counter()
    for p in data:
        for t in p["tools"]:
            tools_by_type[p["project_type"]][t] += 1
            all_tools[t] += 1
    top_tools = [t for t, _ in all_tools.most_common(12)]
    tool_matrix = {
        "rows": list(type_counts.keys()),
        "cols": top_tools,
        "matrix": [
            [tools_by_type[ptype][tool] for tool in top_tools]
            for ptype in type_counts
        ],
    }

    # End customers
    customer_counts = Counter(p["end_customer"] for p in data if p["end_customer"])
    end_customers = [{"label": c, "value": v} for c, v in customer_counts.most_common()]

    # Collaborator network
    collab_counter = Counter()
    edges_counter = Counter()
    for p in data:
        for c in p["collaborators"]:
            collab_counter[c] += 1
        collab_counter[p["campaign_hub"] + " Hub"] += 0  # ensure hub nodes exist
        hub_node = p["campaign_hub"] + " Hub"
        for c in p["collaborators"]:
            edges_counter[(hub_node, c)] += 1
    nodes = [{"id": n, "count": c, "kind": "hub" if n.endswith("Hub") else "collab"}
             for n, c in collab_counter.items() if c > 0 or n.endswith("Hub")]
    edges = [{"source": a, "target": b, "value": v} for (a, b), v in edges_counter.items()]
    network = {"nodes": nodes, "edges": edges}

    # Team size distribution
    team_sizes = Counter(p["team_size"] for p in data)
    team_size_dist = [
        {"label": str(k), "value": v} for k, v in sorted(team_sizes.items())
    ]

    # Hub × Collaborator heatmap
    hub_collab = defaultdict(lambda: defaultdict(int))
    all_collabs = Counter()
    for p in data:
        for c in p["collaborators"]:
            hub_collab[p["campaign_hub"]][c] += 1
            all_collabs[c] += 1
    top_collabs = [c for c, _ in all_collabs.most_common(12)]
    heatmap_hub_collab = {
        "rows": hubs,
        "cols": top_collabs,
        "matrix": [[hub_collab[h][c] for c in top_collabs] for h in hubs],
    }

    # Summary KPIs reused
    sm = summary(db)

    # Recent projects (sorted by whichever of start/end is most recent)
    def _recent_key(p):
        return p["end_date"] or p["start_date"]
    recent_projects = sorted(data, key=_recent_key, reverse=True)[:8]
    recent_projects = [
        {
            "id": p["id"], "name": p["name"], "status": p["status"],
            "project_type": p["project_type"], "campaign_hub": p["campaign_hub"],
            "start_date": p["start_date"], "end_date": p["end_date"],
            "team_size": p["team_size"], "end_customer": p["end_customer"],
        }
        for p in recent_projects
    ]

    return {
        "summary": sm,
        "recent_projects": recent_projects,
        "type_breakdown": [{"label": k, "value": v} for k, v in type_counts.items()],
        "hub_breakdown": [{"label": k, "value": v} for k, v in hub_counts.items()],
        "over_time": over_time,
        "stacked_type_tech": {"rows": stacked_type_tech, "keys": top_tech},
        "treemap_tech": treemap_tech,
        "heatmap_type_hub": heatmap_type_hub,
        "stage_avg": stage_avg,
        "stage_flow": flow,
        "histogram": histogram,
        "tool_freq": tool_freq,
        "os_dist": os_dist,
        "tool_matrix": tool_matrix,
        "end_customers": end_customers,
        "network": network,
        "team_size_dist": team_size_dist,
        "heatmap_hub_collab": heatmap_hub_collab,
    }
