#!/usr/bin/env python3
"""Seed the database with realistic demo projects. Re-runnable.

Wipes all project data and replaces it. Leaves users & settings untouched.
Uses a fixed PRNG seed so demo output is reproducible.
"""
import sys
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.database import SessionLocal, engine, Base  # noqa: E402
from app import models, migrate  # noqa: E402
from app.models import (  # noqa: E402
    Project, ProjectTechnology, ProjectTool, ProjectOS,
    ProjectStage, ProjectCollaborator, ProjectLanguage, ProjectTag,
    ProjectType, ProjectStatus, STAGE_NAMES, DEFAULT_CATALOGS,
)

random.seed(1337)

CODENAMES = [
    "CRIMSON TIDE", "OBSIDIAN LEDGER", "NIGHT HERON", "SILENT ANVIL",
    "PALE SERPENT", "IRON MERIDIAN", "GLASS CIPHER", "BLACK LANTERN",
    "AMBER FROST", "EMBER PRISM", "JADE COMPASS", "COPPER SIGIL",
    "SABLE ECHO", "IVORY CASCADE", "VIOLET BASTION", "SCARLET VECTOR",
    "TITANIUM SPEAR", "QUARTZ CURTAIN", "OPAL MERIDIAN", "GRANITE COIL",
    "COBALT DRIFT", "MERCURY LATCH", "ONYX PRISM", "PLATINUM GALE",
    "BRONZE HALO", "SILVER SHROUD", "NEBULA FORGE", "VANTAGE QUILL",
    "TWILIGHT WARD", "STORMCROW", "FALLEN PENNANT", "BRASS DIAL",
    "ANCHORED DUSK", "HOLLOW RANGE", "MOSS KEEPER", "WILLOW STRIKE",
    "ASHEN MARCH", "LINEN MOON", "FLINT OATH", "CINDER HELM",
    "PALE BEACON", "LATENT WAVE", "DUSKED SPIRE", "WINTER VANE",
    "FIRE OPAL",
]
assert len(CODENAMES) >= 45


HUBS = DEFAULT_CATALOGS["hubs"]


TYPE_TECH = {
    ProjectType.VULN_RESEARCH: [
        "Browser", "Kernel Driver", "VPN Appliance", "IoT Device",
        "Messaging App", "Cloud Service", "Mobile OS", "Firmware",
    ],
    ProjectType.REVERSE_ENG: [
        "Malware", "Firmware", "Bootloader", "Embedded Router",
        "Satellite Comms", "Industrial Control", "Kernel Driver",
    ],
    ProjectType.RESEARCH: [
        "Cryptocurrency", "Network Protocol", "Browser",
        "Messaging App", "Satellite Comms", "Cloud Service",
    ],
    ProjectType.SOFTWARE_ENG: [
        "Cloud Service", "Network Protocol", "Messaging App", "Browser",
    ],
}

TYPE_TOOLS = {
    ProjectType.VULN_RESEARCH: [
        "IDA Pro", "Ghidra", "Binary Ninja", "Frida", "Burp Suite",
        "x64dbg", "VS Code", "Wireshark",
    ],
    ProjectType.REVERSE_ENG: [
        "IDA Pro", "Ghidra", "Binary Ninja", "radare2", "x64dbg",
        "Wireshark", "Frida",
    ],
    ProjectType.RESEARCH: [
        "Wireshark", "Burp Suite", "VS Code", "OpenWebUI",
        "Ghidra", "OpenCode",
    ],
    ProjectType.SOFTWARE_ENG: [
        "VS Code", "OpenCode", "OpenWebUI", "Burp Suite", "Wireshark",
    ],
}

TECH_OS = {
    "Malware": ["Windows", "Linux"],
    "Messaging App": ["Android", "iOS", "Windows", "macOS"],
    "Cryptocurrency": ["Linux", "macOS", "Windows"],
    "Mobile OS": ["Android", "iOS"],
    "Firmware": ["Embedded Linux", "RTOS"],
    "Network Protocol": ["Linux", "Windows"],
    "Bootloader": ["Embedded Linux", "RTOS", "Linux"],
    "Kernel Driver": ["Windows", "Linux", "macOS"],
    "VPN Appliance": ["Embedded Linux", "Linux"],
    "IoT Device": ["Embedded Linux", "RTOS"],
    "Satellite Comms": ["RTOS", "Embedded Linux"],
    "Browser": ["Windows", "macOS", "Linux"],
    "Industrial Control": ["Embedded Linux", "RTOS", "Windows"],
    "Cloud Service": ["Linux"],
    "Embedded Router": ["Embedded Linux"],
}

