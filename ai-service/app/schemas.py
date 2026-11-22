"""Request bodies and the JSON shapes Claude must return.

Model-output shapes ("...Out") have every field required and no extra keys, which is what structured
outputs expects. Length limits are applied after the call (see `clip`), matching the app's zod schemas.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------- CV parsing ----------------
class PersonalOut(Strict):
    fullName: str
    headline: str
    email: str
    phone: str
    location: str
    website: str
    linkedin: str


class ExperienceOut(Strict):
    title: str
    employer: str
    location: str
    start: str = Field(description="YYYY or YYYY-MM, or empty")
    end: str = Field(description="YYYY or YYYY-MM, or empty when current or unknown")
    current: bool
    description: str


class EducationOut(Strict):
    degree: str
    institution: str
    location: str
    start: str
    end: str
    grade: str
    details: str


class CertificationOut(Strict):
    name: str
    issuer: str
    date: str


class LanguageOut(Strict):
    name: str
    level: str


class ProjectOut(Strict):
    name: str
    role: str
    link: str
    description: str


class PublicationOut(Strict):
    title: str
    venue: str
    year: str
    link: str


class AwardOut(Strict):
    title: str
    issuer: str
    year: str


class MembershipOut(Strict):
    name: str
    role: str


class CvExtractOut(Strict):
    personal: PersonalOut
    summary: str
    experience: list[ExperienceOut]
    education: list[EducationOut]
    skills: list[str]
    certifications: list[CertificationOut]
    languages: list[LanguageOut]
    projects: list[ProjectOut]
    publications: list[PublicationOut]
    awards: list[AwardOut]
    memberships: list[MembershipOut]
    references: str
    unassigned: list[str] = Field(description="Lines from the CV that fit no section, copied verbatim")


class ParseIn(BaseModel):
    text: str = Field(min_length=30, max_length=80000)


# ---------------- Wording improvements ----------------
class ImproveItemIn(BaseModel):
    id: str = Field(max_length=40)
    text: str = Field(min_length=1, max_length=4000)


class ImproveIn(BaseModel):
    items: list[ImproveItemIn] = Field(min_length=1, max_length=30)
    role: str = Field(default="", max_length=150)


class ImproveItemOut(Strict):
    id: str
    improved: str


class ImproveOut(Strict):
    items: list[ImproveItemOut]


# ---------------- Cover letters ----------------
class OpportunityIn(BaseModel):
    title: str = Field(max_length=300)
    organization: str = Field(max_length=300)
    reference_no: Optional[str] = Field(default=None, max_length=120)
    description: str = Field(default="", max_length=20000)
    requirements: dict[str, Any] = Field(default_factory=dict)


class CoverLetterIn(BaseModel):
    cv: dict[str, Any]
    opportunity: OpportunityIn


class CoverLetterOut(Strict):
    body: str


# ---------------- Requirement extraction ----------------
class RequirementsIn(BaseModel):
    title: str = Field(max_length=300)
    description: str = Field(min_length=20, max_length=40000)


class RequirementsOut(Strict):
    applicant_type: Literal["individual", "business", "either", "unknown"]
    eligible_countries: list[str]
    places: list[str]
    min_experience_years: Optional[float]
    education_level: Optional[
        Literal["none", "secondary", "certificate", "diploma", "bachelor", "master", "phd"]
    ]
    degree_levels: list[Literal["bachelor", "master", "phd", "postdoc", "short_course", "exchange"]]
    fields: list[str]
    skills: list[str]
    languages: list[str]
    min_gpa: Optional[float]
    gpa_scale: Optional[float]
    employment_type: Optional[str]
    seniority: Optional[str]
    certifications: list[str]
    licenses: list[str]
    registration_required: Optional[bool]
    tax_clearance_required: Optional[bool]
    min_years_in_operation: Optional[float]
    min_past_contracts: Optional[float]
    procurement_categories: list[Literal["works", "goods", "services", "consultancy"]]
    funding: Literal["full", "partial", "unknown"]
    required_documents: list[str]
    deadline: Optional[str] = Field(description="YYYY-MM-DD if a closing date is stated, else null")


def strict_schema(model: type[BaseModel]) -> dict[str, Any]:
    """JSON Schema for structured outputs: refs inlined, titles dropped, every object closed."""
    raw = model.model_json_schema()
    defs = raw.pop("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return walk(defs[node["$ref"].split("/")[-1]])
            out = {k: walk(v) for k, v in node.items() if k not in {"title", "default"}}
            if out.get("type") == "object" and "properties" in out:
                out["additionalProperties"] = False
                out["required"] = list(out["properties"].keys())
            return out
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(raw)
