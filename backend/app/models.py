from sqlalchemy import (
    Column, Integer, String, Text, Date, ForeignKey, Boolean,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
import enum
from .database import Base


# Kept for convenience in the seed (bias maps keyed by these values).
# The DB column is a free-form String now; admins can add custom types via the
# Admin → Catalogs UI.
class ProjectType(str, enum.Enum):
    VULN_RESEARCH = "Vulnerability Research"
    REVERSE_ENG = "Reverse Engineering"
    RESEARCH = "Research"
    SOFTWARE_ENG = "Software Engineering"


class ProjectStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class Outcome(str, enum.Enum):
    IN_PROGRESS = "In Progress"
    SUCCESS = "Success"
    PARTIAL = "Partial"
    BLOCKED = "Blocked"
    ABANDONED = "Abandoned"


# Default catalogs populated into the `settings` table on first boot. Admins
# edit these via the Admin → Catalogs UI; the project form uses them as
# autocomplete suggestions (write-ins are still allowed).
DEFAULT_CATALOGS: dict[str, list[str]] = {
    # Project classification. Admin-editable so teams can add their own
    # categories (e.g. "Malware Analysis", "Red Team Ops").
    "project_types": [
        "Vulnerability Research",
        "Reverse Engineering",
        "Research",
        "Software Engineering",
    ],
    # Possible outcomes when a project closes. Editable for teams with their
    # own workflow language (e.g. "Cancelled", "Deferred").
    "outcomes": [
        "In Progress", "Success", "Partial", "Blocked", "Abandoned",
    ],
    # Concrete targets the team actively works against — specific products,
    # versions, or variants. Used for the `target_product` autocomplete.
    "target_technologies": [
        "Apple iOS 17", "Google Android 14", "Samsung One UI 6",
        "Cisco IOS XE 17.9", "Juniper Junos 22", "Fortinet FortiGate 60F",
        "Chrome V8", "Firefox SpiderMonkey", "Apple WebKit",
        "Telegram Desktop 4.x", "Signal iOS", "WhatsApp Android",
        "Windows NDIS", "Linux Netfilter", "macOS XNU",
        "Qualcomm ABOOT", "Samsung S-Boot",
        "Siemens S7-1500", "Schneider Modicon M580",
        "AWS IAM", "Azure AD B2C", "GCP Cloud Run",
    ],
    "hubs": ["Russia", "China", "Iran", "CT", "SOC"],
    "technologies": [
        "Malware", "Messaging App", "Cryptocurrency", "Mobile OS", "Firmware",
        "Network Protocol", "Bootloader", "Kernel Driver", "VPN Appliance",
        "IoT Device", "Satellite Comms", "Browser", "Industrial Control",
        "Cloud Service", "Embedded Router",
    ],
    "tools": [
        "Ghidra", "VS Code", "Android Studio", "OpenWebUI", "OpenCode",
        "IDA Pro", "Binary Ninja", "Frida", "radare2", "x64dbg", "Wireshark",
        "Burp Suite",
    ],
    "os": [
        "Windows", "Linux", "macOS", "Android", "iOS",
        "Embedded Linux", "RTOS",
    ],
    "languages": [
        "C", "C++", "Rust", "Python", "Go", "Assembly", "TypeScript",
        "JavaScript", "Java", "Kotlin", "Swift", "Bash",
    ],
    "architectures": [
        "x86", "x64", "ARM", "ARM64", "MIPS", "RISC-V", "PowerPC", "Other",
    ],
    "collaborators": [
        "DSTL", "NCSC", "Home Office partner", "Academic - Oxford",
        "Academic - Cambridge", "Industry - VendorA", "Industry - VendorB",
        "Allied Partner", "Internal Red Team", "MIT Lincoln Lab (liaison)",
    ],
    "customers": [
        "Home Office", "NCSC", "DSTL", "MOD", "Foreign Office",
        "Allied SIGINT", "Internal", "Cabinet Office",
    ],
}


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False, unique=True)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.OPEN, nullable=False)
    # Free-form string, not an enum — admin-editable via the project_types catalog
    project_type = Column(String(64), nullable=False)
    # Campaign hub is admin-editable now, so plain string instead of enum.
    campaign_hub = Column(String(64), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    team_size = Column(Integer, default=1, nullable=False)
    end_customer = Column(String(128), default="", nullable=False)
    description = Column(Text, default="", nullable=False)

    # Extended metadata
    target_vendor = Column(String(128), default="", nullable=False)
    target_product = Column(String(128), default="", nullable=False)
    cpu_arch = Column(String(32), default="", nullable=False)
    outcome = Column(String(32), default="In Progress", nullable=False)
    project_lead = Column(String(128), default="", nullable=False)
    ticket_ref = Column(String(64), default="", nullable=False)

    # External links — separate fields per system so the UI can render each
    # with its own icon and treat them as first-class references.
    repo_url = Column(String(256), default="", nullable=False)
    wiki_url = Column(String(256), default="", nullable=False)
    confluence_url = Column(String(256), default="", nullable=False)
    jira_url = Column(String(256), default="", nullable=False)

    # Structured narrative fields. All optional and rendered as discrete
    # sections in the project detail view when populated.
    objectives = Column(Text, default="", nullable=False)   # short — what the project aims to do
    key_findings = Column(Text, default="", nullable=False) # markdown — what was found
    next_steps = Column(Text, default="", nullable=False)   # markdown — what comes next
    risks = Column(Text, default="", nullable=False)        # markdown — limitations, caveats, notes

    vulnerabilities_discovered = Column(Integer, default=0, nullable=False)
    hs_equities = Column(Integer, default=0, nullable=False)
    operational_success = Column(Boolean, default=False, nullable=False)

    technologies = relationship("ProjectTechnology", cascade="all, delete-orphan", backref="project")
    tools = relationship("ProjectTool", cascade="all, delete-orphan", backref="project")
    os_list = relationship("ProjectOS", cascade="all, delete-orphan", backref="project")
    stages = relationship("ProjectStage", cascade="all, delete-orphan", backref="project")
    collaborators = relationship("ProjectCollaborator", cascade="all, delete-orphan", backref="project")
    languages = relationship("ProjectLanguage", cascade="all, delete-orphan", backref="project")
    tags = relationship("ProjectTag", cascade="all, delete-orphan", backref="project")


class ProjectTechnology(Base):
    __tablename__ = "project_technologies"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(64), nullable=False)


class ProjectTool(Base):
    __tablename__ = "project_tools"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(64), nullable=False)


class ProjectOS(Base):
    __tablename__ = "project_os"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(64), nullable=False)


class ProjectStage(Base):
    __tablename__ = "project_stages"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    stage_name = Column(String(64), nullable=False)
    days_spent = Column(Integer, default=0, nullable=False)


class ProjectCollaborator(Base):
    __tablename__ = "project_collaborators"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    org_name = Column(String(128), nullable=False)


class ProjectLanguage(Base):
    __tablename__ = "project_languages"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(32), nullable=False)


class ProjectTag(Base):
    __tablename__ = "project_tags"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(64), nullable=False)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(64), primary_key=True)
    value = Column(Text, default="", nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="admin", nullable=False)


STAGE_NAMES = [
    "Sourcing",
    "Research",
    "Setup",
    "System Characterisation",
    "Vulnerability Research",
    "Exploit Development",
    "Documentation",
    "Other",
]