HUB_BIAS_TECH = {
    "Russia": ["Malware", "Firmware", "VPN Appliance", "Messaging App"],
    "China":  ["Mobile OS", "Messaging App", "Cloud Service", "Network Protocol"],
    "Iran":   ["IoT Device", "Embedded Router", "Industrial Control", "Satellite Comms"],
    "CT":     ["Messaging App", "Cryptocurrency", "Browser", "Mobile OS"],
    "SOC":    ["Cloud Service", "Network Protocol", "Browser", "Malware"],
}

VENDOR_PRODUCT_BY_TECH = {
    "Malware": [("APT29", "Toolkit"), ("Lazarus", "Implant"), ("Sandworm", "Wiper"), ("FIN7", "Loader")],
    "Messaging App": [("Telegram", "Desktop 4.x"), ("WhatsApp", "Android"), ("Signal", "iOS"), ("Viber", "Windows")],
    "Cryptocurrency": [("Ethereum", "Geth 1.13"), ("Bitcoin", "Core 25"), ("Monero", "v0.18"), ("Tornado Cash", "Mixer")],
    "Mobile OS": [("Apple", "iOS 17"), ("Google", "Android 14"), ("Samsung", "One UI 6"), ("Xiaomi", "HyperOS")],
    "Firmware": [("Cisco", "IOS XE 17.9"), ("Juniper", "Junos 22"), ("Huawei", "VRP 8"), ("MikroTik", "RouterOS 7")],
    "Network Protocol": [("IETF", "QUIC"), ("IEEE", "802.11ax"), ("3GPP", "5G NAS"), ("ITU", "SS7")],
    "Bootloader": [("Qualcomm", "ABOOT"), ("Samsung", "S-Boot"), ("Intel", "UEFI"), ("AMI", "Aptio V")],
    "Kernel Driver": [("Microsoft", "NDIS"), ("NVIDIA", "nvlddmkm"), ("Realtek", "WLAN"), ("Apple", "XNU")],
    "VPN Appliance": [("Fortinet", "FortiGate 60F"), ("Cisco", "ASA 5506"), ("Palo Alto", "PA-220"), ("Ivanti", "Connect Secure")],
    "IoT Device": [("Hikvision", "DS-Camera"), ("TP-Link", "Kasa"), ("Ring", "Doorbell"), ("Amazon", "Echo Dot")],
    "Satellite Comms": [("Iridium", "9555 Handset"), ("Inmarsat", "BGAN"), ("Starlink", "Gen2 UT"), ("Thuraya", "XT-PRO")],
    "Browser": [("Google", "Chrome 128"), ("Mozilla", "Firefox 130"), ("Apple", "WebKit"), ("Microsoft", "Edge 128")],
    "Industrial Control": [("Siemens", "S7-1500"), ("Schneider", "Modicon M580"), ("Rockwell", "ControlLogix"), ("ABB", "AC800M")],
    "Cloud Service": [("AWS", "IAM"), ("Azure", "AD B2C"), ("GCP", "Cloud Run"), ("Cloudflare", "Workers")],
    "Embedded Router": [("Asus", "RT-AX88U"), ("Netgear", "Nighthawk"), ("Linksys", "EA9500"), ("Huawei", "HG8245")],
}

COLLABORATORS = DEFAULT_CATALOGS["collaborators"]

CUSTOMERS = [
    ("Home Office", 4), ("NCSC", 3), ("DSTL", 2), ("MOD", 2),
    ("Foreign Office", 1), ("Allied SIGINT", 2), ("Internal", 2),
    ("Cabinet Office", 1),
]

LEADS = [
    "A. Carter", "J. Patel", "S. Okoye", "M. Reyes", "L. Chen",
    "D. Hoffman", "R. Singh", "E. Nakamura", "T. Abara", "H. Lindqvist",
    "N. Dubois", "P. Kowalski",
]

