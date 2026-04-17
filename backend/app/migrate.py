"""Idempotent column-level SQLite migration + settings migration.
Safe to run on every boot."""
import json
from sqlalchemy import inspect, text
from .database import engine, SessionLocal
from . import models

PROJECT_COLUMN_DDL = {
    # Earlier additions — keep for upgrades from older dashboards
    "target_vendor":             ("VARCHAR(128)", "''"),
    "target_product":            ("VARCHAR(128)", "''"),
    "cpu_arch":                  ("VARCHAR(32)",  "''"),
    "priority":                  ("VARCHAR(16)",  "'Medium'"),       # legacy, unused now
    "outcome":                   ("VARCHAR(32)",  "'In Progress'"),
    "project_lead":              ("VARCHAR(128)", "''"),
    "ticket_ref":                ("VARCHAR(64)",  "''"),
    "classification":            ("VARCHAR(32)",  "'OFFICIAL'"),      # legacy, unused now
    "repo_url":                  ("VARCHAR(256)", "''"),
    "wiki_url":                  ("VARCHAR(256)", "''"),
    "confluence_url":            ("VARCHAR(256)", "''"),
    "jira_url":                  ("VARCHAR(256)", "''"),
    "vulnerabilities_discovered":("INTEGER",      "0"),
    "hs_equities":               ("INTEGER",      "0"),
    "operational_success":       ("BOOLEAN",      "0"),
    "objectives":                ("TEXT",         "''"),
    "key_findings":              ("TEXT",         "''"),
    "next_steps":                ("TEXT",         "''"),
    "risks":                     ("TEXT",         "''"),
}


def _migrate_project_columns():
    insp = inspect(engine)
    if "projects" not in set(insp.get_table_names()):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    with engine.begin() as conn:
        for name, (ctype, default) in PROJECT_COLUMN_DDL.items():
            if name not in cols:
                conn.execute(text(
                    f"ALTER TABLE projects ADD COLUMN {name} {ctype} "
                    f"NOT NULL DEFAULT {default}"
                ))


def _migrate_settings():
    """LLM legacy migration + catalog defaults + classification defaults."""
    insp = inspect(engine)
    if "settings" not in set(insp.get_table_names()):
        return
    db = SessionLocal()
    try:
        current = {row.key: row.value for row in db.query(models.Setting).all()}
        writes: dict[str, str] = {}

        def want(k: str, v: str):
            if not v:
                return
            if current.get(k):
                return  # already set
            writes[k] = v

        # LLM legacy → new per-provider keys
        legacy_url = current.get("llm_base_url", "")
        legacy_key = current.get("llm_api_key", "")
        if legacy_url or legacy_key:
            want("llm_openai_base_url", legacy_url)
            want("llm_openai_api_key", legacy_key)
            want("llm_provider", "openai")

        want("llm_provider", "openai")
        want("llm_max_tokens", "16384")

        # Classification defaults
        want("classification_level", "OFFICIAL")
        want("classification_text", "OFFICIAL")

        # Terminology defaults — admin-renameable labels
        want("label_campaigns", "Campaigns")
        want("label_campaign", "Campaign")
        want("label_equities", "HS Equities")

        # Footer defaults — URLs are left blank until the admin fills them
        want("footer_heading", "About the Team")
        want("footer_tagline", "Internal Use")
        want("footer_link_1_label", "The Team Front Door")
        want("footer_link_1_description",
             "The team's homepage — daily announcements, meeting schedules, and rota.")
        want("footer_link_2_label", "Cyber Research Team Confluence")
        want("footer_link_2_description",
             "Deep technical documentation: project archives, tradecraft notes, and writeups.")
        want("footer_link_3_label", "O3 Confluence Page")
        want("footer_link_3_description",
             "Where the Cyber Research Team sits in O3 — org chart, remit, and key stakeholders.")
        want("team_email_subject", "Cyber Research Team enquiry")
        want("team_email_description",
             "For questions, requests, or anything else that isn't covered on the pages above.")

        # Admin-editable taxonomy catalogs — seed defaults on first boot
        for key, values in models.DEFAULT_CATALOGS.items():
            want(f"catalog_{key}", json.dumps(values))

        for k, v in writes.items():
            row = db.query(models.Setting).filter(models.Setting.key == k).first()
            if row:
                row.value = v
            else:
                db.add(models.Setting(key=k, value=v))
        db.commit()
    finally:
        db.close()


def run():
    _migrate_project_columns()
    _migrate_settings()
