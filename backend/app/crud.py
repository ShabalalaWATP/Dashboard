from sqlalchemy.orm import Session
from . import models, schemas


_SCALAR_FIELDS = (
    "target_vendor", "target_product", "cpu_arch", "outcome",
    "project_lead", "ticket_ref",
    "repo_url", "wiki_url", "confluence_url", "jira_url",
    "vulnerabilities_discovered", "hs_equities", "operational_success",
    "objectives", "key_findings", "next_steps", "risks",
)


def project_to_dict(p: models.Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "status": p.status.value if hasattr(p.status, "value") else p.status,
        "project_type": p.project_type.value if hasattr(p.project_type, "value") else p.project_type,
        "start_date": p.start_date,
        "end_date": p.end_date,
        "team_size": p.team_size,
        "end_customer": p.end_customer,
        "campaign_hub": p.campaign_hub if isinstance(p.campaign_hub, str) else str(p.campaign_hub),
        "description": p.description,
        "technologies": [t.name for t in p.technologies],
        "tools": [t.name for t in p.tools],
        "os_list": [o.name for o in p.os_list],
        "stages": [{"stage_name": s.stage_name, "days_spent": s.days_spent} for s in p.stages],
        "collaborators": [c.org_name for c in p.collaborators],
        "languages": [l.name for l in p.languages],
        "tags": [t.name for t in p.tags],
        "target_vendor": p.target_vendor or "",
        "target_product": p.target_product or "",
        "cpu_arch": p.cpu_arch or "",
        "outcome": p.outcome or "In Progress",
        "project_lead": p.project_lead or "",
        "ticket_ref": p.ticket_ref or "",
        "repo_url": p.repo_url or "",
        "wiki_url": p.wiki_url or "",
        "confluence_url": p.confluence_url or "",
        "jira_url": p.jira_url or "",
        "vulnerabilities_discovered": p.vulnerabilities_discovered or 0,
        "hs_equities": p.hs_equities or 0,
        "operational_success": bool(p.operational_success),
        "objectives": p.objectives or "",
        "key_findings": p.key_findings or "",
        "next_steps": p.next_steps or "",
        "risks": p.risks or "",
    }


def _replace_children(db: Session, project: models.Project,
                      technologies=None, tools=None, os_list=None,
                      collaborators=None, languages=None, tags=None):
    if technologies is not None:
        project.technologies.clear()
        for t in technologies:
            if t:
                project.technologies.append(models.ProjectTechnology(name=t))
    if tools is not None:
        project.tools.clear()
        for t in tools:
            if t:
                project.tools.append(models.ProjectTool(name=t))
    if os_list is not None:
        project.os_list.clear()
        for o in os_list:
            if o:
                project.os_list.append(models.ProjectOS(name=o))
    if collaborators is not None:
        project.collaborators.clear()
        for c in collaborators:
            if c:
                project.collaborators.append(models.ProjectCollaborator(org_name=c))
    if languages is not None:
        project.languages.clear()
        for l in languages:
            if l:
                project.languages.append(models.ProjectLanguage(name=l))
    if tags is not None:
        project.tags.clear()
        for t in tags:
            if t:
                project.tags.append(models.ProjectTag(name=t))


def create_project(db: Session, data: schemas.ProjectCreate) -> models.Project:
    kwargs = dict(
        name=data.name,
        project_type=data.project_type,
        start_date=data.start_date,
        end_date=None,
        team_size=data.team_size,
        end_customer=data.end_customer,
        campaign_hub=data.campaign_hub,
        description=data.description,
        status=models.ProjectStatus.OPEN,
    )
    for f in _SCALAR_FIELDS:
        kwargs[f] = getattr(data, f, None)
    p = models.Project(**{k: v for k, v in kwargs.items() if v is not None})
    db.add(p)
    db.flush()
    _replace_children(db, p,
                      technologies=data.technologies,
                      tools=data.tools,
                      os_list=data.os_list,
                      collaborators=data.collaborators,
                      languages=data.languages,
                      tags=data.tags)
    for s in getattr(data, "stages", []) or []:
        if s.stage_name and (s.days_spent or 0) > 0:
            p.stages.append(models.ProjectStage(
                stage_name=s.stage_name, days_spent=s.days_spent))
    db.commit()
    db.refresh(p)
    return p


def update_project(db: Session, project: models.Project, data: schemas.ProjectUpdate) -> models.Project:
    simple_fields = (
        "name", "project_type", "start_date", "end_date", "team_size",
        "end_customer", "campaign_hub", "description", "status",
    ) + _SCALAR_FIELDS
    for field in simple_fields:
        v = getattr(data, field)
        if v is not None:
            setattr(project, field, v)
    _replace_children(db, project,
                      technologies=data.technologies,
                      tools=data.tools,
                      os_list=data.os_list,
                      collaborators=data.collaborators,
                      languages=data.languages,
                      tags=data.tags)
    # Stages can be edited mid-project now, not just at close time.
    if data.stages is not None:
        project.stages.clear()
        for s in data.stages:
            if (s.days_spent or 0) >= 0 and s.stage_name:
                project.stages.append(models.ProjectStage(
                    stage_name=s.stage_name,
                    days_spent=s.days_spent,
                ))
    db.commit()
    db.refresh(project)
    return project


def close_project(db: Session, project: models.Project, data: schemas.ProjectClose) -> models.Project:
    project.end_date = data.end_date
    project.status = models.ProjectStatus.CLOSED
    if data.description is not None:
        project.description = data.description
    if data.team_size is not None:
        project.team_size = data.team_size
    if data.end_customer is not None:
        project.end_customer = data.end_customer
    if data.outcome is not None:
        project.outcome = data.outcome
    if data.vulnerabilities_discovered is not None:
        project.vulnerabilities_discovered = data.vulnerabilities_discovered
    if data.hs_equities is not None:
        project.hs_equities = data.hs_equities
    if data.operational_success is not None:
        project.operational_success = data.operational_success
    project.stages.clear()
    for s in data.stages:
        project.stages.append(models.ProjectStage(stage_name=s.stage_name, days_spent=s.days_spent))
    db.commit()
    db.refresh(project)
    return project


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(models.Setting).filter(models.Setting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(models.Setting).filter(models.Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(models.Setting(key=key, value=value))
    db.commit()