TAG_POOL = [
    "0day", "Nday", "fuzzing", "symbolic-exec", "static-analysis",
    "dynamic-analysis", "cryptanalysis", "side-channel", "supply-chain",
    "hardware-implant", "web", "mobile", "kernel-exploit", "uaf",
    "heap-spray", "taint", "emulation",
]

TICKET_PREFIXES = ["REQ", "TSK", "OP", "RSO"]

OUTCOMES_WEIGHTED = [
    ("Success", 6), ("Partial", 3), ("Blocked", 1), ("Abandoned", 1),
]

LANGS_BY_TYPE = {
    ProjectType.VULN_RESEARCH: ["C", "C++", "Python", "Assembly"],
    ProjectType.REVERSE_ENG: ["C", "C++", "Python", "Assembly"],
    ProjectType.RESEARCH: ["Python", "Go", "Rust"],
    ProjectType.SOFTWARE_ENG: ["Python", "Go", "Rust", "TypeScript", "C++"],
}

ARCH_BY_TECH = {
    "Malware": ["x86", "x64", "ARM"],
    "Mobile OS": ["ARM64", "ARM"],
    "Firmware": ["ARM", "MIPS", "ARM64", "PowerPC"],
    "Bootloader": ["ARM64", "ARM", "x64"],
    "Kernel Driver": ["x64", "x86", "ARM64"],
    "VPN Appliance": ["x64", "MIPS"],
    "IoT Device": ["ARM", "MIPS", "RISC-V"],
    "Satellite Comms": ["ARM", "PowerPC", "ARM64"],
    "Industrial Control": ["ARM", "PowerPC", "x64"],
    "Embedded Router": ["MIPS", "ARM"],
    "Browser": ["x64", "ARM64"],
    "Cloud Service": ["x64", "ARM64"],
    "Messaging App": ["ARM64", "x64", "ARM"],
    "Cryptocurrency": ["x64", "ARM64"],
    "Network Protocol": ["x64"],
}

OBJECTIVES = {
    ProjectType.VULN_RESEARCH: [
        "identify exploitable defects in",
        "assess the attack surface of",
        "audit input-handling paths within",
        "harden and fuzz-test",
    ],
    ProjectType.REVERSE_ENG: [
        "reverse engineer",
        "produce an internals report on",
        "recover protocol semantics from",
        "document the update / IPC mechanisms of",
    ],
    ProjectType.RESEARCH: [
        "investigate tradecraft trends around",
        "model the ecosystem of",
        "publish an internal capability note on",
        "prototype analytic detections for",
    ],
    ProjectType.SOFTWARE_ENG: [
        "deliver internal tooling for",
        "productionise an existing prototype for",
        "build a scalable analysis pipeline for",
        "extend the in-house framework to handle",
    ],
}

OUTCOME_NOTES = {
    "Success": "Findings delivered to the sponsor in a classified report. Tooling handed to operations.",
    "Partial": "Primary objective partially achieved; compensating controls limited reach. Secondary artefacts delivered.",
    "Blocked": "Work paused pending sample access / legal review. State captured for future restart.",
    "Abandoned": "De-scoped after priority reshuffle; lessons captured in the tradecraft wiki.",
}

# Seed-time example content for the structured narrative fields.
OBJECTIVES_TMPL = [
    "Characterise the attack surface and deliver actionable findings to the sponsor.",
    "Produce an internals report sufficient for follow-on tooling work.",
    "Prototype a detection capability against the target class.",
    "Establish whether an exploitable primitive exists within the scope window.",
]

FINDINGS_TMPL_SUCCESS = [
    "- 2 exploitable defects identified in the input-handling layer\n"
    "- 1 adopted for weaponisation; second submitted as an equity\n"
    "- Documentation / PoC transferred to operations",
    "- Authentication bypass in the upgrade path\n"
    "- Reproducible across 3 firmware revisions\n"
    "- Report + artefacts delivered; capability transitioned",
]
FINDINGS_TMPL_PARTIAL = [
    "- Full end-to-end primitive not achieved within scope\n"
    "- Useful building blocks captured for future work\n"
    "- Gaps documented; restart criteria defined",
]

