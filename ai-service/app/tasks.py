"""The four AI tasks. Each one: prompt Claude for schema-shaped JSON, then ground-check the answer."""

from __future__ import annotations

import json
from typing import Any

from .grounding import Source, clean_date
from .llm import Llm, LlmError
from .schemas import (
    CoverLetterIn,
    CoverLetterOut,
    CvExtractOut,
    ImproveIn,
    ImproveOut,
    RequirementsIn,
    RequirementsOut,
    strict_schema,
)

RULES = (
    "You work for Opportunity Radar, a CV builder used by people all over the world. "
    "Never invent facts: no employers, job titles, dates, degrees, institutions, numbers, results, "
    "certificates or skills that are not in the material you are given. When something is missing, "
    "leave the field empty or write a short placeholder in square brackets, such as "
    "[add a result you can evidence]. Keep the person's own language and spelling conventions."
)

# Limits match the app's zod schemas (shared/cv.ts) so the Worker never rejects our output.
LIMITS = {
    "fullName": 120, "headline": 160, "email": 200, "phone": 60, "location": 150, "website": 300,
    "linkedin": 300, "summary": 3000, "title": 150, "employer": 150, "description": 4000,
    "degree": 200, "institution": 200, "grade": 80, "details": 1500, "name": 200, "issuer": 150,
    "date": 20, "level": 60, "role": 120, "link": 300, "venue": 200, "year": 10, "references": 1500,
}
MAX_ITEMS = {
    "experience": 30, "education": 15, "skills": 80, "projects": 20, "certifications": 30,
    "languages": 15, "publications": 60, "awards": 30, "memberships": 20,
}
LONG_FIELDS = {"description", "details", "summary", "references"}
DATE_FIELDS = {"start", "end"}


