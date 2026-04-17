from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from .models import ProjectStatus


class StageIn(BaseModel):
    stage_name: str
    days_spent: int = 0


class StageOut(StageIn):
    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    project_type: str
    start_date: date
    team_size: int = 1
    end_customer: str = ""
    campaign_hub: str
    description: str = ""
    technologies: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    os_list: List[str] = Field(default_factory=list)
    collaborators: List[str] = Field(default_factory=list)

    target_vendor: str = ""
    target_product: str = ""
    cpu_arch: str = ""
    outcome: str = "In Progress"
    project_lead: str = ""
    ticket_ref: str = ""
    repo_url: str = ""
    wiki_url: str = ""
    confluence_url: str = ""
    jira_url: str = ""
    vulnerabilities_discovered: int = 0
    hs_equities: int = 0
    operational_success: bool = False
    languages: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    objectives: str = ""
    key_findings: str = ""
    next_steps: str = ""
    risks: str = ""


class ProjectCreate(ProjectBase):
    stages: List["StageIn"] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    project_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    team_size: Optional[int] = None
    end_customer: Optional[str] = None
    campaign_hub: Optional[str] = None
    description: Optional[str] = None
    technologies: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    os_list: Optional[List[str]] = None
    collaborators: Optional[List[str]] = None
    status: Optional[ProjectStatus] = None

    target_vendor: Optional[str] = None
    target_product: Optional[str] = None
    cpu_arch: Optional[str] = None
    outcome: Optional[str] = None
    project_lead: Optional[str] = None
    ticket_ref: Optional[str] = None
    repo_url: Optional[str] = None
    wiki_url: Optional[str] = None
    confluence_url: Optional[str] = None
    jira_url: Optional[str] = None
    vulnerabilities_discovered: Optional[int] = None
    hs_equities: Optional[int] = None
    operational_success: Optional[bool] = None
    languages: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    objectives: Optional[str] = None
    key_findings: Optional[str] = None
    next_steps: Optional[str] = None
    risks: Optional[str] = None
    # Allow updating the stage breakdown mid-project — previously only the
    # close form could set stages.
    stages: Optional[List["StageIn"]] = None


class ProjectClose(BaseModel):
    end_date: date
    stages: List[StageIn]
    description: Optional[str] = None
    team_size: Optional[int] = None
    end_customer: Optional[str] = None
    outcome: Optional[str] = None
    vulnerabilities_discovered: Optional[int] = None
    hs_equities: Optional[int] = None
    operational_success: Optional[bool] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    status: ProjectStatus
    project_type: str
    start_date: date
    end_date: Optional[date]
    team_size: int
    end_customer: str
    campaign_hub: str
    description: str
    technologies: List[str]
    tools: List[str]
    os_list: List[str]
    stages: List[StageOut]
    collaborators: List[str]

    target_vendor: str
    target_product: str
    cpu_arch: str
    outcome: str
    project_lead: str
    ticket_ref: str
    repo_url: str
    wiki_url: str
    confluence_url: str
    jira_url: str
    vulnerabilities_discovered: int
    hs_equities: int
    operational_success: bool
    languages: List[str]
    tags: List[str]
    objectives: str = ""
    key_findings: str = ""
    next_steps: str = ""
    risks: str = ""

    class Config:
        from_attributes = True


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class SettingIn(BaseModel):
    key: str
    value: str


class SettingOut(SettingIn):
    class Config:
        from_attributes = True


class ChatIn(BaseModel):
    # Generous ceilings — the UI can't realistically produce a 50k-char prompt
    # or a 50-turn history in normal use; these caps just prevent someone
    # posting a 10 MB message and ballooning the LLM context / our memory.
    message: str = Field(..., min_length=1, max_length=50_000)
    history: List[dict] = Field(default_factory=list, max_length=50)


class UserCreate(BaseModel):
    # 3..64 keeps usernames sensible for display without stopping email-style
    # names. Passwords have a 12-char floor — short enough that existing
    # ops-chosen passwords still fit, long enough to rule out "password".
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=12, max_length=256)
    role: str = "admin"


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    new_password: str = Field(..., min_length=12, max_length=256)


class CatalogUpdate(BaseModel):
    """Write-side payload for /api/catalogs. Each key → list of distinct strings."""
    catalogs: dict[str, List[str]]