NEXT_STEPS_TMPL_OPEN = [
    "- Complete System Characterisation phase\n"
    "- Begin fuzzing harness integration\n"
    "- Align with sponsor on pivot criteria",
    "- Finalise open-source research pass\n"
    "- Request additional samples from liaison\n"
    "- Schedule mid-cycle review",
    "- Review findings with tradecraft team\n"
    "- Decide go/no-go on weaponisation",
]

RISKS_TMPL = [
    "- Vendor may patch the defect class before weaponisation completes\n"
    "- Sample availability is a single-point dependency",
    "- Compensating controls (mitigations) may limit operational utility\n"
    "- Legal review required before any live test",
    "- Target is actively patched; we're racing the vendor cadence",
]

TYPE_TEAM_RANGE = {
    ProjectType.VULN_RESEARCH: (2, 5),
    ProjectType.REVERSE_ENG: (2, 4),
    ProjectType.RESEARCH: (2, 4),
    ProjectType.SOFTWARE_ENG: (3, 8),
}


def weighted(pool):
    items, weights = zip(*pool)
    return random.choices(items, weights=weights, k=1)[0]


def pick_unique(pool, lo, hi, fallback=None):
    n = random.randint(lo, hi)
    pool = list(dict.fromkeys(pool))
    if len(pool) >= n:
        return random.sample(pool, n)
    out = list(pool)
    if fallback:
        extra = [x for x in fallback if x not in out]
        random.shuffle(extra)
        out.extend(extra[: n - len(out)])
    return out


def choose_techs(ptype, hub):
    pool = list(TYPE_TECH[ptype]) + list(HUB_BIAS_TECH.get(hub, [])) * 2
    return pick_unique(pool, 1, 3, fallback=TYPE_TECH[ptype])


def choose_tools(ptype):
    return pick_unique(TYPE_TOOLS[ptype], 2, 5,
                       fallback=["VS Code", "Wireshark", "Ghidra"])


def choose_os(techs):
    candidates = []
    for t in techs:
        candidates.extend(TECH_OS.get(t, []))
    if not candidates:
        candidates = ["Linux", "Windows"]
    return pick_unique(candidates, 1, min(3, len(set(candidates))),
                       fallback=["Linux", "Windows", "macOS"])


def choose_arch(techs):
    for t in techs:
        if t in ARCH_BY_TECH:
            return random.choice(ARCH_BY_TECH[t])
    return random.choice(["x64", "ARM64"])


def choose_langs(ptype):
    pool = LANGS_BY_TYPE[ptype]
    n = random.randint(1, min(3, len(pool)))
    return random.sample(pool, n)


def choose_collabs():
    r = random.random()
    if r < 0.20:
        return []
    elif r < 0.70:
        return random.sample(COLLABORATORS, 1)
    else:
        return random.sample(COLLABORATORS, 2)


def choose_tags(ptype, closed):
    n = random.randint(1, 4)
    tags = random.sample(TAG_POOL, n)
    if ptype == ProjectType.VULN_RESEARCH and closed and random.random() < 0.5:
        tags.append(random.choice(["0day", "Nday"]))
    return list(dict.fromkeys(tags))


def choose_vendor_product(techs):
    for t in techs:
        if t in VENDOR_PRODUCT_BY_TECH:
            return random.choice(VENDOR_PRODUCT_BY_TECH[t])
    return ("", "")


def make_stages(total_days, ptype):
    base = {
        "Sourcing":               0.08,
        "Research":               0.12,
        "Setup":                  0.10,
        "System Characterisation":0.15,
        "Vulnerability Research": 0.20,
        "Exploit Development":    0.15,
        "Documentation":          0.10,
        "Other":                  0.10,
    }
    if ptype == ProjectType.VULN_RESEARCH:
        base["Vulnerability Research"] = 0.30
        base["Exploit Development"] = 0.20
        base["Research"] = 0.10
        base["Setup"] = 0.08
    elif ptype == ProjectType.REVERSE_ENG:
        base["System Characterisation"] = 0.28
        base["Documentation"] = 0.18
        base["Research"] = 0.12
        base["Setup"] = 0.10
    elif ptype == ProjectType.RESEARCH:
        base["Research"] = 0.28  # research-type projects lean heavily on research
        base["Documentation"] = 0.22
        base["Sourcing"] = 0.15
        base["Setup"] = 0.08
    elif ptype == ProjectType.SOFTWARE_ENG:
        base["Exploit Development"] = 0.05
        base["Vulnerability Research"] = 0.05
        base["Other"] = 0.30
        base["Setup"] = 0.18
        base["Research"] = 0.08

    weighted_stages = [(s, base[s] * (0.6 + random.random() * 0.8))
                       for s in STAGE_NAMES]
    n = random.randint(4, 6)
    weighted_stages.sort(key=lambda x: x[1], reverse=True)
    chosen = weighted_stages[:n]
    total_w = sum(w for _, w in chosen)
    stages = []
    allocated = 0
    for i, (s, w) in enumerate(chosen):
        if i == len(chosen) - 1:
            days = max(1, total_days - allocated)
        else:
            days = max(1, int(total_days * w / total_w))
        stages.append((s, days))
        allocated += days
    return stages