class GroundingError(Exception):
    """The answer used facts that are not in the source, so it was not returned."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


def _clip(key: str, value: str) -> str:
    return value.strip()[: LIMITS.get(key, 300)]


# ---------------- CV parsing ----------------
PARSE_SYSTEM = (
    RULES
    + " Your job: copy the contents of a CV into fields. Copy text exactly as written; do not reword, "
    "summarise, correct or translate. Dates become YYYY or YYYY-MM (empty if not stated); set current "
    "to true only when the CV says present, current or similar. Put each skill as a short name. Lines "
    "that fit no field go in unassigned, copied verbatim."
)


async def parse_cv(llm: Llm, text: str) -> dict[str, Any]:
    raw = await llm.json(
        system=PARSE_SYSTEM,
        user=f"Here is the CV text:\n\n<cv>\n{text}\n</cv>",
        schema=strict_schema(CvExtractOut),
    )
    out = CvExtractOut.model_validate(raw)
    src = Source(text)
    dropped: list[str] = []

    def keep(section: str, key: str, value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        if key in DATE_FIELDS:
            d = clean_date(value)
            if not d or not src.date_ok(d):
                dropped.append(f"{section}.{key}")
                return ""
            return d
        ok = src.coverage(value) >= 0.9 if key in LONG_FIELDS else src.contains(value)
        if not ok:
            dropped.append(f"{section}.{key}")
            return ""
        return _clip(key, value)

    personal = {k: keep("personal", k, v) for k, v in out.personal.model_dump().items()}

    def rows(section: str, items: list[Any]) -> list[dict[str, Any]]:
        result = []
        for item in items[: MAX_ITEMS[section]]:
            row = {
                k: (v if isinstance(v, bool) else keep(section, k, v))
                for k, v in item.model_dump().items()
            }
            if any(v for k, v in row.items() if not isinstance(v, bool)):
                result.append(row)
        return result

    skills = []
    for s in out.skills[: MAX_ITEMS["skills"]]:
        if not s.strip():
            continue
        if src.contains(s):
            skills.append({"name": s.strip()[:80], "level": ""})
        else:
            dropped.append("skills.name")

    data: dict[str, Any] = {
        "personal": personal,
        "summary": keep("summary", "summary", out.summary),
        "experience": rows("experience", out.experience),
        "education": rows("education", out.education),
        "skills": skills,
        "certifications": rows("certifications", out.certifications),
        "languages": rows("languages", out.languages),
        "projects": rows("projects", out.projects),
        "publications": rows("publications", out.publications),
        "awards": rows("awards", out.awards),
        "memberships": rows("memberships", out.memberships),
        "references": keep("references", "references", out.references),
    }
    for e in data["experience"]:
        if e["current"]:
            e["end"] = ""
    found = [k for k, v in data.items() if k != "personal" and v]
    if any(personal.values()):
        found.insert(0, "personal")
    unassigned = [u.strip()[:300] for u in out.unassigned if u.strip() and src.contains(u)][:40]
    return {"data": data, "found": found, "unassigned": unassigned, "method": "ai", "dropped": dropped}


# ---------------- Wording improvements ----------------
IMPROVE_SYSTEM = (
    RULES
    + " Your job: make CV lines clearer and stronger. Start with an action verb, cut filler, keep it "
    "to one or two lines, and keep every fact exactly as given. You may not add numbers, names, tools, "
    "results or scope. Where a result would help and none is given, end with a bracketed placeholder. "
    "Return one item per input item, with the same id."
)


async def improve(llm: Llm, body: ImproveIn) -> dict[str, Any]:
    payload = [{"id": i.id, "text": i.text} for i in body.items]
    role = f"The person's role: {body.role}\n\n" if body.role else ""
    raw = await llm.json(
        system=IMPROVE_SYSTEM,
        user=f"{role}Lines to improve (JSON):\n{json.dumps(payload, ensure_ascii=False)}",
        schema=strict_schema(ImproveOut),
    )
    out = {i.id: i.improved for i in ImproveOut.model_validate(raw).items}
    results = []
    for item in body.items:
        src = Source(item.text, body.role)
        suggestion = out.get(item.id, "").strip()[:4000]
        problems = (
            [f"new number {n}" for n in src.new_numbers(suggestion)]
            + [f"new name {n}" for n in src.new_names(suggestion)]
        )
        if not suggestion or problems:
            results.append(
                {
                    "id": item.id,
                    "original": item.text,
                    "improved": item.text,
                    "changed": False,
                    "note": "Kept your wording: the suggestion added details that are not in your CV."
                    if problems
                    else "No suggestion.",
                }
            )
        else:
            results.append(
                {
                    "id": item.id,
                    "original": item.text,
                    "improved": suggestion,
                    "changed": suggestion != item.text,
                    "note": "",
                }
            )
    return {"items": results}


# ---------------- Cover letters ----------------
LETTER_SYSTEM = (
    RULES
    + " Your job: write a cover letter of 250 to 400 words from the CV and the opportunity. Use only "
    "experience, skills and education that appear in the CV, and connect them to what the opportunity "
    "asks for. Where a specific achievement would help, add a bracketed placeholder for the person to "
    "fill in. Plain text, no markdown. Start with a greeting to the organisation and end with "
    "'Yours sincerely,' followed by the person's name from the CV (or [Your name])."
)


async def cover_letter(llm: Llm, body: CoverLetterIn) -> dict[str, Any]:
    cv_json = json.dumps(body.cv, ensure_ascii=False)
    opp = body.opportunity
    opp_json = json.dumps(opp.model_dump(), ensure_ascii=False)
    raw = await llm.json(
        system=LETTER_SYSTEM,
        user=f"<cv>\n{cv_json}\n</cv>\n\n<opportunity>\n{opp_json}\n</opportunity>",
        schema=strict_schema(CoverLetterOut),
    )
    text = CoverLetterOut.model_validate(raw).body.strip()
    src = Source(cv_json, opp_json)
    problems = [f"new number {n}" for n in src.new_numbers(text)] + [
        f"new name {n}" for n in src.new_names(text)
    ]
    if not text or problems:
        raise GroundingError(problems or ["empty letter"])
    return {"body": text[:8000]}


# ---------------- Requirement extraction ----------------
REQ_SYSTEM = (
    RULES
    + " Your job: read an opportunity notice and record only the requirements it states. Use null or an "
    "empty list for anything the notice does not state; never assume. Countries are full English "
    "country names (for 'Kenyan citizens' write Kenya). 'Worldwide' or 'all nationalities' means an "
    "empty eligible_countries list."
)


async def extract_requirements(llm: Llm, body: RequirementsIn) -> dict[str, Any]:
    raw = await llm.json(
        system=REQ_SYSTEM,
        user=f"<title>{body.title}</title>\n<notice>\n{body.description}\n</notice>",
        schema=strict_schema(RequirementsOut),
    )
    out = RequirementsOut.model_validate(raw).model_dump()
    src = Source(body.title, body.description)
    dropped: list[str] = []
    for key in ("min_experience_years", "min_gpa", "gpa_scale", "min_years_in_operation", "min_past_contracts"):
        v = out[key]
        if v is not None and (v < 0 or src.new_numbers(f"{v:g}")):
            dropped.append(key)
            out[key] = None
    for key in ("fields", "skills", "languages", "certifications", "licenses", "places", "required_documents"):
        kept = []
        for v in out[key]:
            if v.strip() and src.coverage(v) >= 0.6:
                kept.append(v.strip()[:200])
            elif v.strip():
                dropped.append(f"{key}:{v}")
        out[key] = kept[:40]
    if out["deadline"] and not (clean_date(out["deadline"][:7]) and src.date_ok(out["deadline"])):
        dropped.append("deadline")
        out["deadline"] = None
    out["eligible_countries"] = [c.strip()[:80] for c in out["eligible_countries"] if c.strip()][:80]
    return {"requirements": out, "dropped": dropped}


__all__ = ["GroundingError", "LlmError", "cover_letter", "extract_requirements", "improve", "parse_cv"]