def make_description(codename, ptype, hub, techs, tools, vendor, product, closed, outcome_key):
    """Rich-context description. Intentionally avoids an "Objective" heading
    because the short objective is stored in its own dedicated field now —
    having both would duplicate the info in the project view."""
    tech_phrase = techs[0].lower() if techs else "an unspecified target"
    if len(techs) > 1:
        tech_phrase += f" (with supporting work across {', '.join(t.lower() for t in techs[1:])})"

    context = (
        f"### Context\n"
        f"{ptype.value} effort aligned to the **{hub}** campaign. "
        f"Project {codename!r} covers {tech_phrase}"
    )
    if vendor and product:
        context += f", targeting **{vendor} {product}**."
    else:
        context += "."

    approach = (
        f"\n\n### Approach\n"
        f"Primary toolchain: {', '.join(tools[:4])}. "
        f"Analysis follows the standard lifecycle, with emphasis on "
        + ("vulnerability research and exploit development" if ptype == ProjectType.VULN_RESEARCH
           else "system characterisation and documentation" if ptype == ProjectType.REVERSE_ENG
           else "open-source research and tradecraft modelling" if ptype == ProjectType.RESEARCH
           else "tooling engineering and integration")
        + "."
    )

    if closed:
        outcome_note = OUTCOME_NOTES.get(outcome_key, "")
        return f"{context}{approach}\n\n### Wrap-up\n{outcome_note}"
    status = random.choice([
        "Currently in active execution.",
        "In ramp-up; sourcing phase ongoing.",
        "Characterisation complete, moving to deeper analysis.",
        "Holding pattern awaiting sample availability.",
    ])
    return f"{context}{approach}\n\n### Status\n{status}"


def build_project(codename, closed):
    ptype = random.choice(list(ProjectType))
    hub = random.choice(HUBS)
    lo, hi = TYPE_TEAM_RANGE[ptype]
    team_size = random.randint(lo, hi)

    techs = choose_techs(ptype, hub)
    tools = choose_tools(ptype)
    os_list = choose_os(techs)
    collabs = choose_collabs()
    arch = choose_arch(techs)
    langs = choose_langs(ptype)
    tags = choose_tags(ptype, closed)
    vendor, product = choose_vendor_product(techs)

    today = date.today()
    if closed:
        total_days = random.randint(30, 400)
        end_offset = random.randint(30, 1100)
        end = today - timedelta(days=end_offset)
        start = end - timedelta(days=total_days)
        status = ProjectStatus.CLOSED
        outcome = weighted(OUTCOMES_WEIGHTED)
        if ptype == ProjectType.VULN_RESEARCH and outcome in ("Success", "Partial"):
            vulns = random.randint(1, 5)
            equities = random.randint(0, min(vulns, 3))
        else:
            vulns = random.randint(0, 1)
            equities = 0
        op_success = outcome == "Success" and random.random() < 0.7
    else:
        start_offset = random.randint(20, 400)
        start = today - timedelta(days=start_offset)
        end = None
        total_days = max(1, (today - start).days)
        status = ProjectStatus.OPEN
        outcome = "In Progress"
        vulns = 0
        equities = 0
        op_success = False

    lead_name = random.choice(LEADS)
    ticket = f"{random.choice(TICKET_PREFIXES)}-{random.randint(1000, 9999)}"
    slug = codename.lower().replace(' ', '-')

    objectives = random.choice(OBJECTIVES_TMPL)
    if closed:
        if outcome == "Success":
            key_findings = random.choice(FINDINGS_TMPL_SUCCESS)
            next_steps_text = ""
        elif outcome == "Partial":
            key_findings = random.choice(FINDINGS_TMPL_PARTIAL)
            next_steps_text = "- Revisit once sample constraints lift\n- Merge learnings into follow-on project"
        else:
            key_findings = ""
            next_steps_text = ""
    else:
        key_findings = ""
        next_steps_text = random.choice(NEXT_STEPS_TMPL_OPEN)
    risks_text = random.choice(RISKS_TMPL) if random.random() < 0.6 else ""

    p = Project(
        name=codename,
        status=status,
        project_type=ptype,
        start_date=start,
        end_date=end,
        team_size=team_size,
        end_customer=weighted(CUSTOMERS),
        campaign_hub=hub,
        description=make_description(codename, ptype, hub, techs, tools,
                                     vendor, product, closed, outcome),
        target_vendor=vendor,
        target_product=product,
        cpu_arch=arch,
        outcome=outcome,
        project_lead=lead_name,
        ticket_ref=ticket,
        repo_url=f"https://git.internal/est/{slug}",
        wiki_url=f"https://wiki.internal/est/{slug.replace('-', '_')}",
        confluence_url=f"https://confluence.internal/display/EST/{slug}",
        jira_url=f"https://jira.internal/browse/{ticket}",
        vulnerabilities_discovered=vulns,
        hs_equities=equities,
        operational_success=op_success,
        objectives=objectives,
        key_findings=key_findings,
        next_steps=next_steps_text,
        risks=risks_text,
    )

    for t in techs:
        p.technologies.append(ProjectTechnology(name=t))
    for t in tools:
        p.tools.append(ProjectTool(name=t))
    for o in os_list:
        p.os_list.append(ProjectOS(name=o))
    for c in collabs:
        p.collaborators.append(ProjectCollaborator(org_name=c))
    for l in langs:
        p.languages.append(ProjectLanguage(name=l))
    for t in tags:
        p.tags.append(ProjectTag(name=t))

    # Populate stage data for every project. Closed projects get a full
    # breakdown; open projects reflect work-in-progress — earlier stages
    # filled, later stages progressively more likely to be zero to simulate
    # "not yet reached".
    if closed:
        for stage_name, days in make_stages(total_days, ptype):
            p.stages.append(ProjectStage(stage_name=stage_name, days_spent=days))
    else:
        raw = make_stages(total_days, ptype)
        # Order stages by canonical flow position; zero the last N to mimic
        # a project that's X% of the way through.
        from app.models import STAGE_NAMES as _STAGE_FLOW
        order = {s: i for i, s in enumerate(_STAGE_FLOW)}
        raw_sorted = sorted(raw, key=lambda s: order.get(s[0], 999))
        # % progressed — roughly correlates with duration so far
        progress = min(1.0, total_days / 240.0)  # 8 months = ~fully through
        keep_count = max(1, int(len(raw_sorted) * (0.4 + progress * 0.6)))
        # Slight jitter so not all open projects look identical
        keep_count = max(1, min(len(raw_sorted), keep_count + random.choice([-1, 0, 0, 1])))
        kept = raw_sorted[:keep_count]
        for stage_name, days in kept:
            p.stages.append(ProjectStage(stage_name=stage_name, days_spent=days))
    return p


def main():
    Base.metadata.create_all(bind=engine)
    migrate.run()
    db = SessionLocal()
    try:
        db.query(ProjectStage).delete()
        db.query(ProjectTechnology).delete()
        db.query(ProjectTool).delete()
        db.query(ProjectOS).delete()
        db.query(ProjectCollaborator).delete()
        db.query(ProjectLanguage).delete()
        db.query(ProjectTag).delete()
        db.query(Project).delete()
        db.commit()

        names = random.sample(CODENAMES, 45)
        closed_names, open_names = names[:35], names[35:]

        for cn in closed_names:
            db.add(build_project(cn, closed=True))
        for cn in open_names:
            db.add(build_project(cn, closed=False))

        db.commit()
        print("Seeded 45 projects (35 closed / 10 open) with full metadata.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
